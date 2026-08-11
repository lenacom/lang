const fs = require('fs');

const words = [
	"горло", "пятка", "локоть", "лоб", "бровь", "ресницы", "губы", "колено", "талия"
];

async function getYandexJson(word) {
	const url = new URL("https://dictionary.yandex.net/dicservice.json/lookupMultiple");
	url.searchParams.set("ui", "ru");
	url.searchParams.set("srv", "tr-text");
	url.searchParams.set("text", word);
	url.searchParams.set("type", "regular");
	url.searchParams.set("lang", "ru-fr");
	url.searchParams.set("flags", "15399");
	url.searchParams.set("dict", "ru-fr.regular");
	const response = await fetch(url);
	return response.json();
}

async function getWordMetadata(word) {
	const json = await getYandexJson(word);
	const regular = json["ru-fr"]["regular"];
	if (!regular || regular.length === 0) {
		return undefined;
	}
	
	return regular.filter(it => it.pos.code === "nn") //"adj"
	  .map(data => {
			const text = data.text;
			const ts = data.ts ?? "";
			const gen = data.gen?.code ?? "";
			const tr = data.tr.map(it => it.text).join(", ");
			return { text, ts, tr, gen };
		});
}

async function run() {
	let content = "items[] = [\r\n";
	for (const word of words) { 
		console.log(word);
		const data = await getWordMetadata(word);
		console.log(data)
		content += data.map((it) => `["${it.tr + (it.ts? ` [${it.ts}]` : "") + (it.gen? ` (${it.gen})` : "")}", "${it.text}"],\r\n`); 
	}
	content += "];\r\n";
	fs.writeFileSync("translations.js", content);
}

run();
