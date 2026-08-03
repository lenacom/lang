const fs = require('fs');

const SRC = "./src";
const DEST = "./dest";

const rawWords = fs.readFileSync(`${SRC}/words/fr/raw_words.txt`, "utf8");
const lines = rawWords.split(/\r?\n/);

const skipEndings = ["'", "-", "-ce", "-ci", "-je", "-te", "-vous", "-nous", "-le", "-la", "-les", 
	"-moi", "-toi", "-en", "-là", "-il", "-elle", "-tu", "-y", "-lui", "-on", "-ils", "-elles", 
	"-même", "-mêmes", "-leur", "-que", "-pas", "-plait", "-plaît", "c`", "ée", "ées"];
function skipWord(word) {
	for (let skipEnding of skipEndings) {
		if (word.endsWith(skipEnding)) {
			return true;
		}
		if (word === "suis" || word === "oui") {
			return true;
		}
	}
	return false;
}

async function getYandexJson(word) {
	const url = new URL("https://dictionary.yandex.net/dicservice.json/lookupMultiple");
	url.searchParams.set("ui", "ru");
	url.searchParams.set("lang", "fr-ru");
	url.searchParams.set("dict", "fr-ru.regular");
	url.searchParams.set("type", "regular");
	url.searchParams.set("flags", "15783");
	url.searchParams.set("srv", "tr-text");
	url.searchParams.set("text", word);
	const response = await fetch(url);
	return response.json();
}

async function getWordMetadata(word) {
	const json = await getYandexJson(word);
	const regular = json["fr-ru"]["regular"];
	if (!regular || regular.length === 0) {
		return undefined;
	}
	if (regular.some(it => it.pos.code !== "nn")) {
		return [];
	}
	return regular.filter(it => it.pos.code === "nn" && it.text === it.text.toLowerCase())
	  .map(data => {
			const text = data.text;
			const ts = data.ts ?? "";
			const gen = data.gen?.code ?? "";
			const tr = data.tr[0].text;
			return { text, ts, gen, tr };
		});
}

function addWordOrCount(map, data, count) {
	const text = data.text;
	if (map[text]) {
		map[text].count += count;
	} else {
		map[text] = data;
		map[text].count = count;
	}
}

function writeToFile(map, fileName) {
	const data = [];
	for (const value of Object.values(map)) {
		const row = [value.text, value.ts, value.gen, value.tr, value.count];
		data.push(row);
	};
	data.sort((a, b) => b[1] - a[1]);
	let content = "const all_nouns = [\r\n";
	content += data.map(it => `["${it[0]}", "${it[1]}", "${it[2]}", "${it[3]}", ${it[4]}],`).join("\r\n"); 
	content += "]\r\n";
	fs.writeFileSync(`${SRC}/verbs/fr/${fileName}.js`, content);
}

async function buildWords() {
	const nouns = {};
	for (const line of lines) { //.slice(0, 1000) 
		console.log(line);
		const parts = line.split(/\s/);
		const word = parts[0];
		const count = Number(parts[1]);
		if (!skipWord(word)) {
			const data = await getWordMetadata(word);
			data?.forEach(it => {
				addWordOrCount(nouns, it, count);
			});
		}
	}

	writeToFile(nouns, "all_nouns");
}

buildWords();
