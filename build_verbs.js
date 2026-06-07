const fs = require('fs');

const SRC = "./src";
const DEST = "./dest";

const irregularVerbs = JSON.parse(fs.readFileSync(`${SRC}/verbs/fr/irregular_verbs.json`, "utf8"));
const sorted = Object.values(irregularVerbs).sort((a, b) => a.infinitif > b.infinitif ? 1 : -1); 

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
  for (const form of forms) {
    addMultipleValue(formToInfinitives, form, infinitiveId);
    addMultipleValue(formToTenses, form, tenseId);
  }
}

function processMood(verb, mood, addMoodToTense) {
  for (const [tense, forms] of Object.entries(verb[mood])) {
    processForms(Array.isArray(forms)? forms : [forms], 
      verb.infinitif, (addMoodToTense? mood + " " : "") + tense);
  }
}

for (const verb of sorted) {
  processMood(verb, "indicatif", false);
  processMood(verb, "subjonctif", true);
  processMood(verb, "conditionnel", true);
  processMood(verb, "participe", true);
  processForms(verb.imperatif, verb.infinitif, "imperatif");
}

let content = `const infinitives = ${JSON.stringify(infinitives)};`;
content += "\r\n";
content += `const tenses = ${JSON.stringify(tenses)};`;
content += "\r\n";
content += `const formToInfinitives = ${JSON.stringify(formToInfinitives)};`;
content += "\r\n";
content += `const formToTenses = ${JSON.stringify(formToTenses)};`;
content += "\r\n";
fs.writeFileSync(`${DEST}/js/fr_irregular_verbs.js`, content);
