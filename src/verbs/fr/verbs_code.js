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

async function getYandexTranslation(text) {
	const url = new URL("https://dictionary.yandex.net/dicservice.json/lookupMultiple");
	url.searchParams.set("ui", "ru");
	url.searchParams.set("lang", "fr-ru");
	url.searchParams.set("dict", "fr-ru.regular");
	url.searchParams.set("type", "regular");
	url.searchParams.set("flags", "15783");
	url.searchParams.set("srv", "tr-text");
	url.searchParams.set("text", text);
	const response = await fetch(url);
	const json = await response.json();

	const regular = json["fr-ru"]["regular"];
	if (!regular || regular.length === 0) {
		return undefined;
	}

	return regular.map(item => {
		const word = item.text;
		let ts = item.ts ?? "";
		if (ts) {
			ts = `[${ts}]`;
		}
		const tr = item.tr[0].text;
		const gen = item.gen?.code ?? "";
		return [word, ts, gen, tr].filter(it => it).join(" ");
	}).map(it => `<div>${it}</div>`);
}

async function translate(selection) {
  const text = selection.toString();
  const button = document.getElementById('fr-helper-btn');

  if (!text) {
    if (button) {
      button.style.display = 'none';
    }
    return;
  }

  const translation = await getYandexTranslation(text);

  const verbTenses = findVerbTenses(text);
  let conjugation;
  if (verbTenses !== undefined) {
    const tenseIds = formToTenses[text];
    conjugation = `${verbTenses.infinitives}${verbTenses.type === "irregular" ? "*" : ""}: ${verbTenses.tenses}`;
  }

  if (!translation && ! conjugation) {
    if (button) {
      button.style.display = 'none';
    }
    return;
  }

  let content = "";

  if (translation) {
    content += `<div>${translation.join(" ")}</div>`;
  }
  if (conjugation) {
    content += `<div>${conjugation}</div>`;
  }
  
  const helper = document.getElementById('fr-helper');
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  helper.innerHTML = `<div id="fr-helper-btn" style="background-color:white; color: black; padding: 5px; border-radius:5px; position:fixed; top:${Math.round(rect.top + rect.height)}px; left:${Math.round(rect.left)}px; z-index:100;">
    ${content}
    <input onClick='translation("${text}", "fr", "ru")' type="button" value="Google Translate" class="secondary rounded"/>
    </div>`;
}

document.addEventListener("selectionchange", async () => {
  await translate(document.getSelection());
});

function openURL(url) {
	const width = Math.min(window.innerWidth, 1024);
	const height = Math.min(window.innerHeight, 768);
	window.open(url, '_blank', `width=${width}, height=${height}`);
}

function translation(text, fromLang, toLang) {
	const src = new URL("https://translate.google.com/details");
	src.searchParams.set("hl", "ru");
	src.searchParams.set("tl", toLang);
	src.searchParams.set("sl", fromLang);
	src.searchParams.set("text", text);
	src.searchParams.set("op", "translate");
	openURL(src.toString());
}

// TODO https://www.le-francais.ru/conjugaison/rappeler/
