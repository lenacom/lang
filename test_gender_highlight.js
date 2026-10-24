// Regression tests for the French noun-gender highlighter (src/fr/gender_highlight.js).
//
// Run from the project root:  node test_gender_highlight.js
//
// Each case is a real phrase that once highlighted the wrong word (or nothing)
// plus the output it must produce. The tests read the real
// src/fr/noun_gender_cache.json and never call Yandex, so every word used here
// must already be in the cache (a normal build puts it there) - a case that
// fails because its word is unknown says so explicitly.
const { loadGenderCache, mergeGenderMap, nounGenderMap, highlightNounGender } = require("./src/fr/gender_highlight");

const m = (w) => `<span class="m">${w}</span>`;
const f = (w) => `<span class="f">${w}</span>`;

// [phrase, expected output, why it is here]
const CASES = [
  // --- possessive / demonstrative determiners: a noun is guaranteed ---
  ["avec sa salive", `avec sa ${f("salive")}`, "possessive + verb-ambiguous noun (salive/saliver)"],
  ["avec sa propre salive;", `avec sa propre ${f("salive")};`, "prenominal adjective, then the verb-ambiguous noun"],
  ["de la salive", `de la ${f("salive")}`, "de la + verb-ambiguous noun"],
  ["Car tu frappes à la joue", `Car tu frappes à la ${f("joue")}`, "Yandex: noun without gender, gender comes from the article"],
  ["croyez à ces œuvres,", `croyez à ces ${f("œuvres")},`, "demonstrative + noun that is also a verb form (œuvrer)"],
  ["ce sont ces œuvres", `ce sont ces ${f("œuvres")}`, "ce is a pronoun here, ces is still a determiner"],
  ["ma force est épuisée", `ma ${f("force")} est épuisée`, "the verb of the clause must not be taken as a noun"],

  ["dans leur bouche;", `dans leur ${f("bouche")};`, "leur after a preposition is a determiner; bouche is also a verb form (boucher)"],
  ["elles n’ont point de souffle dans leur bouche.", `elles n’ont point de ${m("souffle")} dans leur ${f("bouche")}.`, "same, inside a longer verse"],
  ["il leur parle", "il leur parle", "leur after a subject pronoun is the indirect-object pronoun"],
  ["de leur parler", "de leur parler", "de + leur + infinitive: pronoun, not a determiner"],
  ["prirent des branches", `prirent des ${f("branches")}`, "des always introduces a noun; branches is also a verb form (brancher)"],
  ["il indiquait de quelle mort", `il indiquait de quelle ${f("mort")}`, "quelle + noun that is also a past participle (mourir)"],
  ["Quel est ton nom", `Quel est ton ${m("nom")}`, "quel + être must not take 'est' as the noun (only 'nom' is highlighted)"],

  ["je suis sans force ;", `je suis sans ${f("force")} ;`, "after 'sans' only an infinitive can be a verb - force is the noun"],
  ["Ils m’ont haï sans cause.", `Ils m’ont haï sans ${f("cause")}.`, "same (cause/causer)"],
  ["sans lui faire aucun mal", `sans lui faire aucun ${m("mal")}`, "sans + pronoun + infinitive: the infinitive is not taken as a noun"],
  ["chaque nuit ma couche est baignée", `chaque ${f("nuit")} ma ${f("couche")} est baignée`, "chaque is always a determiner; nuit is also a verb form (nuire)"],
  ["saisis d’épouvante ;", `saisis d’${f("épouvante")} ;`, "fused d’ is the preposition de, after which only an infinitive can be a verb"],
  ["au milieu de l’assemblée.", `au ${m("milieu")} de l’${f("assemblée")}.`, "l’ + a word in -ée can only be a noun (a participle can't follow the pronoun)"],
  ["il enfante le néant.", `il enfante le ${m("néant")}.`, "le + a noun ending in -ant is not a gerund"],

  ["de peur d’aller occuper la place", `de ${f("peur")} d’aller occuper la place`, "d’ + infinitive: 'aller' is a verb here, not the noun (only 'peur' is highlighted)"],
  ["avoir été traité comme lui", "avoir été traité comme lui", "an infinitive-like word / participle after être is not a noun"],

  ["il dit: Vous n’êtes pas tous purs.", "il dit: Vous n’êtes pas tous purs.", "tous is a floating quantifier here, purs a predicate adjective - nothing to highlight"],
  ["Vous n’êtes pas tous _purs_", "Vous n’êtes pas tous _purs_", "same, with italic markers"],
  ["toutes choses ont été faites", `toutes ${f("choses")} ont été faites`, "tout* + a noun for sure still counts"],
  ["tous les hommes", `tous les ${m("hommes")}`, "tout* + article: the article does the work"],
  ["il prit le _pain_", `il prit le _${m("pain")}_`, "an italic _ marker stays outside the highlighted span"],

  // --- sentence start: Le/La/Les is an article ---
  ["Les œuvres que je fais", `Les ${f("œuvres")} que je fais`, "capitalized article at sentence start"],
  ["Le maître _est_ ici", `Le ${m("maître")} _est_ ici`, "noun+adjective word must beat the verb 'est'"],
  ["Le maître garde la porte", `Le ${m("maître")} garde la porte`, "noun+adjective word must beat the verb-ambiguous 'garde'; 'la porte' is deliberately NOT highlighted (la + porte could be pronoun + verb: 'il la porte')"],

  // --- tel / prenominal adjectives are fallbacks, the real noun follows ---
  ["faire de tels miracles?", `faire de tels ${m("miracles")}?`, "tel is a determiner-like adjective"],
  ["un tel pouvoir", `un tel ${m("pouvoir")}`, "verb-ambiguous noun after an untagged adjective"],
  ["chez un tel et vous", `chez un ${m("tel")} et vous`, "tel as a real noun (so-and-so)"],
  ["la bonne nouvelle", `la bonne ${f("nouvelle")}`, "prenominal adjectives are skipped"],
  ["le bon berger", `le bon ${m("berger")}`, "prenominal adjective"],

  // --- adjectives used as nouns ---
  ["les paroles d’un démoniaque;", `les ${f("paroles")} d’un ${m("démoniaque")};`, "adjective-only word at the end of the phrase"],
  ["arrivé au démoniaque et aux porcs", `arrivé au ${m("démoniaque")} et aux ${m("porcs")}`, "adjective-only word right before a conjunction"],
  ["le démoniaque avait été guéri", `le ${m("démoniaque")} avait été guéri`, "adjective-only word right before a verb"],

  // --- phrase boundaries ---
  ["de Siloé (nom qui signifie envoyé)", "de Siloé (nom qui signifie envoyé)", "an opening bracket ends the search"],
  ["de Siloé _(nom_ qui signifie envoyé).", "de Siloé _(nom_ qui signifie envoyé).", "same, with italic markers"],
  ["les yeux vers le haut et _dit_", `les ${m("yeux")} vers le ${m("haut")} et _dit_`, "a conjunction ends the search; haut as a fallback noun"],
  ["de haute naissance", `de haute ${f("naissance")}`, "haut(e) is skipped when a noun follows"],
  ["à haute voix", `à haute ${f("voix")}`, "same"],
  ["Quel est donc l’intendant fidèle et prudent que le maître établira", `Quel est donc l’${m("intendant")} fidèle et prudent que le ${m("maître")} établira`, "-ant noun after l’, conjunctions end the search"],
  ["une si grande tempête que la barque", `une si grande ${f("tempête")} que la ${f("barque")}`, "'si' is an adverb here and must not end the search"],
  ["un si grand nombre de personnes", `un si grand ${m("nombre")} de ${f("personnes")}`, "same"],

  // --- prepositions ---
  ["meure pour le peuple", `meure pour le ${m("peuple")}`, "pour + article + verb-ambiguous noun"],
  ["pour la voie", `pour la ${f("voie")}`, "same"],
  ["pour le voir", "pour le voir", "pour + pronoun + infinitive stays unhighlighted"],
  ["sans les voir", "sans les voir", "same"],
  ["à l’est de la ville", `à l’${m("est")} de la ${f("ville")}`, "à l’ + est is the noun 'east'"],
  ["celui qui est fidèle l’est aussi", "celui qui est fidèle l’est aussi", "l’est = le + verb, no preposition before it"],

  // --- gerund / pronoun guards must keep working ---
  ["en l’entendant", "en l’entendant", "l’ + gerund is a pronoun"],
  ["ce qui sort de la bouche", `ce qui sort de la ${f("bouche")}`, "a verb after 'ce qui' is not a noun"],
];

const cache = loadGenderCache();
const map = mergeGenderMap(nounGenderMap, cache);

let failed = 0;
for (const [phrase, expected, why] of CASES) {
  const actual = highlightNounGender(phrase, map, cache);
  if (actual === expected) continue;
  failed++;
  console.log(`FAIL: ${phrase}\n  why:      ${why}\n  expected: ${expected}\n  actual:   ${actual}`);
}

console.log(`\n${CASES.length - failed}/${CASES.length} passed`);
process.exit(failed ? 1 : 0);
