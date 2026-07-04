const infinitives = [];
const tenses = [];
const formToInfinitives = {};
const formToTenses = {};
const endingToVerbType = {};
const endingToTenses = {};

function buildVerbs() {
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

  for (const [infinitive, data] of Object.entries(irregularVerbs)) {
    for (const [tense, forms] of Object.entries(data)) {
      const infinitiveId = getId(infinitives, infinitive);
      const tenseId = getId(tenses, tense);
      for (const form of (Array.isArray(forms)? forms : [forms])) {
        addMultipleValue(formToInfinitives, form, infinitiveId);
        addMultipleValue(formToTenses, form, tenseId);
      }
    }
  }

  for (const [verbType, data] of Object.entries(regularVerbs)) {
    for (const [tense, endings] of Object.entries(data)) {
      const tenseId = getId(tenses, tense);
      for (const ending of (Array.isArray(endings)? endings : [endings])) {
        endingToVerbType[ending] = verbType;
        addMultipleValue(endingToTenses, ending, tenseId);
      }
    }
  }
}
buildVerbs();

function findVerbTenses(form) {
  form = form.toLowerCase();

  function stringify(array, ids) {
    return ids.map(it => array[it]).join(", ");
  }

  const infinitiveIds = formToInfinitives[form];
  if (infinitiveIds !== undefined) {
    const tenseIds = formToTenses[form];
    return { 
      infinitives: stringify(infinitives, infinitiveIds), 
      tenses: stringify(tenses, tenseIds),
      type: "irregular"
    }
  } else {
    for (let i = 1; i <= 8; i++) {
      const baseLength = form.length - i;
      if (baseLength >= 2) {
        const base = form.slice(0, baseLength).replace("ç", "c");
        const ending = form.slice(baseLength);
        const tenseIds = endingToTenses[ending];
        if (tenseIds !== undefined) {
          const verbType = endingToVerbType[ending];
          const verbs = verbType === "1" ? regularVerbBases1 : regularVerbBases2;
          if (verbs.has(base)) {
            const infinitive = base + (verbType === "1" ? "er" : "ir");
            return { 
              infinitives: infinitive, 
              tenses: stringify(tenses, tenseIds),
              type: "regular"
            }
          }
        }
      }
    }
  }
}
