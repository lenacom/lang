const fs = require('fs');

const SRC = "./src";
const DEST = "./dest";

const rawWords = fs.readFileSync(`${SRC}/fr/raw_words.txt`, "utf8");
const lines = rawWords.split(/\r?\n/);

const irregularVerbs = new Set(["absoudre","dissoudre","acquérir","conquérir","quérir","reconquérir","requérir","aller","assaillir","saillir","tressaillir","asseoir","rasseoir","avoir","battre","abattre","combattre","débattre","ébattre","embattre","rabattre","rebattre","boire","bouillir","choir","déchoir","échoir","clore","résoudre","déclore","éclore","enclore","forclore","conclure","exclure","inclure","occlure","confire","circoncire","frire","suffire","connaître","méconnaître","reconnaître","paraître","apparaître","comparaître","disparaître","réapparaître","recomparaître","reparaître","transparaître","coudre","découdre","recoudre","courir","accourir","concourir","encourir","parcourir","recourir","secourir","couvrir","découvrir","recouvrir","ouvrir","entrouvrir","rentrouvrir","rouvrir","souffrir","offrir","craindre","contraindre","plaindre","croire","croître","accroître","décroître","recroître","cueillir","accueillir","recueillir","cuire","recuire","conduire","déduire","éconduire","enduire","induire","introduire","produire","reconduire","réduire","réintroduire","reproduire","retraduire","séduire","traduire","construire","détruire","instruire","reconstruire","devoir","dire","contredire","dédire","interdire","maudire","médire","prédire","redire","dormir","endormir","rendormir","écrire","circonscrire","décrire","inscrire","prescrire","proscrire","récrire","réinscrire","retranscrire","souscrire","transcrire","être","faillir","défaillir","faire","contrefaire","défaire","malfaire","méfaire","parfaire","redéfaire","satisfaire","surfaire","falloir","fuir","enfuir","joindre","adjoindre","conjoindre","disjoindre","enjoindre","rejoindre","oindre","poindre","lire","élire","réélire","relire","luire","reluire","nuire","entre-nuire","mettre","admettre","commettre","démettre","émettre","entremettre","omettre","permettre","promettre","réadmettre","remettre","retransmettre","soumettre","transmettre","moudre","émoudre","remoudre","mourir","mouvoir","émouvoir","promouvoir","naître","renaître","ouîr","gésir","paître","repaître","peindre","dépeindre","repeindre","astreindre","étreindre","restreindre","atteindre","ceindre","enceindre","empreindre","feindre","geindre","teindre","déteindre","éteindre","reteindre","plaire","complaire","déplaire","taire","pleuvoir","pourvoir","pouvoir","prendre","apprendre","comprendre","détendre","déprendre","entreprendre","éprendre","méprendre","réapprendre","reprendre","surprendre","recevoir","apercevoir","concevoir","décevoir","percevoir","rendre","défendre","descendre","condescendre","fendre","pourfendre","refendre","dépendre","suspendre","tendre","attendre","distendre","entendre","étendre","prétendre","retendre","entendre","tendre","vendre","mévendre","épandre","répandre","fondre","confondre","parfondre","refondre","pondre","répondre","correspondre","tondre","perdre","reperdre","mordre","démordre","remordre","tordre","détordre","distordre","retordre","rompre","corrompre","interrompre","foutre","contrefoutre","rire","sourire","savoir","sentir","consentir","pressentir","ressentir","mentir","démentir","partir","départir","repartir","repentir","sortir","ressortir","seoir","messeoir","servir","desservir","resservir","suivre","ensuivre","poursuivre","surseoir","tenir","abstenir","appartenir","contenir","détenir","entretenir","maintenir","obtenir","retenir","soutenir","venir","advenir","circonvenir","contrevenir","convenir","devenir","disconvenir","intervenir","obvenir","parvenir","prévenir","provenir","redevenir","revenir","souvenir","subvenir","survenir","traire","abstraire","distraire","extraire","soustraire","braire","vaincre","convaincre","valoir","équivaloir","prévaloir","vêtir","dévêtir","revêtir","vivre","revivre","survivre","voir","entrevoir","prévoir","revoir","vouloir", "ouïr", "pendre", "haïr", "envoyer", "renvoyer", "compromettre", "enfreindre", "se morfondre", "redescendre", "revendre"]);

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
	return regular.filter(it => it.pos.code === "vrb")
	  .map(data => {
			const text = data.text;
			const ts = data.ts ?? "";
			const tr = data.tr[0].text;
			return { text, ts, tr };
		});
}

function addWordOrCount(map, data, count, irregular) {
	const text = data.text;
	if (map[text]) {
		map[text].count += count;
	} else {
		map[text] = data;
		map[text].count = count;
		map[text].irregular = irregular;
	}
}

function writeToFile(map, fileName) {
	const data = [];
	for (const value of Object.values(map)) {
		const row = [value.text, value.count, value.irregular];
		data.push(row);
	};
	data.sort((a, b) => b[1] - a[1]);
	let content = "const all_verbs = [\r\n";
	content += data.map(it => `["${it[0]}", ${it[1]}, ${it[2]}],`).join("\r\n"); 
	content += "]\r\n";
	fs.writeFileSync(`${SRC}/fr/${fileName}.js`, content);
}

async function buildWords() {
	const verbs = {};
	const strange = {};
	for (const line of lines) { //.slice(0, 1000) 
		console.log(line);
		const parts = line.split(/\s/);
		const word = parts[0];
		const count = Number(parts[1]);
		if (!skipWord(word)) {
			const data = await getWordMetadata(word);
			data?.forEach(it => {
				const irregular = irregularVerbs.has(it.text);
				if (irregular || it.text.endsWith("er") || it.text.endsWith("ir")) {	
					addWordOrCount(verbs, it, count, irregular);
				} else {
					addWordOrCount(strange, it, count, false);
				}
			});
		}
	}

	writeToFile(verbs, "all_verbs");
	writeToFile(strange, "strange_verbs");
}

buildWords();
