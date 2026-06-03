const fs = require('fs');

const SRC = "./src";
const DEST = "./dest";
const template = fs.readFileSync("template.html", "utf8");

fs.rmSync(`${DEST}/words`, { recursive: true, force: true });

const wordsSrcDir = `${SRC}/words`;
const dates = fs.readdirSync(wordsSrcDir);

for (const date of dates) {
	const text = fs.readFileSync(`${wordsSrcDir}/${date}.txt`, "utf8");
	const lines = text.split(/\r?\n/);
	const array = "[" +lines.map((it) => `"${it}"`).join(",") + "]";
	console.log()
}
