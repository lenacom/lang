"use strict";

function menu() {
	const names = { "en": "English", "fr": "Français" };

	function menuLink(pathParts, name = names[pathParts.at(-1)]) {
		return `<a href="${pathParts.join("/") + "/"}">${name}</a>`;
	}

	const pathParts = window.location.pathname.split("/");
	pathParts.splice(["", "index.html"].includes(pathParts.at(-1))? -2 : -1);
	const menuLinks = [];
	while (Object.keys(names).includes(pathParts.at(-1))) {
		menuLinks.unshift(menuLink(pathParts));
		pathParts.splice(-1);
	}
	menuLinks.unshift(menuLink(pathParts, "Главная"));
	const menuHTML = `<div style="margin-bottom: 1rem; display: flex; gap: 1rem;">${menuLinks.join("")}</div>`;
	document.body.insertAdjacentHTML("afterbegin", menuHTML);
}

function getConfig(name) {
	const json = getCookie(name);
	return json? JSON.parse(json) : {};
}

function saveConfig(name, data) {
	setCookie(name, JSON.stringify(data));
}

function setCookie(name, value, days = 90) {
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

function byId(id) {
	return document.getElementById(id);
}

function show(id) {
	byId(id).style.display = "block"; 
}

function hide(id) {
	byId(id).style.display = "none"; 
}

function normilizedLang(lang) {
	if (lang === "fr") return "fr-FR";
	if (lang === "en") return "en-US";
	return lang;
}

function initSpeak(lang) {
	lang = normilizedLang(lang);
	globalThis[`${lang}__started`] = false;
	globalThis[`${lang}__voice`] = false;

	document.addEventListener("pointerdown", (event) => {
		if (!globalThis[`${lang}__started`]) speak(" ", lang);
	});

	speechSynthesis.addEventListener("voiceschanged", () => {
		const voices = window.speechSynthesis.getVoices();
		globalThis[`${lang}__voice`] = voices.find(voice => voice.lang === lang);
	});
}

function autospeakHTML() {
	globalThis.autospeak = getCookie("autospeak") === "true";
	const onClick = "globalThis.autospeak = !globalThis.autospeak; setCookie('autospeak', globalThis.autospeak);";
	return `<div class="valign" style="margin-top: 1rem;">
    <label for="autospeak">Озвучивать автоматически</label>
    <input type="checkbox" ${globalThis.autospeak ? "checked" : ""} id="autospeak" onClick="${onClick}"/>
    </div>`;
}

function speak(text, lang, onend) {
	lang = normilizedLang(lang);
	window.speechSynthesis.cancel();
	const utterance = new SpeechSynthesisUtterance(text);
	utterance.lang = normilizedLang(lang);
	utterance.rate = 0.8; 
	utterance.volume = globalThis[`${lang}__started`] && text !== " "? 1 : 0;
	if (globalThis[`${lang}__voice`]) {
		utterance.voice = globalThis[`${lang}__voice`];
	}
	globalThis[`${lang}__started`] = true;
	console.log(utterance)
	utterance.onstart = (event) => {
  	console.log(`Speech "${text}" ${lang} has started processing.`);
	};
	utterance.onend = (event) => {
		console.log(`Speech "${text}" ${lang} has finished successfully.`);
		onend && onend();
	};
	window.speechSynthesis.speak(utterance);
}

function speakButtonHTML(text, lang) {
	if (!window.speechSynthesis) {
		//window.speechSynthesis.getVoices();
		return "";
	}
	return `
		<button class="autospeak" style="margin-top: auto;" onClick="speak('${text?.replaceAll("'", "\\'")}', '${lang}')">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20">
				<path fill="currentColor" d="M48 352l48 0 134.1 119.2c6.4 5.7 14.6 8.8 23.1 8.8 19.2 0 34.8-15.6 34.8-34.8l0-378.4c0-19.2-15.6-34.8-34.8-34.8-8.5 0-16.7 3.1-23.1 8.8L96 160 48 160c-26.5 0-48 21.5-48 48l0 96c0 26.5 21.5 48 48 48zM441.1 107c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C443.3 170.7 464 210.9 464 256s-20.7 85.3-53.2 111.8c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5c43.2-35.2 70.9-88.9 70.9-149s-27.7-113.8-70.9-149zm-60.5 74.5c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C361.1 227.6 368 241 368 256s-6.9 28.4-17.7 37.3c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5C402.1 312.9 416 286.1 416 256s-13.9-56.9-35.5-74.5z"/>
			</svg>
		</button>`;
}

function withSpeakButtonHTML(text, lang, textToSpeak) {
	return `<div style="display: flex; flex-direction: row; gap: 1rem;">
		<span>${text}</span>${speakButtonHTML(textToSpeak ?? text, lang)}</div>`;
}

function shuffle(array) {
	const shuffled = [...array]; 
	
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1)); 
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; 
	}
	
	return shuffled;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));