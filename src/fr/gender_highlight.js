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
  "quelque",
]);
// "de"/"à" get the same 3-word adjective lookahead as articles (e.g. "de
// haute naissance", "à haute voix") - the other prepositions stay at 1
// word, since they were not reported to need it and a wider window raises
// false-positive risk
const NARROW_PREPOSITIONS = new Set([
  "entre", "sans", "par", "sur", "avec", "chaque", "pour", "quelque",
]);
// most noun/verb and noun/adjective ambiguity (e.g. "grand", "porter") is
// detected from Yandex's own part-of-speech data instead (see
// fetchGenderFromYandex) - these are left here only because the metadata
// doesn't (yet) catch them: "combien"/"ensemble"/"devant" are
// adverb-dominant, not adjective-dominant, so the fallback-chain doesn't
// apply to them; "haut"/"haute" is a genuine Yandex data gap - querying
// the inflected form "haute" alone doesn't surface the "haut" adjective
// sense it belongs with
const EXCLUDED_NOUNS = new Set([
  "combien", "ensemble", "devant", "haut", "haute", "peu", "plusieurs",
]);
// case-insensitive: "L’heure" at the start of a sentence is the same
// elided article as "l’heure" mid-sentence
const ELISION_RE = /^(l['’])(\p{L}.*)$/iu;
// "de" elides onto a directly-following vowel-initial word with no space
// (e.g. "d’épines") - same role as the PREPOSITION_TRIGGERS "de", but
// fused into one token, so it needs its own pattern
const DE_ELISION_RE = /^(d['’])(\p{L}.*)$/iu;
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
// nouns that are only trustworthy when found as the direct "l'" elision
// remainder (tokenIndex === i) - found at a distance they are almost
// always something else. "été" is usually the past participle of "être"
// ("a été" = "has been"), not the noun "l'été" (summer); Yandex doesn't
// even give it a gender as a noun, so the normal dictionary can't help
const ELISION_ONLY_NOUNS = { été: "m" };

function cleanWord(token) {
  return token
    .toLowerCase()
    .replace(CLEAN_RE, "")
    .replace(LEADING_ELISION_RE, "")
    .replace(TRAILING_CI_LA_RE, "");
}

const LEADING_ELISION_CAPTURE_RE = /^((?:l|d|qu|n|s|j|m|t|c)['’])/iu;

// splits a raw token into { prefix, core, suffix } so only the noun
// itself (`core`) ends up inside the highlight span - without this, a
// token like "l’angoisse" or "jours-là!" would have its fused elided
// article or demonstrative suffix wrapped in the span too. When there's
// no elision/suffix to peel off, `core` is just the original token
// (including any trailing punctuation), matching prior behavior exactly
function extractHighlightSpan(rawToken) {
  let prefix = "";
  let rest = rawToken;
  const leadMatch = rest.match(LEADING_ELISION_CAPTURE_RE);
  if (leadMatch) {
    prefix = leadMatch[1];
    rest = rest.slice(prefix.length);
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
function isFillerAfter(prevCleaned, wordCleaned) {
  // "de"/"à" + infinitive (e.g. "d’aller", "à porter") is handled at the
  // source: fetchGenderFromYandex() never returns a gender for a word that
  // also has a verb sense, so such words simply aren't in the gender map
  if (prevCleaned === "en" && wordCleaned.endsWith("ant")) return true; // gerund: "en descendant"
  // object pronoun + gerund ("en les tirant" = "drawing them") - the pronoun
  // itself is already excluded as a candidate elsewhere, but without this
  // the gerund right after it can still be picked up by a search that
  // started further back (e.g. "en" looking past "les" for a noun)
  if ((prevCleaned === "le" || prevCleaned === "la" || prevCleaned === "les") && wordCleaned.endsWith("ant")) {
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

function findArticleInfo(tokens, i, cache) {
  const token = tokens[i];
  const elisionMatch = token.match(ELISION_RE);
  const trailingMatch = !elisionMatch && token.match(TRAILING_ARTICLE_RE);
  const deElisionMatch =
    !elisionMatch && !trailingMatch && token.match(DE_ELISION_RE);
  const cleanedToken = cleanWord(token);

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
    if (isPureVerb(remainderCleaned, cache) || remainderCleaned.endsWith("ant")) {
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
  } else if (GENDER_ARTICLES.has(cleanedToken)) {
    isGenderArticle = true;
    expectedGender = ARTICLE_GENDER[cleanedToken];
  } else if (PLURAL_ARTICLES.has(cleanedToken)) {
    isPluralArticle = true;
  } else if (PREPOSITION_TRIGGERS.has(cleanedToken)) {
    isPrepositionTrigger = true;
  }

  if (!isGenderArticle && !isPluralArticle && !isPrepositionTrigger) {
    return null;
  }

  // "du"/"au" (contracted "de"/"à" + "le"), "de la"/"à la", and
  // "aucun"/"aucune" always introduce a noun phrase - unlike bare
  // "le"/"la", they can never be object pronouns - so when nothing better
  // is found afterward, even a verb-ambiguous word is trusted as a last
  // resort (see the isVerb fallback tier below)
  let mustBeNoun =
    cleanedToken === "du" ||
    cleanedToken === "au" ||
    cleanedToken === "aucun" ||
    cleanedToken === "aucune";
  if (!mustBeNoun && cleanedToken === "la") {
    let prevIdx = i - 1;
    while (prevIdx >= 0 && /^\s+$/.test(tokens[prevIdx])) prevIdx--;
    const prevWord = prevIdx >= 0 ? cleanWord(tokens[prevIdx]) : "";
    mustBeNoun = prevWord === "de" || prevWord === "à";
  }

  const maxCandidates =
    isPrepositionTrigger && NARROW_PREPOSITIONS.has(cleanedToken) ? 1 : 3;
  const candidates = [];
  // tracks the previous non-whitespace "word", whether or not it became a
  // candidate, so filler right after "en"/"de"/"à" can be recognized even
  // when that trigger is itself just filler inside an unrelated search;
  // the fused "d’" elision counts as "de" even though cleanWord() can't
  // split it from the word it's fused to
  let prevCleaned = deElisionMatch ? "de" : cleanedToken;
  let clauseBroken = false;
  if (articleRemainder !== null) {
    const remainderCleaned = cleanWord(articleRemainder);
    // a gerund right after the trigger ends the search outright (it's not
    // just an unrelated word to skip past - "en"/"le"/"la"/"les" governing a
    // gerund means the whole phrase is a fixed construction with no noun to
    // find), same treatment as punctuation
    if (isFillerAfter(prevCleaned, remainderCleaned)) {
      clauseBroken = true;
    } else {
      candidates.push({ word: articleRemainder, tokenIndex: i });
    }
    prevCleaned = remainderCleaned;
    clauseBroken =
      clauseBroken ||
      CLAUSE_BREAK_RE.test(articleRemainder) ||
      isTriggerWord(remainderCleaned);
  }
  let idx = i + 1;
  while (!clauseBroken && candidates.length < maxCandidates && idx < tokens.length) {
    if (!/^\s+$/.test(tokens[idx])) {
      const wordCleaned = cleanWord(tokens[idx]);
      if (isFillerAfter(prevCleaned, wordCleaned)) {
        clauseBroken = true;
      } else {
        candidates.push({ word: tokens[idx], tokenIndex: idx });
      }
      prevCleaned = wordCleaned;
      if (CLAUSE_BREAK_RE.test(tokens[idx]) || isTriggerWord(wordCleaned)) {
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

  return {
    outerPrefix,
    articlePrefix,
    articleRemainder,
    isGenderArticle,
    expectedGender,
    candidates,
    mustBeNoun,
  };
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

    let matchedGender = null;
    let matchedCandidate = null;
    let fallbackGender = null;
    let fallbackCandidate = null;
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
      const entry = lookupGender(cleaned, nounGender);
      if (!entry || (expectedGender && entry.gender !== expectedGender)) {
        continue;
      }
      // this exact occurrence is capitalized, and the dictionary also
      // recognizes a capitalized sense for the word (a name) - can't tell
      // from the text alone which sense is meant here, so skip it
      if (entry.hasCapitalizedVariant && CAPITALIZED_WORD_RE.test(candidate.word)) {
        continue;
      }
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
        if (mustBeNoun) {
          verbFallbackGender = entry.gender;
          verbFallbackCandidate = candidate;
        }
        continue;
      }
      // also usable as an adjective (e.g. "grand") - keep looking for a
      // later word that's unambiguously the noun, but remember this one
      // (preferring the latest such candidate) in case nothing better turns up
      fallbackGender = entry.gender;
      fallbackCandidate = candidate;
    }

    if (!matchedCandidate && fallbackCandidate) {
      matchedGender = fallbackGender;
      matchedCandidate = fallbackCandidate;
    }
    if (!matchedCandidate && verbFallbackCandidate) {
      matchedGender = verbFallbackGender;
      matchedCandidate = verbFallbackCandidate;
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
      const entry = lookupGender(cleaned, nounGender);
      if (entry) {
        if (info.expectedGender && entry.gender !== info.expectedGender) {
          continue; // found but gender mismatches the article - not a dictionary gap
        }
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

function saveGenderCache(cache) {
  fs.writeFileSync(GENDER_CACHE_PATH, JSON.stringify(cache, null, 2));
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
const GENDER_OVERRIDES = { pierre: "f", feu: "m", conseiller: "m" };

// returns { gender: "m"|"f"|null, isAdjective: boolean, isVerb: boolean } for
// the cache
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
  const isAdjective = gender !== null && entries.some((it) => it.pos?.code === "adj");
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
      hasCapitalizedVariant,
    };
  }
  if (isVerb) {
    return { gender, isAdjective: false, isVerb: true, hasCapitalizedVariant };
  }
  return { gender, isAdjective, isVerb: false, hasCapitalizedVariant };
}

const FETCH_CONCURRENCY = 6;

async function resolveMissingGenders(unresolvedWords, cache) {
  const toFetch = [...unresolvedWords].filter((word) => !(word in cache));
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
    hasCapitalizedVariant: raw.hasCapitalizedVariant ?? false,
  };
}

function mergeGenderMap(baseMap, cache) {
  const merged = new Map(baseMap);
  for (const [word, value] of Object.entries(cache)) {
    if (merged.has(word)) continue;
    const entry = normalizeCacheEntry(value);
    if (entry.gender === "m" || entry.gender === "f") {
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
function isPureVerb(word, cache) {
  if (!(word in cache)) return false;
  const entry = normalizeCacheEntry(cache[word]);
  return entry.isVerb && entry.gender === null;
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
