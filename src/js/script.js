function getSelectedText() {
	return document.getSelection().toString();
}

function openURL(url) {
	const width = Math.min(window.innerWidth, 1024);
	const height = Math.min(window.innerHeight, 768);
	window.open(url, '_blank', `width=${width}, height=${height}`);
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
		return [word, tr, ts, gen].filter(it => it).join(" ");
	}).join("; ");
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

function conjugation(text) {
	const src = new URL("https://www.le-francais.ru/conjugaison/search/");
	src.searchParams.set("q", text);
	openURL(src.toString());
}

function setCookie(name, value, days) {
	let expires = "";
	if (days) {
		let date = new Date();
		date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
		expires = "; expires=" + date.toUTCString();
	}
	document.cookie = name + "=" + (encodeURIComponent(value) || "") + expires + "; path=/";
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
		const value = parts.pop().split(';').shift();
		return decodeURIComponent(value);
	}
  return null;
}
