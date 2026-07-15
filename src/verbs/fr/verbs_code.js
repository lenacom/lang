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

function getYandexTranslationURL(text) {
  const url = new URL("https://dictionary.yandex.net/dicservice.json/lookupMultiple");
	url.searchParams.set("ui", "ru");
	url.searchParams.set("lang", "fr-ru");
	url.searchParams.set("dict", "fr-ru.regular");
	url.searchParams.set("type", "regular");
	url.searchParams.set("flags", "15783");
	url.searchParams.set("srv", "tr-text");
	url.searchParams.set("text", text);
  return url;
}

async function getYandexTranslation(text) {
	const response = await fetch(getYandexTranslationURL(text));
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

  const parts = []
  if (translation) {
    parts.push(`<div>${translation.join(" ")}</div>`);
  }
  if (conjugation) {
    parts.push(`<div>${conjugation}</div>`);
  }
  const ga = `<input onClick='translation("${text}", "fr", "ru")' type="button" 
    value="Google Translate" class="secondary rounded" style="margin:0"/>`;
  parts.push(ga);
  
  const helper = document.getElementById('fr-helper');
  const { clientWidth: screenWidth, clientHeight: screenHeight } = document.documentElement;
  const selRange = selection.getRangeAt(0);
  const selRect = selRange.getBoundingClientRect();
  const style = (left, top, position) => {
    return `background-color:white; color:black; padding:10px; margin:0; 
    border-radius:5px; position:${position}; 
    left:${left}px; top:${top}px; max-width:${screenWidth}`;
  } 
  const helperHTML = (style) => {
    return `<div id="fr-helper-btn" style="${style}">
    <div id="fr-helper-pnl">
    ${parts.join("<hr/>")}
    </div>`;
  }
  let left = selRect.left;
  let top = selRect.top + selRect.height;
  helper.innerHTML = helperHTML(style(left, top, "fixed"));
  const pnl = document.getElementById('fr-helper-pnl');
  while ((pnl.getBoundingClientRect().right + 10) > screenWidth && left > 0) {
    left -= 1;
    pnl.style = style(left, top, "fixed");
  }
  helper.innerHTML = helperHTML(style(left + window.scrollX, top + window.scrollY, "absolute"));
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
