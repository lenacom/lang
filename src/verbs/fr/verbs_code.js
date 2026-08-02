const infinitives = [];
const formToInfinitives = {};
const endingToVerbType = {};
const endingToTenses = {};

const LANG = "fr-ru";

function prefix(value) {
  return `frh__${value}`;
}

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
      for (const form of (Array.isArray(forms)? forms : [forms])) {
        addMultipleValue(formToInfinitives, form, infinitiveId);
      }
    }
  }

  for (const [verbType, data] of Object.entries(regularVerbs)) {
    for (const [tense, endings] of Object.entries(data)) {
      for (const ending of (Array.isArray(endings)? endings : [endings])) {
        endingToVerbType[ending] = verbType;
      }
    }
  }
}
buildVerbs();

function replaceLastOccurance(text, char, replacement) {
  const index = text.lastIndexOf(char);
  return text.substring(0, index) + replacement + text.substring(index + 1);
}

function verbTenses(infinitive, form = "") {
  const tenses = irregularVerbs[infinitive];
  if (tenses) {
    const type = infinitive === "haïr"? "regular" : "irregular";
    return { infinitive, type, tenses };
  } else if (/er$|ir$/i.test(infinitive)) {
    const verbType = /er$/i.test(infinitive)? "1" : "2";
    const base = infinitive.slice(0, infinitive.length - 2);
    return { infinitive, type: "regular", tenses: regularVerbTenses(base, verbType, form) };
  }
}

function regularVerbTenses(base, verbType, form) {
  const tenses = {};
  for (const [tenseName, endings] of Object.entries(regularVerbs[verbType])) {
    const normalizedEndings = Array.isArray(endings)? endings : [endings];
    const tenseForms = [];
    for (let i = 0; i < normalizedEndings.length; i++) {
      tenseForms[i] = base;
      if (verbType === "1") {
        const cond1 = ["présent", "subjonctif présent"].includes(tenseName) && (i < 3 || i === 5) ||
          tenseName === "imperatif" && i === 0;
        const cond2 = ["futur simple", "conditionnel présent"].includes(tenseName);
        if (/el$|et$/i.test(base) && (cond1 || cond2)) {
          if (["achet", "béguet", "cisel", "congel", "corset", "crochet", "décel", 
            "dégel", "démantel", "écartel", "encastel", "filet", "furet", "gel", "halet", "martel", 
            "model", "pel", "rachet", "recel", "surgel", "cel"].includes(base)) {
            tenseForms[i] = replaceLastOccurance(base, "e", "è");
          } else {
            tenseForms[i] = base + base.at(-1);
          }
        } else if (/ec$|em$|ep$|er$|es$|ev$|evr$/.test(base) && (cond1 || cond2)) {
          tenseForms[i] = replaceLastOccurance(base, "e", "è");
        } else if (/ébr$|éc$|éch$|écr$|éd$|égl$|égn$|égr$|égu$|él$|ém$|én$|équ$|ér$|és$|ét$|étr$|évr$|éy$/i.test(base) && cond1) {
          tenseForms[i] = replaceLastOccurance(base, "é", "è");
        } else if (base.endsWith("g") && "oaâ".includes(normalizedEndings[i].at(0))) {
          tenseForms[i] += "e";
        } else if (base.endsWith("c") && "oaâ".includes(normalizedEndings[i].at(0))) {
          tenseForms[i] = base.slice(0, -1) + "ç";
        } else if (/ay$/.test(base) && /ai$/.test(form.substring(0, base.length)) 
          && (cond1 || cond2)) {
          tenseForms[i] = replaceLastOccurance(base, "y", "i");
        }
      }
      tenseForms[i] += normalizedEndings[i];
    }
    tenses[tenseName] = tenseForms.length > 1? tenseForms : tenseForms[0];
  }
  return tenses;
}

function getConjugation(form) {
  const infinitiveIds = formToInfinitives[form];
  if (infinitiveIds !== undefined) {
    return infinitiveIds.map(id => {
      const infinitive = infinitives[id];
      return verbTenses(infinitive, form);
    });
  } else {
    for (let i = 1; i <= 8; i++) {
      const baseLength = form.length - i;
      if (baseLength >= 2) {
        let base = form.slice(0, baseLength);  
        const ending = form.slice(baseLength);
        let verbType = endingToVerbType[ending];
        if (verbType) {
          const verbs = verbType === "1" ? regularVerbBases1 : regularVerbBases2;
          const bases = [base];
          if (verbType === "1") {
            if (/ell$|ett$|ge$/i.test(base)) {
              bases[1] = base.slice(0, -1);
            } else if (/èt$|èl$|èc$|èm$|èp$|èr$|ès$|èv$|èvr$/i.test(base)) {
              bases[1] = replaceLastOccurance(base, "è", "e");
            } else if (/èbr$|èc$|èch$|ècr$|èd$|ègl$|ègn$|ègr$|ègu$|èl$|èm$|èn$|èqu$|èr$|ès$|èt$|ètr$|èvr$|èy$/i.test(base)) {
              bases[1] = replaceLastOccurance(base, "è", "é");
            } else if (/ç$/i.test(base)) {
              bases[1] = replaceLastOccurance(base, "ç", "c");
            } else if (/ai$/i.test(base)) {
              bases[1] = replaceLastOccurance(base, "i", "y");
            }
          }
          const result = bases.map(base => {
            if (verbs.has(base)) {
              const infinitive = base + (verbType === "1" ? "er" : "ir");
              return verbTenses(infinitive, form);
            }
          }).filter(it => it);
          if (result.length) { return result; }
        }
      }
    }
  }
}

function getYandexTranslationURL(text) {
  const url = new URL("https://dictionary.yandex.net/dicservice.json/lookupMultiple");
	url.searchParams.set("ui", "ru");
	url.searchParams.set("lang", LANG);
	url.searchParams.set("dict", LANG + ".regular");
	url.searchParams.set("type", "regular");
	url.searchParams.set("flags", "15783");
	url.searchParams.set("srv", "tr-text");
	url.searchParams.set("text", text);
  return url;
}

async function getTranslation(text) {
	const response = await fetch(getYandexTranslationURL(text));
	const json = await response.json();

	const regular = json[LANG]["regular"];
	if (!regular || regular.length === 0) {
		return undefined;
	}

	return regular;
}

function getTranslationHTML(data) {
	return data.map(item => {
    const { text, ts, tr, gen } = item;
		const result = [`<b>${text}</b>`,
      ts? `[${ts}]` : "",
      gen?.code].filter(it => it).map(it => `<div>${it}</div>`);
    result.splice(1, 0, speakBtnHTML(text));
    return `<div style="display:flex; flex-wrap:wrap; flex-direction:row; align-items:center; gap:10px;">
      ${result.join("")}
    </div><div style="max-width:${Math.min(document.documentElement.clientWidth, 500)}px">${tr.map(it => it.text).join(", ")}</div>`;
	}).join("");
}

function speakBtnHTML(text) {
  if (!window.speechSynthesis) {
    return "";
  }
  return `
    <button style="font-size:0; margin: auto 0 0 0; padding:5px;" onClick="speak('${text.replace("'", "\\'")}')">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20px" height="20px">
        <path fill="currentColor" d="M48 352l48 0 134.1 119.2c6.4 5.7 14.6 8.8 23.1 8.8 19.2 0 34.8-15.6 34.8-34.8l0-378.4c0-19.2-15.6-34.8-34.8-34.8-8.5 0-16.7 3.1-23.1 8.8L96 160 48 160c-26.5 0-48 21.5-48 48l0 96c0 26.5 21.5 48 48 48zM441.1 107c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C443.3 170.7 464 210.9 464 256s-20.7 85.3-53.2 111.8c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5c43.2-35.2 70.9-88.9 70.9-149s-27.7-113.8-70.9-149zm-60.5 74.5c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C361.1 227.6 368 241 368 256s-6.9 28.4-17.7 37.3c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5C402.1 312.9 416 286.1 416 256s-13.9-56.9-35.5-74.5z"/>
      </svg>
    </button>`;
}

let started = false;
let voice;

document.addEventListener("pointerup", (event) => {
  if (!started) speak(" ");
});

function speak(text) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr";
  utterance.rate = 0.8; 
  utterance.volume = started? 1 : 0;
  if (voice) {
    utterance.voice = voice;
  }
  started = true;
  window.speechSynthesis.speak(utterance);
}

function loadVoices() {
  const voices = window.speechSynthesis.getVoices();
  voice = voices.find(voice => voice.lang === "fr-FR"/* && voice.localService*/);
}

speechSynthesis.addEventListener("voiceschanged", loadVoices);

function startsWithVowel(text) {
  return "haeéêioôuy".includes(text.at(0));
}

function getConjugationHTML(text, data) {
  return data?.map(({ infinitive, type, tenses }) => {
    const tensesHTML = Object.entries(tenses).map(([tenseName, __forms]) => {
      const forms = Array.isArray(__forms) ? __forms : [__forms];

      let formsHTML = forms.map(form => {
        return form === text? `<span style='color:red; font-weight:bold;'>${form}</span>` : form;
      });
      let formsToSpeak = [...forms];
      if (forms.length === 6) {
        const pronouns = ["je", "tu", "il", "nous", "vous", "ils"];
        for (let i = 0; i < 6; i++) {
          const pronoun = (i === 0 && startsWithVowel(forms[i]))? "j'" :  pronouns[i] + " ";
          formsHTML[i] = `${pronoun}${formsHTML[i]}`;
          formsToSpeak[i] = `${pronoun}${forms[i]}`;
        }
      }
      formsHTML = formsHTML.map(it => `<div>${it}</div>`);
      if (formsHTML.length === 6) {
        formsHTML = `<div style="display:flex; gap:20px">
          <div>${formsHTML.slice(0,3).join("")}</div>
          <div>${formsHTML.slice(3,6).join("")}</div>
          </div>`;
      } else {
        formsHTML = formsHTML.join("");
      }
      const found = forms.find(form => form === text)
      return `<div class="${found? '' : prefix(infinitive)}">
          <div style="display:flex; flex-direction:row; align-items:center; gap:10px; font-weight:bold">
            <span>${tenseName}</span>
            ${speakBtnHTML(formsToSpeak.join(", "))}
          </div>
          <div>${formsHTML}</div>
        </div>`;
    });
    const onClick = `this.innerHTML = this.innerHTML === 'Больше'? 'Меньше' : 'Больше';
      Array.from(document.getElementsByClassName('${prefix(infinitive)}'))
      .forEach(it => { it.style.display = it.style.display === 'none'? 'block' : 'none'});`;
    return `<div>
      ${infinitive + (type === "irregular"? "*" : "")}
      <button style="border-radius:5px; padding:5px; margin:0;" class="${prefix("conjugation")}" onClick="${onClick}">Меньше</button>
      </div>
      ${tensesHTML.join("")}`;
  }).join("<hr/>").replace(/\s\s*/, " ");
}

async function getHelperData(text) {
  let translation = await getTranslation(text);
  let conjugation = getConjugation(text);
  if (!translation && conjugation) {
    const infinitive = conjugation[0].infinitive;
    const reflexiveVerb = `${startsWithVowel(infinitive)? "s'": "se "}${infinitive}`;
    translation = await getTranslation(reflexiveVerb);
  }
  if (translation && !conjugation) {
    const verbs = translation.filter(it => it.pos.code === "vrb");
    if (verbs.length) {
      conjugation = [verbTenses(verbs[0].text)];
    }
  }
  return { translation, conjugation };
}

async function showHelper(selection) {
  const text = selection.toString().trim().toLowerCase();
  const helper = document.getElementById('fr-helper'); //TODO

  if (text && helper.getAttribute("text") === text) {
    return;
  }

  if (!text) {
    helper.removeAttribute("text");
    helper.innerHTML = ""; // TODO
    return;
  }

  helper.setAttribute("text", text);
  const { translation, conjugation } = await getHelperData(text);

  const parts = []
  if (translation) {
    parts.push(`<div>${getTranslationHTML(translation)}</div>`);
  }
  if (conjugation) {
    parts.push(`<div>${getConjugationHTML(text, conjugation)}</div>`);
  }
  if (parts.length === 0) {
    parts.push(`<div>${speakBtnHTML(text)}</div>`);
  }
  
  const { clientWidth: screenWidth, clientHeight: screenHeight } = document.documentElement;
  const selRange = selection.getRangeAt(0);
  const selRect = selRange.getBoundingClientRect();
  const style = (left, top, position) => {
    return `background-color:black; color:#fff8dc; border:1px solid #fff8dc; padding:10px; margin:0; 
    border-radius:5px; position:${position}; 
    left:${left}px; top:${top}px; max-width:${screenWidth};`;
  } 
  const helperHTML = (style) => {
    return `<div id="${prefix("helper")}" style="${style}">${parts.join("<hr/>")}</div>`;
  }
  
  let left = selRect.left;
  let top = selRect.top + selRect.height;
  helper.innerHTML = helperHTML(style(left, top, "fixed"));
  const pnl = document.getElementById(prefix("helper"));
  while ((pnl.getBoundingClientRect().right + 10) > screenWidth && left > 0) {
    left -= 1;
    pnl.style = style(left, top, "fixed");
  }
  helper.innerHTML = helperHTML(style(left + window.scrollX, top + window.scrollY, "absolute"));
  Array.from(document.getElementsByClassName(prefix("conjugation"))).forEach(it => it.click());
}

const listener = async () => {
  await showHelper(document.getSelection());
};
document.addEventListener("contextmenu", listener);
document.addEventListener("pointerup", listener);
document.addEventListener("selectionchange", async () => {
  const selection = document.getSelection()
  if (!selection.toString()) {
    await showHelper(document.getSelection());
  }
});

// TODO proférée
// enivrante - не находит
// enivrant
/*

s’efforcer ?

Основные глаголы только в возвратной форме
Se souvenir — помнить, вспоминать
S'enfuir — убегать, сбегать
Se méfier — остерегаться, не доверять
Se repentir — раскаиваться
S'évanouir — падать в обморок, исчезать
S'écrier — воскликнуть
S'absenter — отсутствовать
S'efforcer — стараться, силиться
Se douter — догадываться, подозревать
Se suicider — покончить с собой
S'emparer — завладеть, захватить
Se moquer — насмехаться, издеваться
S'agenouiller — вставать на колени
S'envoler — улетать
Se syndiquer — вступать в профсоюз
se morfondre
*/
