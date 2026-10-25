const fs = require("fs");

const GENDER_ARTICLES = new Set([
  "un", "une", "le", "la", "du", "au", "son", "sa", "ce", "cet", "cette",
  "aucun", "aucune", "ma", "ta", "mon", "ton", "tout", "toute", "tous", "toutes",
  "quel", "quelle", "quels", "quelles",
]);
// numbers above "un"/"une" don't inflect for gender in French
const FRENCH_NUMBER_WORDS = [
  "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
  "vingt", "vingt-et-un", "vingt-deux", "vingt-trois", "vingt-quatre",
  "vingt-cinq", "vingt-six", "vingt-sept", "vingt-huit", "vingt-neuf",
  "trente", "trente-et-un", "trente-deux", "trente-trois", "trente-quatre",
  "trente-cinq", "trente-six", "trente-sept", "trente-huit", "trente-neuf",
  "quarante", "quarante-et-un", "quarante-deux", "quarante-trois",
  "quarante-quatre", "quarante-cinq", "quarante-six", "quarante-sept",
  "quarante-huit", "quarante-neuf",
  "cinquante", "cinquante-et-un", "cinquante-deux", "cinquante-trois",
  "cinquante-quatre", "cinquante-cinq", "cinquante-six", "cinquante-sept",
  "cinquante-huit", "cinquante-neuf",
  "soixante", "soixante-et-un", "soixante-deux", "soixante-trois",
  "soixante-quatre", "soixante-cinq", "soixante-six", "soixante-sept",
  "soixante-huit", "soixante-neuf",
  "soixante-dix", "soixante-et-onze", "soixante-douze", "soixante-treize",
  "soixante-quatorze", "soixante-quinze", "soixante-seize",
  "soixante-dix-sept", "soixante-dix-huit", "soixante-dix-neuf",
  "quatre-vingts", "quatre-vingt", "quatre-vingt-un", "quatre-vingt-deux",
  "quatre-vingt-trois", "quatre-vingt-quatre", "quatre-vingt-cinq",
  "quatre-vingt-six", "quatre-vingt-sept", "quatre-vingt-huit",
  "quatre-vingt-neuf",
  "quatre-vingt-dix", "quatre-vingt-onze", "quatre-vingt-douze",
  "quatre-vingt-treize", "quatre-vingt-quatorze", "quatre-vingt-quinze",
  "quatre-vingt-seize", "quatre-vingt-dix-sept", "quatre-vingt-dix-huit",
  "quatre-vingt-dix-neuf",
  "cent",
];
// Yandex tags these purely as nouns ("nn"), with no "adj" entry at all,
// even though "troisième jour" uses "troisième" adjectivally (modifying
// "jour") just as much as "grand" modifies a noun elsewhere - without this,
// the ordinal gets treated as an unambiguous direct match and the search
// stops before ever reaching the real noun that follows it. "premier" is
// the one ordinal Yandex does tag "adj" for, so it already works without
// being listed here. "tel"/"telle" are the same case ("de tels miracles",
// "un tel homme") - kept as a fallback rather than excluded outright, since
// they are also a real noun in "chez un tel" (so-and-so). Plurals are listed
// explicitly because this is checked against the word as written, before
// the singular lookup.
// Also listed: the common adjectives that stand BEFORE their noun ("sa
// propre salive", "une belle journée"). The dictionary often lists them as
// nouns too ("propre", "grand"), which makes them look the same as a real
// noun that happens to double as an adjective ("maître") - but unlike
// those, they are the modifier whenever a word follows them in the phrase,
// so a verb-ambiguous noun right after one ("salive", "pouvoir") is the
// head noun (see fallbackUntagged in highlightNounGender)
const UNTAGGED_ADJECTIVE_WORDS = new Set([
  "deuxième", "troisième", "quatrième", "cinquième", "sixième", "septième",
  "huitième", "neuvième", "dixième", "onzième", "douzième",
  "tel", "telle", "tels", "telles",
  "haut", "haute", "hauts", "hautes",
  "propre", "propres",
  "beau", "bel", "belle", "beaux", "belles",
  "grand", "grande", "grands", "grandes",
  "petit", "petite", "petits", "petites",
  "bon", "bonne", "bons", "bonnes",
  "mauvais", "mauvaise", "mauvaises",
  "vieux", "vieil", "vieille", "vieilles",
  "jeune", "jeunes",
  "autre", "autres",
  "même", "mêmes",
  "seul", "seule", "seuls", "seules",
  "pauvre", "pauvres",
  "saint", "sainte", "saints", "saintes",
  "nouveau", "nouvel", "nouvelle", "nouveaux", "nouvelles",
  "premier", "première", "premiers", "premières",
  "dernier", "dernière", "derniers", "dernières",
]);
// gender-neutral - trigger a noun search, but never reveal m/f themselves
const PLURAL_ARTICLES = new Set([
  "les", "des", "ses", "ces", "mes", "tes", "votre", "notre", "vos", "nos",
  "leur", "leurs", "aux", "quelques",
  ...FRENCH_NUMBER_WORDS,
]);
const ARTICLE_GENDER = {
  un: "m", une: "f", le: "m", la: "f", du: "m", au: "m", son: "m", sa: "f",
  ce: "m", cet: "m", cette: "f", aucun: "m", aucune: "f",
  ma: "f", ta: "f", mon: "m", ton: "m",
  tout: "m", toute: "f", tous: "m", toutes: "f",
  quel: "m", quelle: "f", quels: "m", quelles: "f",
};
// "mon"/"ton"/"son" also stand in for "ma"/"ta"/"sa" right before a
// vowel/mute-h-initial feminine noun (euphony, e.g. "mon amie") - see the
// VOWEL_START_RE check below
const POSSESSIVE_VOWEL_EXCEPTION = new Set(["son", "mon", "ton"]);
// a possessive/demonstrative determiner can never sit in front of a verb, so
// the word after it is guaranteed to be a noun phrase - even a verb-ambiguous
// candidate ("sa salive", "ses larmes", "ces œuvres") should be trusted
// rather than discarded (see the mustBeNoun fallback tier below). "leur" is
// left out on purpose: it is also an invariable indirect-object pronoun ("il
// leur parle"), which can sit right in front of a verb - "leurs" is safe,
// since the pronoun never takes an "s" (the possessive pronoun "les leurs"
// is followed by a pure verb at worst, which already ends the search). "ce"
// is handled separately (see CE_PRONOUN_VERBS): unlike "cet"/"cette"/"ces"
// it is also a pronoun
const NOUN_GUARANTEEING_DETERMINERS = new Set([
  "sa", "son", "ses", "ma", "mon", "mes", "ta", "ton", "tes",
  "notre", "nos", "votre", "vos", "leurs",
  "cet", "cette", "ces",
  // "des" is "de" + "les" or the indefinite plural article, "aux" is "à" +
  // "les" - when "les" is a pronoun ("de les voir") it does not contract, so
  // neither can ever stand in front of a verb; "quelques" is a determiner only
  "des", "aux", "quelques",
  // always a determiner ("chaque nuit")
  "chaque",
]);
// "quel"/"quelle"/"quels"/"quelles" are determiners ("de quelle mort") but,
// like "ce", can be followed by être ("quel est ton nom") - handled together
// with "ce" below
const QUEL_FORMS = new Set(["quel", "quelle", "quels", "quelles"]);
// "tout"/"toute"/"tous"/"toutes" give the gender of a following noun ("toute
// personne", "toutes choses"), but are just as often a floating quantifier
// ("vous n’êtes pas tous purs") - the word after them is then a predicate
// adjective, never the noun. So only a word that is a noun for sure counts
// after them: no adjective fallback, and no adjective used as a noun
const TOUT_FORMS = new Set(["tout", "toute", "tous", "toutes"]);
// finite forms of être/avoir/aller - the dictionary also lists some of them as
// nouns ("est" = east, "a" = the letter), but right after a noun phrase they
// are the verb ("le maître est ici"), so beyond the first word after the
// article they must never be picked as the verb-ambiguous last-resort noun
const AUXILIARY_VERB_FORMS = new Set([
  "est", "es", "suis", "sommes", "êtes", "sont", "étais", "était", "étions",
  "étiez", "étaient", "fut", "fus", "furent", "sera", "serai", "seras",
  "serons", "serez", "seront", "serait", "seraient", "soit", "soient", "sois",
  "soyons", "soyez", "ai", "as", "a", "avons", "avez", "ont", "avais",
  "avait", "avions", "aviez", "avaient", "aura", "aurai", "auras", "aurons",
  "aurez", "auront", "aurait", "auraient", "va", "vas", "vont",
]);
// "ce" is a determiner ("ce miracle") but also the pronoun of "ce sont", "ce
// fut", "ce n’est pas" - in those the next word is a form of être/pouvoir/
// devoir/sembler, which for words like "est" (the noun "east") would
// otherwise pass as a verb-ambiguous noun
const CE_PRONOUN_VERBS = new Set([
  "est", "sont", "sera", "serait", "seront", "seraient", "fut", "furent",
  "était", "étaient", "soit", "soient", "peut", "pouvait", "doit", "devait",
  "semble", "semblait",
]);
// closed-class words that can never themselves be the noun - without this,
// a lookahead landing on one of them can pick up a bogus noun sense Yandex
// returns for an accent-insensitive homograph (e.g. "de" matched as "dé")
const STOPWORDS = new Set([
  "et", "y", "se", "ne", "pas", "que", "qui", "dont", "où",
  "lui",
  "nous", "vous", "il", "elle", "ils", "elles", "on", "je", "tu", "moi",
  "toi", "car", "donc", "mais", "ou", "si", "comme",
  "sous", "dans", "chez", "vers",
  "après", "avant", "pendant", "depuis",
]);
// these don't reveal gender, but the word right after them is worth
// checking too - unlike articles, only the immediate next word counts
// (no 3-word adjective lookahead), since there's no agreement to confirm
const PREPOSITION_TRIGGERS = new Set([
  "à", "de", "entre", "sans", "par", "sur", "avec", "en", "chaque", "pour",
  "quelque", "contre", "ni",
]);
// "de"/"à" get the same 3-word adjective lookahead as articles (e.g. "de
// haute naissance", "à haute voix") - the other prepositions stay at 1
// word, since they were not reported to need it and a wider window raises
// false-positive risk
const NARROW_PREPOSITIONS = new Set([
  "entre", "sans", "par", "sur", "avec", "chaque", "pour", "quelque",
  "contre", "ni",
]);
// a preposition can never be followed by nothing - whatever comes after it
// (directly, or via an intervening "le"/"la"/"les" that turns out to govern
// a verb/noun homograph like "voie"/"paille"/"assemblée"/"courant") is
// guaranteed to be a noun phrase, so even a verb-ambiguous candidate should
// be trusted here rather than discarded (see the mustBeNoun fallback tier
// below). "comme" and "dans" are included here even though they are not
// full PREPOSITION_TRIGGERS entries (they are STOPWORDS instead, since they
// are essentially never followed by a bare noun with no article) - they
// still guarantee a noun once an article intervenes ("dans l'assemblée").
// Left out on purpose: "pour"/"sans"/"après"/"avant" - they take an
// infinitive or a pronoun + infinitive ("pour porter", "sans les voir",
// "après les avoir vus"), so what follows can be a verb and "les" a pronoun
// ...but after those four, "le"/"la"/"les"/"l’" is still an article whenever
// the next word does NOT look like an infinitive or a participle: the
// pronoun can only be followed by one of those ("pour le voir"), never by a
// conjugated verb or a noun ("pour le peuple", "sans la voie")
const INFINITIVE_TAKING_PREPOSITIONS = new Set(["pour", "sans", "après", "avant"]);
// prepositions after which only an infinitive can be a verb (whether a word
// IS an infinitive comes from the dictionary - see isInfinitiveLike)
const INFINITIVE_AFTER_PREPOSITIONS = new Set(["pour", "sans", "à", "de", "par"]);
const PAST_PARTICIPLE_ENDING_RE = /(é|ée|és|ées)$/u;
const NOUN_GUARANTEED_PREPOSITIONS = new Set([
  "à", "de", "sur", "en", "comme", "par", "avec", "dans", "depuis",
  "entre", "contre", "chez", "vers", "sous", "pendant", "parmi", "selon",
  "dès", "durant", "envers", "hors", "sauf",
  "malgré",
]);
// most noun/verb and noun/adjective ambiguity (e.g. "grand", "porter") is
// detected from Yandex's own part-of-speech data instead (see
// fetchGenderFromYandex) - these are left here only because the metadata
// doesn't (yet) catch them: "combien"/"ensemble"/"devant" are
// adverb-dominant, not adjective-dominant, so the fallback-chain doesn't
// apply to them. ("haut"/"haute" used to be here too - a genuine Yandex data
// gap, querying "haute" alone doesn't surface the "haut" adjective sense -
// but excluding them outright meant "vers le haut" never got highlighted;
// they are now in UNTAGGED_ADJECTIVE_WORDS instead, which keeps looking for
// a later noun ("de haute naissance") yet still falls back to "haut" itself)
const EXCLUDED_NOUNS = new Set([
  "combien", "ensemble", "devant", "peu", "plusieurs",
]);
// case-insensitive: "L’heure" at the start of a sentence is the same
// elided article as "l’heure" mid-sentence
const ELISION_RE = /^(l['’])(\p{L}.*)$/iu;
// "de" elides onto a directly-following vowel-initial word with no space
// (e.g. "d’épines") - same role as the PREPOSITION_TRIGGERS "de", but
// fused into one token, so it needs its own pattern
const DE_ELISION_RE = /^(d['’])(\p{L}.*)$/iu;
// "jusque" elides onto a following vowel-initial word with no space
// ("jusqu’au", "jusqu’à", "jusqu’aux", "jusqu’alors") - unlike "de"/"à"
// eliding directly onto the noun, the remainder here is itself another
// article/preposition ("au" = "à"+"le") that still needs its own forward
// search, so this is classified by re-checking the remainder rather than
// treated as a noun candidate the way DE_ELISION_RE's remainder is
const JUSQUE_ELISION_RE = /^(jusqu['’])(\p{L}.*)$/iu;
// a preceding word elided onto "un"/"une" with nothing after (e.g. "d’une", "qu’un") -
// the elided part (e.g. "d’") is not itself an article and is never highlighted
const TRAILING_ARTICLE_RE = /^(\p{L}+['’])(une?)$/iu;
// matches a raw occurrence that is itself capitalized (allowing for a
// leading elided prefix, e.g. "Qu'Esprit" hypothetically) - used only to
// tell whether THIS occurrence could be the dictionary's capitalized/name
// sense, not to exclude candidates outright
const CAPITALIZED_WORD_RE = /^[^\p{L}]*\p{Lu}/u;
const CLEAN_RE = /^[^\p{L}]+|[^\p{L}]+$/gu;
const VOWEL_START_RE = /^[aeiouyâàéèêëîïôöûüùœæh]/iu;
// strips a fused elided article/pronoun (l', d', qu', n', s', j', m', t',
// c') from the front of a word - needed because a word like "l'autorité"
// can show up as a lookahead CANDIDATE (not just as the primary trigger,
// which ELISION_RE/DE_ELISION_RE already handle), and the dictionary only
// has "autorité", not "l'autorité"
const LEADING_ELISION_RE = /^(?:l|d|qu|n|s|j|m|t|c)['’]/iu;
// strips the demonstrative reinforcement suffix from words like "ce
// monde-ci"/"cet homme-là" - the dictionary only has "monde"/"homme"
const TRAILING_CI_LA_RE = /-(ci|là)$/iu;
// a comma/semicolon/colon/sentence-ender right after a lookahead token
// means the noun phrase is over (e.g. "un conseiller, nommé Joseph" - the
// article's reach stops at "conseiller", so "nommé" must never be scanned
// as a candidate)
const CLAUSE_BREAK_RE = /[,;:.!?…]$/u;
// brackets end the noun phrase too: a closing one right after a lookahead
// token ("de Siloé)" - the token itself is still a candidate, same as with a
// comma), and an opening one right before it ("de Siloé _(nom_ qui signifie
// envoyé)" - the parenthetical is an aside, so the word inside it must never
// be scanned as a candidate; checked BEFORE the token is pushed). Trailing
// "_" italic markers are allowed after the closing bracket; the bracket
// characters themselves stay outside any highlight span, since
// extractHighlightSpan() already peels every non-letter off the noun
const CLOSING_BRACKET_RE = /[)\]}][^\p{L}]*$/u;
const OPENING_BRACKET_RE = /^[^\p{L}]*[(\[{]/u;
// a conjunction (or relative pronoun) starts a new clause, so a noun phrase
// can never reach past it ("vers le haut et dit" - "dit" is the next
// clause's verb, not part of "le haut"). The elided "qu’"/"lorsqu’"/
// "puisqu’" + vowel is the same word fused with what follows, so it is
// matched on the raw token. "si" is deliberately NOT here: besides the
// conjunction "if" it is the adverb in "une si grande tempête", right inside
// the noun phrase
const CLAUSE_BREAKING_CONJUNCTIONS = new Set([
  "et", "ou", "mais", "car", "donc", "que", "qui", "dont", "où",
  "comme", "quand", "lorsque", "puisque", "quoique",
]);
const ELIDED_CONJUNCTION_RE = /^(?:qu|lorsqu|puisqu|quoiqu)['’]/iu;
// nouns that are only trustworthy when found as the direct "l'" elision
// remainder (tokenIndex === i) - found at a distance they are almost
// always something else. "été" is usually the past participle of "être"
// ("a été" = "has been"), not the noun "l'été" (summer); Yandex doesn't
// even give it a gender as a noun, so the normal dictionary can't help
const ELISION_ONLY_NOUNS = { été: "m" };
// same idea, but only when a noun is guaranteed right there (a preposition
// before "l’", or the start of a sentence): "à l’est de la ville" is the noun
// "east" (Yandex gives it no gender), while "il ne l’est qu’un seul trait" is
// pronoun + verb and must stay unhighlighted
const ELISION_NOUNS_AFTER_PREPOSITION = { est: "m" };

function cleanWord(token) {
  return token
    .toLowerCase()
    .replace(CLEAN_RE, "")
    .replace(LEADING_ELISION_RE, "")
    .replace(TRAILING_CI_LA_RE, "");
}

// like cleanWord, but also unwraps "jusqu’au"/"jusqu’à"/"jusqu’aux" to the
// article/preposition they're fused with ("au"/"à"/"aux") - used wherever a
// classification decision needs the word a token actually behaves as,
// including when looking back at a *previous* token (e.g. "la" right after
// "jusqu’à" still needs the same mustBeNoun guarantee as plain "à la")
function effectiveWord(token) {
  const jusqueMatch = token.match(JUSQUE_ELISION_RE);
  return cleanWord(jusqueMatch ? jusqueMatch[2] : token);
}

const LEADING_ELISION_CAPTURE_RE = /^((?:l|d|qu|n|s|j|m|t|c)['’])/iu;

// splits a raw token into { prefix, core, suffix } so only the noun
// itself (`core`) ends up inside the highlight span - without this, a
// token like "l’angoisse" or "jours-là!" would have its fused elided
// article or demonstrative suffix wrapped in the span too. When there's
// no elision/suffix to peel off, `core` is just the original token
// (including any trailing punctuation), matching prior behavior exactly.
// Leading non-letters (an italic "_" marker, a quote) stay outside the span
// too, like the trailing ones
function extractHighlightSpan(rawToken) {
  const leadingPunct = rawToken.match(/^[^\p{L}]*/u)[0];
  let prefix = leadingPunct;
  let rest = rawToken.slice(leadingPunct.length);
  const leadMatch = rest.match(LEADING_ELISION_CAPTURE_RE);
  if (leadMatch) {
    prefix += leadMatch[1];
    rest = rest.slice(leadMatch[1].length);
  }
  const trailingPunctMatch = rest.match(/[^\p{L}]*$/u);
  const trailingPunct = trailingPunctMatch ? trailingPunctMatch[0] : "";
  const withoutPunct = trailingPunct ? rest.slice(0, rest.length - trailingPunct.length) : rest;
  const ciLaMatch = withoutPunct.match(TRAILING_CI_LA_RE);
  if (ciLaMatch) {
    const core = withoutPunct.slice(0, withoutPunct.length - ciLaMatch[0].length);
    return { prefix, core, suffix: ciLaMatch[0] + trailingPunct };
  }
  return { prefix, core: withoutPunct, suffix: trailingPunct };
}

// the singular form(s) a French plural could have come from: most take
// "-s", but "-eau"/"-eu"/"-ou" words take "-x" (genou -> genoux) and
// "-al" words become "-aux" (cheval -> chevaux). Both "-aux" readings are
// returned, since "château -> châteaux" also ends that way - whichever
// form the dictionary actually knows wins
function singularForms(word) {
  const forms = [];
  if (word.length < 2) return forms;
  if (word.endsWith("s") || word.endsWith("x")) {
    forms.push(word.slice(0, -1));
  }
  if (word.endsWith("aux")) {
    forms.push(`${word.slice(0, -3)}al`);
  }
  return forms;
}

// true when `wordCleaned` is grammatically filler right after `prevCleaned`
// rather than a noun, even if it has some rare noun sense in the dictionary
function isFillerAfter(prevCleaned, wordCleaned, cache) {
  // "de"/"à" + infinitive (e.g. "d’aller", "à porter") is handled at the
  // source: fetchGenderFromYandex() never returns a gender for a word that
  // also has a verb sense, so such words simply aren't in the gender map
  if (prevCleaned === "en" && wordCleaned.endsWith("ant")) return true; // gerund: "en descendant"
  // object pronoun + gerund ("en les tirant" = "drawing them") - the pronoun
  // itself is already excluded as a candidate elsewhere, but without this
  // the gerund right after it can still be picked up by a search that
  // started further back (e.g. "en" looking past "les" for a noun).
  // "le"/"la" followed by a noun that merely ends in "-ant" ("le néant") is
  // an article, though - when the cache knows the word as a noun, it is not
  // filler (the gender check still rejects "la" + a masculine noun). "les"
  // has no gender to check, so it keeps the cautious reading
  if (prevCleaned === "les" && wordCleaned.endsWith("ant")) {
    return true;
  }
  if (
    (prevCleaned === "le" || prevCleaned === "la") &&
    wordCleaned.endsWith("ant") &&
    !isKnownNoun(wordCleaned, cache)
  ) {
    return true;
  }
  return false;
}

// a trigger word reached mid-search means a fresh noun phrase is starting
// right there - the search that led up to it has no business reaching past
// it (e.g. "en" scanning for a noun must not continue through "au" to reach
// "sort"; "au" starts its own proper search instead)
function isTriggerWord(cleaned) {
  return (
    GENDER_ARTICLES.has(cleaned) ||
    PLURAL_ARTICLES.has(cleaned) ||
    PREPOSITION_TRIGGERS.has(cleaned)
  );
}

// capitalization is no longer a blanket exclusion: a proper noun ("Pierre")
// usually has no dictionary entry at all and is simply never matched, while
// a common noun that happens to be capitalized (mid-line sentence start
// after a colon/period, not just the first word of the line) should still
// be found via its lowercased dictionary entry. The one accepted tradeoff:
// a name that coincides with a real common noun (e.g. "Pierre"/"pierre")
// will get highlighted as that noun
function isExcludedCandidate(cleaned) {
  if (
    GENDER_ARTICLES.has(cleaned) ||
    PLURAL_ARTICLES.has(cleaned) ||
    STOPWORDS.has(cleaned) ||
    PREPOSITION_TRIGGERS.has(cleaned) ||
    EXCLUDED_NOUNS.has(cleaned)
  ) {
    return true;
  }
  return singularForms(cleaned).some((form) => EXCLUDED_NOUNS.has(form));
}

// returns { gender: "m"|"f", isAdjective } or undefined if `word` isn't
// known as a noun at all; `isAdjective` means it ALSO has an adjective
// sense, so it's a fallback candidate rather than an immediate match
function lookupGender(word, nounGender) {
  const direct = nounGender.get(word);
  if (direct) return direct;
  // the dictionary mostly stores singular forms - fall back to whichever
  // singular this plural could have come from, when the plural itself
  // isn't listed
  for (const form of singularForms(word)) {
    const entry = nounGender.get(form);
    if (entry) return entry;
  }
  return undefined;
}

// the cleaned word that follows the article at tokens[i] - for an elided
// "l’" that is the fused remainder of the same token
function followingWordOf(tokens, i, elisionMatch) {
  if (elisionMatch) return cleanWord(elisionMatch[2]);
  let nextIdx = i + 1;
  while (nextIdx < tokens.length && /^\s+$/.test(tokens[nextIdx])) nextIdx++;
  return nextIdx < tokens.length ? cleanWord(tokens[nextIdx]) : "";
}

// a capitalized token that opens a sentence: first word of the line (verse
// numbers like "25" in front of it don't count), or right after a
// sentence-ender / colon (direct speech: "dirent: Les ...")
function isSentenceStart(tokens, i) {
  if (!CAPITALIZED_WORD_RE.test(tokens[i])) return false;
  let prevIdx = i - 1;
  while (prevIdx >= 0 && (/^\s+$/.test(tokens[prevIdx]) || /^\d+$/.test(tokens[prevIdx]))) {
    prevIdx--;
  }
  return prevIdx < 0 || /[.!?…:»"]$/u.test(tokens[prevIdx]);
}

function findArticleInfo(tokens, i, cache) {
  const token = tokens[i];
  const elisionMatch = token.match(ELISION_RE);
  const trailingMatch = !elisionMatch && token.match(TRAILING_ARTICLE_RE);
  const deElisionMatchRaw =
    !elisionMatch && !trailingMatch && token.match(DE_ELISION_RE);
  // "d'aucun"/"d'aucune" - the elided "de" lands on ANOTHER determiner, not
  // directly on a noun ("d'épines" is "de" + noun, but "d'aucun homme" is
  // "de" + "aucun" + noun). When the remainder is itself a recognized
  // article, this must NOT be treated as noun fusion (which would both wrongly
  // offer the determiner itself as a noun candidate and, since "aucun" is
  // also a trigger word, end the search right there before ever reaching the
  // real noun that follows) - fall through and let "aucun" be classified as
  // a plain gender article instead, with its own normal forward lookahead
  const deElisionMatch =
    deElisionMatchRaw &&
    !GENDER_ARTICLES.has(cleanWord(deElisionMatchRaw[2])) &&
    !PLURAL_ARTICLES.has(cleanWord(deElisionMatchRaw[2]))
      ? deElisionMatchRaw
      : null;
  const jusqueElisionMatch =
    !elisionMatch && !trailingMatch && !deElisionMatch && token.match(JUSQUE_ELISION_RE);
  const cleanedToken = cleanWord(token);
  // "jusqu'au"/"jusqu'à"/"jusqu'aux" classify by their remainder ("au"/
  // "à"/"aux"), not by the fused "jusqu'..." spelling itself
  const effectiveToken = jusqueElisionMatch ? effectiveWord(token) : cleanedToken;

  // "le"/"la"/"les"/"l'" directly followed by a verb form can only be the
  // direct-object pronoun ("je l’ai trouvé", "en les tirant") - never the
  // article - since an article can never sit right in front of a bare verb.
  // Two sub-cases: a gerund (always "en" + pronoun + participe présent), or
  // any other recognized conjugated form (mostly auxiliaries right after
  // the pronoun, e.g. "l’ai", "la voit") - either way, skip the article
  // search entirely so nothing past the pronoun gets scanned as a noun
  if (elisionMatch) {
    const remainderCleaned = cleanWord(elisionMatch[2]);
    // "l'on" is a fixed euphonic spelling of the pronoun "on" (inserted
    // after "si"/"que"/"et"/etc. to avoid a vowel clash, e.g. "si l'on
    // veut") - the "l'" is not an elided article here at all, so nothing
    // after it should ever be scanned as a noun
    if (remainderCleaned === "on") {
      return null;
    }
    // an "-ant" word right after "l'" is a gerund after a pronoun ("en
    // l’entendant") - unless the cache already knows it as a noun ("l’enfant",
    // "l’intendant")
    if (
      isPureVerb(remainderCleaned, cache) ||
      (remainderCleaned.endsWith("ant") && !isKnownNoun(remainderCleaned, cache))
    ) {
      return null;
    }
  } else if (cleanedToken === "le" || cleanedToken === "la" || cleanedToken === "les") {
    let nextIdx = i + 1;
    while (nextIdx < tokens.length && /^\s+$/.test(tokens[nextIdx])) nextIdx++;
    const nextWord = nextIdx < tokens.length ? cleanWord(tokens[nextIdx]) : "";
    if (isPureVerb(nextWord, cache)) {
      return null;
    }
    if (nextWord.endsWith("ant")) {
      let prevIdx = i - 1;
      while (prevIdx >= 0 && /^\s+$/.test(tokens[prevIdx])) prevIdx--;
      const prevWord = prevIdx >= 0 ? cleanWord(tokens[prevIdx]) : "";
      if (prevWord === "en") {
        return null;
      }
    }
  }

  let outerPrefix = "";
  let articlePrefix = token;
  let articleRemainder = null;
  let isGenderArticle = false;
  let isPluralArticle = false;
  let isPrepositionTrigger = false;
  let expectedGender = null;

  if (elisionMatch) {
    articlePrefix = elisionMatch[1];
    articleRemainder = elisionMatch[2];
    isGenderArticle = true;
    // "l'" could be an elided "le" or "la" - gender is unknown until the
    // noun itself is found, so there is nothing to check agreement against
  } else if (trailingMatch) {
    outerPrefix = trailingMatch[1];
    articlePrefix = trailingMatch[2];
    isGenderArticle = true;
    expectedGender = ARTICLE_GENDER[articlePrefix.toLowerCase()];
  } else if (deElisionMatch) {
    // "de" elided onto a following vowel-initial word (e.g. "d’épines") -
    // same role as the "de" preposition trigger, just fused into one token
    articlePrefix = deElisionMatch[1];
    articleRemainder = deElisionMatch[2];
    isPrepositionTrigger = true;
  } else if (GENDER_ARTICLES.has(effectiveToken)) {
    isGenderArticle = true;
    expectedGender = ARTICLE_GENDER[effectiveToken];
  } else if (PLURAL_ARTICLES.has(effectiveToken)) {
    isPluralArticle = true;
  } else if (PREPOSITION_TRIGGERS.has(effectiveToken)) {
    isPrepositionTrigger = true;
  }

  if (!isGenderArticle && !isPluralArticle && !isPrepositionTrigger) {
    return null;
  }

  // is the word right behind this preposition trigger guaranteed to be a noun?
  // A fused "d’" is the preposition "de" even though effectiveToken is the
  // whole cleaned token ("épouvante" in "d’épouvante"). After "à"/"de"/
  // "par"/"pour"/"sans" only an INFINITIVE can be a verb ("sans force" vs
  // "sans dire", "d’épouvante" vs "d’aller"), so a word that does not look
  // like one is the noun
  const prepositionGuaranteesNoun = () => {
    const preposition = deElisionMatch ? "de" : effectiveToken;
    if (INFINITIVE_AFTER_PREPOSITIONS.has(preposition)) {
      return !isInfinitiveLike(followingWordOf(tokens, i, deElisionMatch), cache);
    }
    return NOUN_GUARANTEED_PREPOSITIONS.has(preposition);
  };

  // "du"/"au" (contracted "de"/"à" + "le"), "de la"/"à la", "un"/"une", and
  // "aucun"/"aucune" always introduce a noun phrase - unlike bare
  // "le"/"la", they can never be object pronouns - so when nothing better
  // is found afterward, even a verb-ambiguous word is trusted as a last
  // resort (see the isVerb fallback tier below)
  let mustBeNoun =
    effectiveToken === "du" ||
    effectiveToken === "au" ||
    effectiveToken === "un" ||
    effectiveToken === "une" ||
    effectiveToken === "aucun" ||
    effectiveToken === "aucune" ||
    NOUN_GUARANTEEING_DETERMINERS.has(effectiveToken) ||
    (isPrepositionTrigger && prepositionGuaranteesNoun());
  if (!mustBeNoun && (effectiveToken === "ce" || QUEL_FORMS.has(effectiveToken))) {
    let nextIdx = i + 1;
    while (nextIdx < tokens.length && /^\s+$/.test(tokens[nextIdx])) nextIdx++;
    const nextToken = nextIdx < tokens.length ? tokens[nextIdx] : "";
    const nextWord = cleanWord(nextToken);
    // a noun never carries an elided pronoun in front of it ("ce n’est",
    // "ce qu’il"), and a gerund ("ce disant", "ce faisant") is not one
    mustBeNoun =
      nextWord !== "" &&
      !LEADING_ELISION_CAPTURE_RE.test(nextToken) &&
      !nextWord.endsWith("ant") &&
      !CE_PRONOUN_VERBS.has(nextWord);
  }
  if (
    !mustBeNoun &&
    (elisionMatch ||
      cleanedToken === "la" ||
      cleanedToken === "le" ||
      cleanedToken === "les")
  ) {
    let prevIdx = i - 1;
    while (prevIdx >= 0 && /^\s+$/.test(tokens[prevIdx])) prevIdx--;
    const prevWord = prevIdx >= 0 ? effectiveWord(tokens[prevIdx]) : "";
    const following = followingWordOf(tokens, i, elisionMatch);
    mustBeNoun =
      NOUN_GUARANTEED_PREPOSITIONS.has(prevWord) ||
      (INFINITIVE_TAKING_PREPOSITIONS.has(prevWord) && !isInfinitiveLike(following, cache)) ||
      // an object pronoun is followed by a finite verb, an infinitive or a
      // present participle - never directly by a past participle (it goes
      // before the auxiliary: "je l’ai assemblée"), so "l’assemblée",
      // "la pensée" are nouns. Only the -é family: conjugated forms can end
      // in -i/-u/-s ("je le vois", "je les reçus")
      PAST_PARTICIPLE_ENDING_RE.test(following);
  }
  // "leur" is a possessive determiner ("dans leur bouche") but also the
  // invariable indirect-object pronoun ("il leur parle", "de leur parler").
  // The word BEFORE it tells them apart: right after a preposition it is the
  // determiner, unless an infinitive/participle follows ("de leur parler");
  // after a subject pronoun or a verb it is left alone, as before
  if (!mustBeNoun && effectiveToken === "leur") {
    let prevIdx = i - 1;
    while (prevIdx >= 0 && /^\s+$/.test(tokens[prevIdx])) prevIdx--;
    const prevWord = prevIdx >= 0 ? effectiveWord(tokens[prevIdx]) : "";
    mustBeNoun =
      (NOUN_GUARANTEED_PREPOSITIONS.has(prevWord) ||
        INFINITIVE_TAKING_PREPOSITIONS.has(prevWord)) &&
      !isInfinitiveLike(followingWordOf(tokens, i, null), cache);
  }
  // a capitalized "Le"/"La"/"Les"/"L’" opening a sentence is an article: an
  // object pronoun can only sit before a verb inside the clause, never start
  // a plain statement. The only starts that stay ambiguous are a present
  // participle ("Les voyant venir, ...") - an "-ant" word right after it
  // keeps the old cautious behaviour. (Infinitives and inverted questions
  // like "Les avez-vous vus?" need no special case: the word after the
  // pronoun there can't be a noun with a gender, so there is nothing to
  // wrongly highlight)
  if (
    !mustBeNoun &&
    (elisionMatch ||
      cleanedToken === "la" ||
      cleanedToken === "le" ||
      cleanedToken === "les") &&
    isSentenceStart(tokens, i)
  ) {
    mustBeNoun = !followingWordOf(tokens, i, elisionMatch).endsWith("ant");
  }

  const maxCandidates =
    isPrepositionTrigger && NARROW_PREPOSITIONS.has(effectiveToken) ? 1 : 3;
  const candidates = [];
  // tracks the previous non-whitespace "word", whether or not it became a
  // candidate, so filler right after "en"/"de"/"à" can be recognized even
  // when that trigger is itself just filler inside an unrelated search;
  // the fused "d’" elision counts as "de" even though cleanWord() can't
  // split it from the word it's fused to
  let prevCleaned = deElisionMatch ? "de" : effectiveToken;
  let clauseBroken = false;
  if (articleRemainder !== null) {
    const remainderCleaned = cleanWord(articleRemainder);
    // a gerund right after the trigger ends the search outright (it's not
    // just an unrelated word to skip past - "en"/"le"/"la"/"les" governing a
    // gerund means the whole phrase is a fixed construction with no noun to
    // find), same treatment as punctuation
    if (isFillerAfter(prevCleaned, remainderCleaned, cache)) {
      clauseBroken = true;
    } else {
      candidates.push({ word: articleRemainder, tokenIndex: i });
    }
    prevCleaned = remainderCleaned;
    clauseBroken =
      clauseBroken ||
      CLAUSE_BREAK_RE.test(articleRemainder) ||
      CLOSING_BRACKET_RE.test(articleRemainder) ||
      isTriggerWord(remainderCleaned) ||
      isPureVerb(remainderCleaned, cache);
  }
  let idx = i + 1;
  while (!clauseBroken && candidates.length < maxCandidates && idx < tokens.length) {
    if (!/^\s+$/.test(tokens[idx])) {
      if (OPENING_BRACKET_RE.test(tokens[idx])) {
        break;
      }
      const wordCleaned = cleanWord(tokens[idx]);
      if (
        CLAUSE_BREAKING_CONJUNCTIONS.has(wordCleaned) ||
        ELIDED_CONJUNCTION_RE.test(tokens[idx])
      ) {
        break;
      }
      if (isFillerAfter(prevCleaned, wordCleaned, cache)) {
        clauseBroken = true;
      } else {
        candidates.push({ word: tokens[idx], tokenIndex: idx });
      }
      prevCleaned = wordCleaned;
      if (
        CLAUSE_BREAK_RE.test(tokens[idx]) ||
        CLOSING_BRACKET_RE.test(tokens[idx]) ||
        isTriggerWord(wordCleaned) ||
        isPureVerb(wordCleaned, cache)
      ) {
        clauseBroken = true;
      }
    }
    idx++;
  }

  if (
    POSSESSIVE_VOWEL_EXCEPTION.has(cleanedToken) &&
    candidates.length > 0 &&
    VOWEL_START_RE.test(cleanWord(candidates[0].word))
  ) {
    expectedGender = null;
  }

  // true when the last candidate is also the last word of the phrase
  // (punctuation, a bracket, or the end of the line right after it) - only
  // then can an adjective-only word be the substantivized noun itself
  // ("d’un démoniaque;"), since nothing after it could be the real noun
  let phraseEnds = false;
  if (candidates.length > 0) {
    const last = candidates[candidates.length - 1];
    if (CLAUSE_BREAK_RE.test(last.word) || CLOSING_BRACKET_RE.test(last.word)) {
      phraseEnds = true;
    } else {
      let k = last.tokenIndex + 1;
      while (k < tokens.length && /^\s+$/.test(tokens[k])) k++;
      phraseEnds =
        k >= tokens.length ||
        OPENING_BRACKET_RE.test(tokens[k]) ||
        CLAUSE_BREAKING_CONJUNCTIONS.has(cleanWord(tokens[k])) ||
        ELIDED_CONJUNCTION_RE.test(tokens[k]);
    }
  }

  return {
    outerPrefix,
    articlePrefix,
    articleRemainder,
    isGenderArticle,
    expectedGender,
    candidates,
    mustBeNoun,
    phraseEnds,
  };
}

// candidates that COULD be an adjective used as the noun of the phrase
// ("le démoniaque avait été guéri", "d’un démoniaque;"): everything after
// the candidate inside the phrase is only a closed-class word or a pure verb
// (so nothing after it could be the real noun), or the phrase ends right
// there. Whether the word actually is an adjective with no noun sense is a
// separate dictionary check, done by the callers
function substantivizedCandidates(info, cache) {
  const { candidates, phraseEnds } = info;
  const result = [];
  for (let c = 0; c < candidates.length; c++) {
    const cleaned = cleanWord(candidates[c].word);
    if (!cleaned || isExcludedCandidate(cleaned) || cleaned in ELISION_ONLY_NOUNS) {
      continue;
    }
    const followers = candidates.slice(c + 1);
    const nothingFollows = followers.every((f) => {
      const followerCleaned = cleanWord(f.word);
      return isExcludedCandidate(followerCleaned) || isPureVerb(followerCleaned, cache);
    });
    if (nothingFollows && (followers.length > 0 || phraseEnds)) {
      result.push(candidates[c]);
    }
  }
  return result;
}

function highlightNounGender(line, nounGender, cache) {
  const tokens = line.split(/(\s+)/);
  const result = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const info = findArticleInfo(tokens, i, cache);

    if (!info) {
      result.push(token);
      i++;
      continue;
    }

    const {
      outerPrefix,
      articlePrefix,
      articleRemainder,
      expectedGender,
      candidates,
      mustBeNoun,
    } = info;
    const isTout = TOUT_FORMS.has(cleanWord(articlePrefix));

    let matchedGender = null;
    let matchedCandidate = null;
    let fallbackGender = null;
    let fallbackCandidate = null;
    let fallbackUntagged = false;
    let verbFallbackGender = null;
    let verbFallbackCandidate = null;
    for (const candidate of candidates) {
      const cleaned = cleanWord(candidate.word);
      // a determiner or other closed-class word can't itself be the noun -
      // skip it so an unrelated search can't swallow it as a false match
      if (isExcludedCandidate(cleaned)) {
        continue;
      }
      if (cleaned in ELISION_ONLY_NOUNS) {
        if (candidate.tokenIndex === i) {
          matchedGender = ELISION_ONLY_NOUNS[cleaned];
          matchedCandidate = candidate;
          break;
        }
        continue; // found at a distance - never trust it (see comment above)
      }
      if (
        cleaned in ELISION_NOUNS_AFTER_PREPOSITION &&
        candidate.tokenIndex === i &&
        mustBeNoun
      ) {
        matchedGender = ELISION_NOUNS_AFTER_PREPOSITION[cleaned];
        matchedCandidate = candidate;
        break;
      }
      const foundEntry = lookupGender(cleaned, nounGender);
      const rawEntry = foundEntry && effectiveEntry(foundEntry, expectedGender);
      if (!rawEntry) {
        continue;
      }
      // this exact occurrence is capitalized, and the dictionary also
      // recognizes a capitalized sense for the word (a name) - can't tell
      // from the text alone which sense is meant here, so skip it
      if (rawEntry.hasCapitalizedVariant && CAPITALIZED_WORD_RE.test(candidate.word)) {
        continue;
      }
      // Yandex doesn't tag these as adjectives at all (see
      // UNTAGGED_ADJECTIVE_WORDS) - treat them as ambiguous regardless, so the
      // search keeps looking for the real noun that follows ("troisième
      // jour" -> "jour", not "troisième" itself)
      const entry = UNTAGGED_ADJECTIVE_WORDS.has(cleaned)
        ? { ...rawEntry, isAdjective: true }
        : rawEntry;
      if (!entry.isAdjective && !entry.isVerb) {
        matchedGender = entry.gender;
        matchedCandidate = candidate;
        break;
      }
      if (entry.isVerb) {
        // normally an infinitive doesn't reliably follow an article, so
        // this is untrustworthy - except right after "du"/"au"/"de la"/
        // "à la", where a noun is grammatically guaranteed and this may
        // be the only candidate available at all
        // the FIRST such candidate wins: right after a determiner the head
        // noun is the word closest to it, anything further along ("ma force
        // est épuisée" -> "est", the noun "east") is something else
        // ...and a form of être/avoir only counts when it is the FIRST word
        // after the article ("à l’est"): further along it is the verb of the
        // clause ("le maître est ici")
        if (
          mustBeNoun &&
          !verbFallbackCandidate &&
          (!AUXILIARY_VERB_FORMS.has(cleaned) || candidate === candidates[0])
        ) {
          verbFallbackGender = entry.gender;
          verbFallbackCandidate = candidate;
        }
        continue;
      }
      // also usable as an adjective (e.g. "grand") - keep looking for a
      // later word that's unambiguously the noun, but remember this one
      // (preferring the latest such candidate) in case nothing better turns up
      if (isTout) {
        continue; // "tous purs": a predicate adjective, see TOUT_FORMS
      }
      fallbackGender = entry.gender;
      fallbackCandidate = candidate;
      fallbackUntagged = UNTAGGED_ADJECTIVE_WORDS.has(cleaned);
    }

    // a verb-ambiguous word that comes AFTER an untagged adjective ("un tel
    // pouvoir") inside a guaranteed noun phrase must be the head noun - such
    // a word is never the noun itself, and a verb can't follow the adjective
    // there. Deliberately NOT done for a dictionary adjective that is also a
    // real noun ("le maître garde": "maître" is the noun, "garde" the verb) -
    // those keep the closer word, as before
    if (
      !matchedCandidate &&
      verbFallbackCandidate &&
      fallbackCandidate &&
      fallbackUntagged &&
      verbFallbackCandidate.tokenIndex > fallbackCandidate.tokenIndex
    ) {
      matchedGender = verbFallbackGender;
      matchedCandidate = verbFallbackCandidate;
    }
    if (!matchedCandidate && fallbackCandidate) {
      matchedGender = fallbackGender;
      matchedCandidate = fallbackCandidate;
    }
    if (!matchedCandidate && verbFallbackCandidate) {
      matchedGender = verbFallbackGender;
      matchedCandidate = verbFallbackCandidate;
    }
    // last resort: nothing in the phrase is a noun, and its final word is an
    // adjective the dictionary has no noun sense for ("d’un démoniaque;") -
    // it can only be the adjective used as a noun, and the article says which
    // gender. Never for an elided "l’"/plural article (no gender to read)
    if (!matchedCandidate && expectedGender && !isTout) {
      for (const candidate of substantivizedCandidates(info, cache)) {
        const cleaned = cleanWord(candidate.word);
        const cached = cleaned in cache ? normalizeCacheEntry(cache[cleaned]) : null;
        if (
          cached &&
          cached.isAdjectiveOnly &&
          !(cached.hasCapitalizedVariant && CAPITALIZED_WORD_RE.test(candidate.word))
        ) {
          matchedGender = expectedGender;
          matchedCandidate = candidate;
          break;
        }
      }
    }

    if (!matchedGender) {
      result.push(token);
      i++;
      continue;
    }

    if (matchedCandidate.tokenIndex === i) {
      // the noun is the elision remainder itself ("l'" + noun) - only the
      // noun part is highlighted, never the article (and never a trailing
      // "-ci"/"-là" or punctuation that may have come along with it)
      const { core: remainderCore, suffix: remainderSuffix } =
        extractHighlightSpan(articleRemainder);
      result.push(articlePrefix);
      result.push(`<span class="${matchedGender}">${remainderCore}</span>`);
      result.push(remainderSuffix);
      i++;
    } else {
      // only the noun is highlighted - articles are never highlighted
      // themselves (too many false positives: "le"/"la" are often pronouns,
      // not articles, and the lookahead can land on an unrelated noun)
      result.push(outerPrefix);
      result.push(articlePrefix);
      if (articleRemainder !== null) {
        result.push(articleRemainder);
      }
      i++;
      while (i < matchedCandidate.tokenIndex) {
        result.push(tokens[i]);
        i++;
      }
      const { prefix: nounPrefix, core: nounCore, suffix: nounSuffix } =
        extractHighlightSpan(tokens[matchedCandidate.tokenIndex]);
      result.push(nounPrefix);
      result.push(`<span class="${matchedGender}">${nounCore}</span>`);
      result.push(nounSuffix);
      i = matchedCandidate.tokenIndex + 1;
    }
  }
  return result.join("");
}

function collectUnresolvedWords(line, nounGender, unresolved, cache) {
  const tokens = line.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i++) {
    const info = findArticleInfo(tokens, i, cache);
    if (!info) continue;

    for (const candidate of info.candidates) {
      const cleaned = cleanWord(candidate.word);
      if (isExcludedCandidate(cleaned)) {
        continue;
      }
      if (cleaned in ELISION_ONLY_NOUNS) {
        if (candidate.tokenIndex === i) break; // resolved - see ELISION_ONLY_NOUNS
        continue; // found at a distance - never trust it
      }
      const foundEntry = lookupGender(cleaned, nounGender);
      if (foundEntry) {
        // an old genderless noun entry doesn't say whether it is also an
        // adjective - re-check it (the word itself, or its singular)
        for (const key of [cleaned, ...singularForms(cleaned)]) {
          if (key in cache && lacksGenderlessAdjectiveInfo(cache[key])) {
            unresolved.add(key);
          }
        }
        const rawEntry = effectiveEntry(foundEntry, info.expectedGender);
        if (!rawEntry) {
          continue; // found but doesn't fit the article - not a dictionary gap
        }
        // see UNTAGGED_ADJECTIVE_WORDS - Yandex tags these as plain nouns, but
        // highlightNounGender treats them as ambiguous and keeps searching,
        // so this must match that or a later unresolved word in the same
        // chain (e.g. "jour" in "troisième jour") never gets queued
        const entry = UNTAGGED_ADJECTIVE_WORDS.has(cleaned)
          ? { ...rawEntry, isAdjective: true }
          : rawEntry;
        if (!entry.isAdjective && !entry.isVerb) {
          break; // unambiguous match found - highlightNounGender would stop here too
        }
        // ambiguous (adjective) or verb-only (last-resort fallback when
        // mustBeNoun) - either way it's already resolved, not a dictionary gap
        continue;
      }
      if (cleaned) {
        unresolved.add(cleaned);
      }
    }
    // the adjective-only last resort in highlightNounGender needs the
    // `isAdjectiveOnly` flag, which older cache entries predate - look the
    // phrase-final word up again, but only here (not for every cached word)
    // the word right after a trigger decides the infinitive checks (see
    // isInfinitiveLike), so an old entry that doesn't say whether it is an
    // infinitive is looked up again
    const firstCandidate = info.candidates[0];
    if (firstCandidate) {
      const cleaned = cleanWord(firstCandidate.word);
      if (cleaned in cache && lacksInfinitiveInfo(cache[cleaned])) {
        unresolved.add(cleaned);
      }
    }
    if (info.expectedGender) {
      for (const candidate of substantivizedCandidates(info, cache)) {
        const cleaned = cleanWord(candidate.word);
        if (cleaned in cache && lacksAdjectiveInfo(cache[cleaned])) {
          unresolved.add(cleaned);
        }
      }
    }
  }
}

const GENDER_CACHE_PATH = "./src/fr/noun_gender_cache.json";

function loadGenderCache() {
  try {
    return JSON.parse(fs.readFileSync(GENDER_CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

// the cache is rewritten after every chapter, and on Windows an antivirus
// scan or an editor's file watcher can briefly hold the file right after a
// write, making the next open fail with an UNKNOWN error - a short retry is
// enough, and failing the whole multi-minute build over it is not worth it
function saveGenderCache(cache) {
  const json = JSON.stringify(cache, null, 2);
  const MAX_ATTEMPTS = 10;
  for (let attempt = 1; ; attempt++) {
    try {
      fs.writeFileSync(GENDER_CACHE_PATH, json);
      return;
    } catch (e) {
      if (attempt >= MAX_ATTEMPTS) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * attempt);
    }
  }
}

async function getYandexJson(word) {
  const url = new URL(
    "https://dictionary.yandex.net/dicservice.json/lookupMultiple",
  );
  url.searchParams.set("ui", "ru");
  url.searchParams.set("lang", "fr-ru");
  url.searchParams.set("dict", "fr-ru.regular");
  url.searchParams.set("type", "regular");
  url.searchParams.set("flags", "15783");
  url.searchParams.set("srv", "tr-text");
  url.searchParams.set("text", word);
  const response = await fetch(url);
  return response.json();
}

// manual corrections for words where Yandex itself returns the wrong
// gender, or (like "feu") a real but vanishingly rare second sense ("feu
// mon père" = my late father) that makes the fallback-chain wrongly skip
// past the common noun reading ("feu" = fire) to an unrelated later word
const GENDER_OVERRIDES = { pierre: "f", feu: "m", conseiller: "m", corde: "f" };

// returns { gender: "m"|"f"|null, isAdjective: boolean, isVerb: boolean,
// isNoun: boolean } for the cache. `isNoun` is true whenever Yandex lists a
// noun entry for the word - even without a gender ("joue" = cheek is tagged
// "nn" with no "gen" at all), in which case the gender is read off the
// article at the point of use instead (see effectiveEntry)
async function fetchGenderFromYandex(word) {
  const json = await getYandexJson(word);
  const regular = json["fr-ru"]?.["regular"] ?? [];
  // Yandex sometimes answers with a related/suggested word instead of the
  // one asked for (e.g. querying "devant" also returns a "devoir" entry) -
  // only entries for the exact word asked about are meaningful for GENDER.
  // A plural query (e.g. "sièges") normalizes to the singular lemma in
  // Yandex's response ("siège"), so that's accepted too.
  // Case must match exactly (not just case-insensitively): a place/person
  // name queried lowercase (e.g. "jérusalem") comes back under its own
  // entry spelled "Jérusalem" with no separate lowercase entry at all - that
  // capitalization is the dictionary's only spelling, not incidental, and
  // means there is no common-noun sense to report at all
  const lower = word.toLowerCase();
  const singulars = singularForms(lower);
  const entries = regular.filter((it) => {
    const text = it.text;
    return text === lower || singulars.includes(text);
  });
  // a capitalized instance in the source text (e.g. "Pierre"/"Jean"/"Lot")
  // is only ever highlighted as the common noun when the dictionary has NO
  // separate capitalized entry at all - if it does (even alongside a
  // genuine lowercase sense, like "pierre"/"Pierre" = stone/Pierre), that
  // confirms the word is also a recognized name, and there is no way to
  // tell from the text alone which sense this particular capitalized
  // instance means, so it's left unhighlighted rather than guessed at
  const hasCapitalizedVariant = regular.some((it) => {
    if (!it.text) return false;
    const textLower = it.text.toLowerCase();
    const matchesWord = textLower === lower || singulars.includes(textLower);
    return matchesWord && it.text !== textLower;
  });
  const noun = entries.find((it) => it.pos?.code === "nn");
  const gen = noun?.gen?.code;
  const gender = gen === "m" || gen === "f" ? gen : null;
  const isNoun = noun !== undefined;
  // also for a noun entry WITHOUT a gender ("vrai": adj + adv + nn with no
  // "gen"): it is used with the gender of the article, so it must still
  // count as ambiguous - otherwise "le vrai cep" stops at "vrai" and never
  // reaches the real noun
  const isAdjective = isNoun && entries.some((it) => it.pos?.code === "adj");
  // an adjective with no noun entry at all ("démoniaque") - can still be
  // the noun of a phrase when used substantivally ("d’un démoniaque")
  const isAdjectiveOnly = !isNoun && entries.some((it) => it.pos?.code === "adj");
  // a word that Yandex also lists as a verb ("vrb") is normally treated as
  // not a noun at all, even when it has a rare noun sense too (e.g.
  // "porter", "aller") - an infinitive doesn't reliably follow an article
  // the way an adjective does. The gender is still kept (tagged isVerb)
  // rather than discarded, for the rare case where a noun is grammatically
  // guaranteed (e.g. right after "du"/"au"/"de la"/"à la") and this is the
  // only candidate available.
  // Unlike gender/adjective, this checks the UNFILTERED response: a
  // conjugated form ("ai", "trouvé") comes back under its infinitive
  // ("avoir", "trouver") in `text`, which the exact-match filter above
  // would otherwise discard - that's a legitimate lemma normalization, not
  // an unrelated suggestion the way gender detection needs to guard against
  const isVerb = regular.some((it) => it.pos?.code === "vrb");
  // the word IS an infinitive when its verb entry is the word itself ("aller"
  // -> "aller"); a conjugated form or a noun that merely looks like one comes
  // back under a different lemma ("livre" -> "livrer", "assemblée" ->
  // "assembler"). Also unfiltered, for the same reason as isVerb
  const isInfinitive = regular.some((it) => it.pos?.code === "vrb" && it.text === lower);
  // check the override against the plural too (e.g. querying "pierres"
  // still needs the "pierre" override), not just the exact word queried
  const overrideKey =
    lower in GENDER_OVERRIDES
      ? lower
      : (singulars.find((form) => form in GENDER_OVERRIDES) ?? null);
  if (overrideKey) {
    return {
      gender: GENDER_OVERRIDES[overrideKey],
      isAdjective: false,
      isVerb: false,
      isNoun: true,
      isAdjectiveOnly: false,
      isInfinitive: false,
      isAdjectiveChecked: true,
      hasCapitalizedVariant,
    };
  }
  if (isVerb) {
    return {
      gender,
      isAdjective: false,
      isVerb: true,
      isNoun,
      isAdjectiveOnly,
      isInfinitive,
      isAdjectiveChecked: true,
      hasCapitalizedVariant,
    };
  }
  return {
    gender,
    isAdjective,
    isVerb: false,
    isNoun,
    isAdjectiveOnly,
    isInfinitive: false,
    isAdjectiveChecked: true,
    hasCapitalizedVariant,
  };
}

// a genderless noun entry written before the adjective sense was checked for
// such entries ("vrai"): whether it is also an adjective is unknown, so it is
// looked up again when it turns up as a candidate (not a reason to distrust
// the entry elsewhere)
function lacksGenderlessAdjectiveInfo(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !value.gender &&
    value.isNoun === true &&
    value.isAdjectiveChecked === undefined
  );
}

const FETCH_CONCURRENCY = 6;

async function resolveMissingGenders(unresolvedWords, cache) {
  const toFetch = [...unresolvedWords].filter(
    (word) =>
      !(word in cache) ||
      isStaleCacheEntry(cache[word]) ||
      lacksAdjectiveInfo(cache[word]) ||
      lacksInfinitiveInfo(cache[word]) ||
      lacksGenderlessAdjectiveInfo(cache[word]),
  );
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < toFetch.length) {
      const word = toFetch[nextIndex++];
      try {
        cache[word] = await fetchGenderFromYandex(word);
      } catch (e) {
        console.error(`Yandex lookup failed for "${word}": ${e.message}`);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, toFetch.length) }, worker),
  );
}

// older cache entries are a bare "m"/"f"/null string (from before
// isAdjective was tracked) or lack isVerb (from before verb/noun ambiguity
// was tracked separately) - normalize to the full shape
function normalizeCacheEntry(value) {
  const raw = typeof value === "string" || value === null ? { gender: value } : value;
  return {
    gender: raw.gender,
    isAdjective: raw.isAdjective ?? false,
    isVerb: raw.isVerb ?? false,
    isNoun: raw.isNoun ?? false,
    isAdjectiveOnly: raw.isAdjectiveOnly ?? false,
    isInfinitive: raw.isInfinitive ?? false,
    hasCapitalizedVariant: raw.hasCapitalizedVariant ?? false,
  };
}

// a verb entry written before isInfinitive was tracked - whether it IS the
// infinitive is unknown, so it is looked up again when it turns up right
// after a trigger (like lacksAdjectiveInfo, not a reason to distrust the
// entry elsewhere). Entries with no verb sense can't be infinitives
function lacksInfinitiveInfo(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    value.isVerb === true &&
    value.isInfinitive === undefined
  );
}

// a genderless non-noun entry written before isAdjectiveOnly was tracked -
// unlike isStaleCacheEntry this is NOT a reason to distrust the entry
// elsewhere (isPureVerb etc. stay correct), only to re-check it when it is
// the final word of a phrase
function lacksAdjectiveInfo(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !value.gender &&
    value.isNoun === false &&
    value.isAdjectiveOnly === undefined
  );
}

// a genderless entry written before isNoun was tracked - there's no way to
// tell whether Yandex had a (genderless) noun entry for it, so it has to be
// looked up again the next time it turns up as a candidate
function isStaleCacheEntry(value) {
  if (value === null || typeof value !== "object") return true;
  return !value.gender && value.isNoun === undefined;
}

// a noun with no gender of its own can still be used when the article
// supplies it ("à la joue" -> feminine); with no article gender to go on
// (plural article, elided "l'") it can't be told apart, so it's skipped.
// Returns null when the entry doesn't fit the article
function effectiveEntry(entry, expectedGender) {
  if (!entry.gender) {
    return expectedGender ? { ...entry, gender: expectedGender } : null;
  }
  if (expectedGender && entry.gender !== expectedGender) return null;
  return entry;
}

function mergeGenderMap(baseMap, cache) {
  const merged = new Map(baseMap);
  for (const [word, value] of Object.entries(cache)) {
    if (merged.has(word)) continue;
    const entry = normalizeCacheEntry(value);
    if (entry.gender === "m" || entry.gender === "f" || entry.isNoun) {
      merged.set(word, entry);
    }
  }
  return merged;
}

// true only when the cache has already confirmed `word` resolves to a verb
// with no competing noun sense at all - used to tell a direct-object
// pronoun ("le"/"la"/"les"/"l’") apart from the identical-looking article,
// since only a pronoun can sit directly in front of a verb. Returns false
// (not yet certain) for a word the cache hasn't seen yet, same as for a
// word confirmed NOT to be a pure verb - either way the article search
// proceeds as normal, and collectUnresolvedWords queues the word for a
// Yandex lookup via the ordinary candidate-gathering path so a later build
// pass (once cached) can make the correct call
// true when the cache has confirmed `word` as a noun (with a gender, or a
// genderless noun entry) - see isStaleCacheEntry for why an old entry
// without that information can't be trusted either way
// true when `word` is an infinitive - taken from the dictionary (the verb
// entry Yandex returns for it is the word itself: "aller", "manger", "vivre";
// for "livre"/"œuvre"/"épouvante" it is a different lemma: "livrer"/
// "œuvrer"/"épouvanter") - or a present participle ("-ant"). An unknown word
// counts as not an infinitive; collectUnresolvedWords queues the word right
// after a trigger so a later pass knows
function isInfinitiveLike(word, cache) {
  if (word.endsWith("ant")) return true;
  if (!(word in cache)) return false;
  return normalizeCacheEntry(cache[word]).isInfinitive;
}

function isKnownNoun(word, cache) {
  if (!(word in cache) || isStaleCacheEntry(cache[word])) return false;
  const entry = normalizeCacheEntry(cache[word]);
  return entry.gender === "m" || entry.gender === "f" || entry.isNoun;
}

function isPureVerb(word, cache) {
  if (!(word in cache) || isStaleCacheEntry(cache[word])) return false;
  const entry = normalizeCacheEntry(cache[word]);
  return entry.isVerb && entry.gender === null && !entry.isNoun;
}

// every noun's gender comes from a live Yandex metadata check (gender +
// adjective/verb ambiguity) via the cache below - no static word list is
// trusted blindly, since all_nouns.js turned out to contain at least one
// bad entry ("aller") that bypassed ambiguity detection entirely
const nounGenderMap = new Map();

module.exports = {
  nounGenderMap,
  loadGenderCache,
  saveGenderCache,
  collectUnresolvedWords,
  resolveMissingGenders,
  mergeGenderMap,
  highlightNounGender,
};
