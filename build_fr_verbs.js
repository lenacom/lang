const fs = require('fs');

const SRC = "./src";
const DEST = "./dest";

const irregularVerbs = JSON.parse(fs.readFileSync(`${SRC}/verbs/fr/irregular_verbs.json`, "utf8"));

const infinitives = [];
const tenses = [];
const formToInfinitives = {};
const formToTenses = {};

function getId(array, item) {
  const id = array.indexOf(item);
  if (id >= 0) {
    return id;
  }
  array.push(item);
  return array.length - 1;
}

function addMultipleValue(map, key, value) {
  if (!map[key]) {
    map[key] = [];
  }
  if (!map[key].includes(value)) {
    map[key].push(value);
  }
}

function processForms(forms, infinitive, tense) {
  const infinitiveId = getId(infinitives, infinitive);
  const tenseId = getId(tenses, tense);
  for (const form of (Array.isArray(forms)? forms : [forms])) {
    addMultipleValue(formToInfinitives, form, infinitiveId);
    addMultipleValue(formToTenses, form, tenseId);
  }
}

for (const [verb, tenses] of Object.entries(irregularVerbs)) {
  for (const [tense, forms] of Object.entries(tenses)) {
    processForms(forms, verb, tense);
  }
}

const regularVerbs1 = fs.readFileSync(`${SRC}/verbs/fr/regular_verbs1.txt`, "utf8");
const regularVerbs2 = fs.readFileSync(`${SRC}/verbs/fr/regular_verbs2.txt`, "utf8");
const verbsCode = fs.readFileSync(`${SRC}/verbs/fr/verbs_code.js`, "utf8");

function buildRegularVerbs(fileContent, name) {
  const lines = fileContent.split(/\r?\n/);
  return "new Set([" + lines.map(it => `"${it.trim().slice(0, -2)}"`).join(",") + "]);";
}


let content = `const infinitives = ${JSON.stringify(infinitives)};`;
content += "\r\n";
content += `const tenses = ${JSON.stringify(tenses)};`;
content += "\r\n";
content += `const formToInfinitives = ${JSON.stringify(formToInfinitives)};`;
content += "\r\n";
content += `const formToTenses = ${JSON.stringify(formToTenses)};`;
content += "\r\n";
content += `const regularVerbs1 = ${buildRegularVerbs(regularVerbs1)};`;
content += "\r\n";
content += `const regularVerbs2 = ${buildRegularVerbs(regularVerbs2)};`;
content += "\r\n";
content += verbsCode;
content += "\r\n";
fs.writeFileSync(`${DEST}/js/fr_verbs.js`, content);
