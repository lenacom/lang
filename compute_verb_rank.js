// Sets the frequency RANK (the 3rd element of every entry) of the verbs of the "fr_verbs" test in
// training/fr/js/fr_verbs.js: ["verb", "translation", rank]. Rank 1 = the most frequent verb of French.
// Run from the project root:
//
//   node compute_verb_rank.js            - only prints what it would write
//   node compute_verb_rank.js --write    - writes the ranks into fr_verbs.js
//
// The ranks come from src/fr/frequent_verbs_lexique.txt (Lexique 3, frequency of the verb lemmas in film
// subtitles and in books). The test uses them to choose the verb that leads a group of verbs conjugated the
// same way: the one with the lowest rank. A reflexive "se"/"s'" is ignored when looking a verb up.
// A verb missing from the list gets 99999, so it never leads a group that has another verb.
//
// RANK_CORRECTIONS: where the list is wrong for a verb, its rank is set by hand.
// - suivre: Lexique counts most "suis" (1819 per million in films) for suivre although "je suis" is être,
//   which put suivre at 14. Without "suis" its frequency is 318 (not 1520), which is rank 71 in this list.
const RANK_CORRECTIONS = { suivre: 71 };
const fs = require("fs");
const vm = require("vm");

const file = "training/fr/js/fr_verbs.js";
const src = fs.readFileSync(file, "utf8");
const eol = src.includes("\r\n") ? "\r\n" : "\n";
const ctx = vm.createContext({});
vm.runInContext(src + "\n;globalThis.__o = { tenses, verbs };", ctx);
const { tenses, verbs } = JSON.parse(JSON.stringify(ctx.__o));

const ranks = new Map();
for (const line of fs.readFileSync("src/fr/frequent_verbs_lexique.txt", "utf8").split(/\r?\n/)) {
  const m = line.match(/^(\d+) (\S+) [\d.]+$/u);
  if (m) ranks.set(m[2], Number(m[1]));
}
const MISSING = 99999;
const baseOf = (verb) => verb.replace(/^se /, "").replace(/^s['’]/, "");
const rankOf = (verb) => RANK_CORRECTIONS[verb] ?? ranks.get(verb) ?? ranks.get(baseOf(verb)) ?? MISSING;

const rows = verbs.map(([verb, translation]) => ({ verb, translation, rank: rankOf(verb) }));
const missing = rows.filter((r) => r.rank === MISSING).map((r) => r.verb);
console.log(`${rows.length - missing.length} of ${rows.length} test verbs found among ${ranks.size} verb lemmas; missing: ${JSON.stringify(missing)}`);
console.log("most frequent:", rows.slice().sort((a, b) => a.rank - b.rank).slice(0, 12).map((r) => `${r.verb}(${r.rank})`).join(", "));

if (process.argv.includes("--write")) {
  const verbsStart = src.indexOf(`${eol}const verbs = [`);
  const head = src.slice(0, verbsStart);
  // an entry has the translation and then one or more numbers (older versions wrote frequency and rank)
  const entryRe = /^  \["(.+?)", "(.+?)"(?:, \d+)+\],$/u;
  let n = 0;
  const lines = src.slice(verbsStart).split(eol).map((line) => {
    const m = line.match(entryRe);
    if (!m) return line;
    n++;
    return `  ["${m[1]}", "${m[2]}", ${rankOf(m[1])}],`;
  });
  if (n !== verbs.length) throw new Error(`rewrote ${n} lines, expected ${verbs.length}`);
  const result = head + lines.join(eol);
  const check = vm.createContext({});
  vm.runInContext(result + "\n;globalThis.__o = { tenses, verbs };", check);
  const after = JSON.parse(JSON.stringify(check.__o));
  if (JSON.stringify(after.tenses) !== JSON.stringify(tenses)) throw new Error("tenses changed");
  after.verbs.forEach((v, i) => {
    if (v[0] !== verbs[i][0] || v[1] !== verbs[i][1] || v.length !== 3 || typeof v[2] !== "number") throw new Error("bad entry " + JSON.stringify(v));
  });
  fs.writeFileSync(file, result);
  console.log(`\nwritten: ${n} entries are now [verb, translation, rank]`);
}
