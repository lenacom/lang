const infinitives = [];
const formToInfinitives = {};
const endingToVerbType = {};
const endingToTenses = {};

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

function regularVerbTenses(base, verbType) {
  const tenses = {};
  for (const [tenseName, endings] of Object.entries(regularVerbs[verbType])) {
    const normalizedEndings = Array.isArray(endings)? endings : [endings];
    const forms = [];
    for (let i = 0; i < normalizedEndings.length; i++) {
      forms[i] = base;
      if (verbType === "1") {
        const special = ["achet", "béguet", "cisel", "congel", "corset", "crochet", "décel", 
          "dégel", "démantel", "écartel", "encastel", "filet", "furet", "gel", "halet", "martel", 
          "model", "pel", "rachet", "recel", "surgel", "cel"];
        if (/el$|et$/i.test(base) && (tenseName === "présent" && (i < 3 || i === 5) || 
          ["futur simple", "subjonctif présent", "conditionnel présent"].includes(tenseName) ||
          tenseName === "imperatif" && i === 0)) {
          if (special.includes(base)) {
            forms[i] = base.slice(0, -2) + "è" + base.at(-1);
          } else {
            forms[i] = base + base.at(-1);
          }
        } else if (base.endsWith("g") && "oaâ".includes(normalizedEndings[i].at(0))) {
          forms[i] += "e";
        }  else if (base.endsWith("c") && "oaâ".includes(normalizedEndings[i].at(0))) {
          forms[i] = base.slice(0, -1) + "ç";
        }
      }
      forms[i] += normalizedEndings[i];
    }
    tenses[tenseName] = forms.length > 1? forms : forms[0];
  }
  return tenses;
}

function getConjugation(form) {
  const infinitiveIds = formToInfinitives[form];
  if (infinitiveIds !== undefined) {
    return infinitiveIds.map(id => {
      const infinitive = infinitives[id];
      return { infinitive, type: "irregular", tenses: irregularVerbs[infinitive] };
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
          if (/ell$|ett$/i.test(base)) {
             bases[1] = base.slice(0, -1);
          } else if (/èt$|èl$/i.test(base)) {
             bases[1] = base.slice(0, -2) + "e" + base.at(-1);
          } else if (/ge/i.test(base)) {
             bases[1] = base.slice(0, -1);
          } else if (/ç$/i.test(base)) {
            base[1] = base.slice(0, -1) + "c";
          }
          const result = bases.map(base => {
            if (verbs.has(base)) {
              const infinitive = base + (verbType === "1" ? "er" : "ir");
              return { infinitive, type: "regular", tenses: regularVerbTenses(base, verbType) };
            }
          }).filter(it => it);
          if (result.length) { return result; }
        }
      }
    }
  }
}

const LANG = "fr-ru";

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

async function getYandexTranslation(text) {
	const response = await fetch(getYandexTranslationURL(text));
	const json = await response.json();

	const regular = json[LANG]["regular"];
	if (!regular || regular.length === 0) {
		return undefined;
	}

	return regular.map(item => {
    const { text, ts, tr, gen } = item;
		const result = [`<b>${text}</b>`,
      ts? `[${ts}]` : "",
      gen?.code].filter(it => it).map(it => `<div>${it}</div>`);
    result.splice(1, 0, speakBtnHTML(text, "fr", "font-size:0; margin: auto 0 0 0; padding:5px;"));
    return `<div style="display:flex; flex-wrap:wrap; flex-direction:row; align-items:center; gap:10px;">
      ${result.join("")}
    </div><div style="max-width:${Math.min(document.documentElement.clientWidth, 500)}px">${tr.map(it => it.text).join(", ")}</div>`;
	});
}

function speakBtnHTML(text, lang, style) {
  if (!window.speechSynthesis) {
    return "";
  }
  return `
    <button style="${style}" onClick="speak('${text.replace("'", "\\'")}', '${lang}')">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20px" height="20px">
        <path fill="currentColor" d="M48 352l48 0 134.1 119.2c6.4 5.7 14.6 8.8 23.1 8.8 19.2 0 34.8-15.6 34.8-34.8l0-378.4c0-19.2-15.6-34.8-34.8-34.8-8.5 0-16.7 3.1-23.1 8.8L96 160 48 160c-26.5 0-48 21.5-48 48l0 96c0 26.5 21.5 48 48 48zM441.1 107c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C443.3 170.7 464 210.9 464 256s-20.7 85.3-53.2 111.8c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5c43.2-35.2 70.9-88.9 70.9-149s-27.7-113.8-70.9-149zm-60.5 74.5c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C361.1 227.6 368 241 368 256s-6.9 28.4-17.7 37.3c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5C402.1 312.9 416 286.1 416 256s-13.9-56.9-35.5-74.5z"/>
      </svg>
    </button>`;
}

function speak(text, lang) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang; 
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(voice => voice.lang === lang);
  if (voice) {
    utterance.voice = voice;
  }
  window.speechSynthesis.speak(utterance);
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
          const pronoun = (i === 0 && "haeéêioôuy".includes(forms[i].at(0)))? "j'" :  pronouns[i] + " ";
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
            ${speakBtnHTML(formsToSpeak.join(", "), "fr", "font-size:0; margin: auto 0 0 0; padding:5px;")}
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

async function translate(selection) {
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
  const translation = await getYandexTranslation(text);
  const conjugation = getConjugation(text);
  if (!translation && !conjugation) {
    return;
  }

  const parts = []
  if (translation) {
    parts.push(`<div>${translation.join(" ")}</div>`);
  }
  if (conjugation) {
    parts.push(`<div>${getConjugationHTML(text, conjugation)}</div>`);
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

document.addEventListener("contextmenu", async () => {
  await translate(document.getSelection());
});

document.addEventListener('mouseup', async () => {
  await translate(document.getSelection());
});

function openURL(url) {
	const width = Math.min(window.innerWidth, 1024);
	const height = Math.min(window.innerHeight, 768);
	window.open(url, '_blank', `width=${width}, height=${height}`);
}

// TODO proférée
// renvoyer неправильный renverrait
