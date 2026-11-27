const fs = require("fs");

const SRC = "./src";
const DEST = "./dest";

const irregularVerbs = JSON.parse(
  fs.readFileSync(`${SRC}/fr/irregular_verbs.json`, "utf8"),
);
const regularVerbs = JSON.parse(
  fs.readFileSync(`${SRC}/fr/regular_verbs.json`, "utf8"),
);
const regularVerbs1 = fs.readFileSync(`${SRC}/fr/regular_verbs1.txt`, "utf8");
const regularVerbs2 = fs.readFileSync(`${SRC}/fr/regular_verbs2.txt`, "utf8");
const verbsCode = fs.readFileSync(`${SRC}/fr/verbs_code.js`, "utf8");

function regularVerbBases(fileContent) {
  const lines = fileContent.split(/\r?\n/);
  return (
    "new Set([" +
    lines.map((it) => `"${it.trim().slice(0, -2)}"`).join(",") +
    "])"
  );
}

// the gender of the nouns that begin with a vowel, for "mon"/"ton"/"son" (they
// stand in for "ma"/"ta"/"sa" before a vowel: "mon égard" m, "mon idée" f).
// Only these words are needed in the browser, so the table is small
function vowelNounGenders() {
  const vowelStart = /^[aeiouyâàéèêëîïôöûüùœæh]/i;
  const table = {};
  const add = (word, gender) => {
    const key = word.toLowerCase();
    if ((gender === "m" || gender === "f") && vowelStart.test(key) && !(key in table)) {
      table[key] = gender;
    }
  };
  const cache = JSON.parse(
    fs.readFileSync(`${SRC}/fr/noun_gender_cache.json`, "utf8"),
  );
  for (const [word, entry] of Object.entries(cache)) {
    if (entry && !entry.isAdjective && !entry.isVerb) add(word, entry.gender);
  }
  const allNouns = new Function(
    `${fs.readFileSync(`${SRC}/fr/all_nouns.js`, "utf8")}; return all_nouns;`,
  )();
  for (const [word, , gender] of allNouns) add(word, gender);
  return table;
}

let content = `const irregularVerbs = ${JSON.stringify(irregularVerbs)};`;
content += "\r\n";
content += `const vowelNounGenders = ${JSON.stringify(vowelNounGenders())};`;
content += "\r\n";
content += `const regularVerbs = ${JSON.stringify(regularVerbs)};`;
content += "\r\n";
content += `const regularVerbBases1 = ${regularVerbBases(regularVerbs1)};`;
content += "\r\n";
content += `const regularVerbBases2 = ${regularVerbBases(regularVerbs2)};`;
content += "\r\n";
content += verbsCode;
content += "\r\n";
fs.writeFileSync(`${DEST}/js/fr_verbs.js`, content);
