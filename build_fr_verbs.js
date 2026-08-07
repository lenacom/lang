const fs = require('fs');

const SRC = "./src";
const DEST = "./dest";

const irregularVerbs = JSON.parse(fs.readFileSync(`${SRC}/fr/irregular_verbs.json`, "utf8"));
const regularVerbs = JSON.parse(fs.readFileSync(`${SRC}/fr/regular_verbs.json`, "utf8"));
const regularVerbs1 = fs.readFileSync(`${SRC}/fr/regular_verbs1.txt`, "utf8");
const regularVerbs2 = fs.readFileSync(`${SRC}/fr/regular_verbs2.txt`, "utf8");
const verbsCode = fs.readFileSync(`${SRC}/fr/verbs_code.js`, "utf8");

function regularVerbBases(fileContent) {
  const lines = fileContent.split(/\r?\n/);
  return "new Set([" + lines.map(it => `"${it.trim().slice(0, -2)}"`).join(",") + "])";
}

let content = `const irregularVerbs = ${JSON.stringify(irregularVerbs)};`;
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
