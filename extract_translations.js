const fs = require('fs');

const words = [
	"громкий", 
	"тихий",
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
	console.log(json);
	const regular = json["ru-fr"]["regular"];
	if (!regular || regular.length === 0) {
		return undefined;
	}
	
	return regular.filter(it => it.pos.code === "adj")
	  .map(data => {
			const text = data.text;
			const ts = data.ts ?? "";
			const tr = data.tr.map(it => it.text).join(", ");
			return { text, ts, tr };
		});
}

async function run() {
	let content = "items[] = [\r\n";
	for (const word of words) { 
		console.log(word);
		const data = await getWordMetadata(word);
		console.log(data)
		content += data.map((it) => `["${it.tr + (it.ts? ` [${it.ts}]` : "")}", "${it.text}"],\r\n`); 
	}
	content += "];\r\n";
	fs.writeFileSync("translations.js", content);
}

run();
