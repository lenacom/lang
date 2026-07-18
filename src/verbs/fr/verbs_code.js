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

function getConjugationHTML(text, data) {
  return data?.map(({ infinitive, type, tenses }) => {
    const tensesHTML = Object.entries(tenses).map(([tenseName, forms]) => {
      const normalizedForms = Array.isArray(forms) ? forms : [forms];

      let formsHTML = normalizedForms.map(form => {
        return form === text? `<span style='color:red; font-weight:bold;'>${form}</span>` : form;
      });
      if (normalizedForms.length === 6) {
        const pronouns = ["je", "tu", "il", "nous", "vous", "ils"];
        for (let i = 0; i < 6; i++) {
          const pronoun = (i === 0 && "aeéêioôuy".includes(forms[i].at(0)))? "j'" :  pronouns[i] + " ";
          formsHTML[i] = `${pronoun}${formsHTML[i]}`;
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
      const found = normalizedForms.find(form => form === text)
      return `<div class="${found? '' : prefix(infinitive)}">
          <div><b>${tenseName}</b></div>
          <div>${formsHTML}</div>
        </div>`;
    });
    const onClick = `this.innerHTML = this.innerHTML === 'Больше'? 'Меньше' : 'Больше';
      Array.from(document.getElementsByClassName('${prefix(infinitive)}'))
      .forEach(it => { it.style.display = it.style.display === 'none'? 'block' : 'none'});`;
    return `<div>
      ${infinitive + (type === "irregular"? "*" : "")}
      <button style="border-radius:5px; padding:5px; margin:0;" id="${prefix("conjugation")}" onClick="${onClick}">Меньше</button>
      </div>
      ${tensesHTML.join("")}`;
  }).join("<hr/>").replace(/\s\s*/, " ");
}

async function translate(selection) {
  const text = selection.toString().trim().toLowerCase();
  const helper = document.getElementById('fr-helper'); //TODO

  const translation = await getYandexTranslation(text);
  const conjugation = getConjugation(text);

  const parts = []
  if (translation) {
    parts.push(`<div>${translation.join(" ")}</div>`);
  }
  if (conjugation) {
    parts.push(`<div>${getConjugationHTML(text, conjugation)}</div>`);
  }
  const ga = `<input onClick='translation("${text}", "fr", "ru")' type="button" 
    value="Google Translate" class="secondary rounded" style="margin:0"/>`;
  parts.push(ga);
  
  const { clientWidth: screenWidth, clientHeight: screenHeight } = document.documentElement;
  const selRange = selection.getRangeAt(0);
  const selRect = selRange.getBoundingClientRect();
  const style = (left, top, position) => {
    return `background-color:black; color:#fff8dc; border:1px solid #fff8dc; padding:10px; margin:0; 
    border-radius:5px; position:${position}; z-index:100;
    left:${left}px; top:${top}px; max-width:${screenWidth}`;
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
  document.getElementById(prefix("conjugation"))?.click();
}

document.addEventListener("selectionchange", () => {
  const text = document.getSelection().toString();
  if (!text) {
    document.getElementById('fr-helper').innerHTML = ""; // TODO
  } else {
    setTimeout(async () => {
      if (text === document.getSelection().toString()) {
        await translate(document.getSelection());
      }
    }, 100);
  }
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
