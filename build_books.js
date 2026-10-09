const fs = require("fs");

const PREVIOUS = "Предыдущая глава";
const NEXT = "Следующая глава";

const SRC = "./src";
const DEST = "./dest";
const bookTemplate = fs.readFileSync("templates/book.html", "utf8");
const indexTemplate = fs.readFileSync("templates/index.html", "utf8");
const counter = fs.readFileSync("templates/yandex_counter.html", "utf8");

fs.rmSync(`${DEST}`, { recursive: true, force: true });
fs.mkdirSync(DEST);
fs.cpSync(`${SRC}/css`, `${DEST}/css`, { recursive: true });
fs.cpSync(`${SRC}/js`, `${DEST}/js`, { recursive: true });

const {
  nounGenderMap,
  loadGenderCache,
  saveGenderCache,
  collectUnresolvedWords,
  resolveMissingGenders,
  mergeGenderMap,
  highlightNounGender,
} = require("./src/fr/gender_highlight.js");

function createFileContent(fileName, title, body, selfPath, lang) {
  const content = bookTemplate
    .replace("[TITLE]", title)
    .replace("[BODY]", body + counter)
    .replaceAll("[SELF_PATH]", selfPath)
    .replaceAll("[LANG]", lang);
  fs.writeFileSync(fileName, content);
}

function chapterLinks(currentIndex, countChapters) {
  let result = "<div class='chapter-links'>";
  for (let index = 1; index <= countChapters; index++) {
    result +=
      index === currentIndex
        ? `<span class="current">${index}</span> `
        : `<a href='${index}.html'>${index}</a> `;
  }
  return result + "</div>";
}

function nextPreviousChapterLinks(currentIndex, countChapters) {
  const previous =
    currentIndex === 1
      ? ""
      : `<a href="${currentIndex - 1}.html">${PREVIOUS}</a>`;
  const next =
    currentIndex === countChapters
      ? ""
      : `<a href="${currentIndex + 1}.html">${NEXT}</a>`;
  return `<div class='chapter-links'>${previous}${next}</div>`;
}

async function buildChapters(lang, book, text, metadata, genderCache) {
  const lines = text.split(/\r?\n/);
  const chapterLines = [];
  for (const line of lines) {
    if (line.startsWith(`${metadata.chapter} `)) {
      chapterLines.push([]);
    } else if (line.trim().length > 0) {
      chapterLines[chapterLines.length - 1].push(line);
    }
  }

  const chapters = [];
  for (let idx = 0; idx < chapterLines.length; idx++) {
    const rawLines = chapterLines[idx];

    let processedLines = rawLines;
    if (lang === "fr") {
      const unresolved = new Set();
      for (const line of rawLines) {
        collectUnresolvedWords(line, nounGenderMap, unresolved, genderCache);
      }
      await resolveMissingGenders(unresolved, genderCache);
      saveGenderCache(genderCache);
      const mergedMap = mergeGenderMap(nounGenderMap, genderCache);
      processedLines = rawLines.map((line) =>
        highlightNounGender(line, mergedMap, genderCache),
      );
    }

    chapters.push(
      processedLines
        .map(
          (line) => `<div>${line.replace(/([0-9]+)\s/, "<sup>$1</sup> ")}</div>`,
        )
        .join(""),
    );
  }
  return chapters;
}

async function main() {
  const genderCache = loadGenderCache();
  const booksSrcDir = `${SRC}/books`;
  const langs = fs.readdirSync(booksSrcDir);
  let index = "";

  for (const lang of langs) {
    const langSrcDir = `${booksSrcDir}/${lang}`;
    const langDestDir = `${DEST}/${lang}`;
    fs.mkdirSync(langDestDir);
    for (const book of ["mf", "mk", "lk", "jn"]) {
      const bookDir = `${langSrcDir}/${book}`;
      const metadata = JSON.parse(fs.readFileSync(`${bookDir}/metadata.json`));
      const text = fs.readFileSync(`${bookDir}/${metadata.code}.txt`, "utf8");

      const chapters = await buildChapters(
        lang,
        book,
        text,
        metadata,
        genderCache,
      );

      const bookDestDir = `${langDestDir}/${book}`;
      fs.mkdirSync(bookDestDir);
      const baseIndexPath = `${lang}/${book}`;

      const countChapters = chapters.length;
      chapters.forEach((chapter, index) => {
        const currentIndex = index + 1;
        const fileName = `${bookDestDir}/${currentIndex}.html`;
        const nextPrevious = nextPreviousChapterLinks(
          currentIndex,
          countChapters,
        );
        const body =
          `<h1 class="title">${metadata.name}</h1><h2 class="chapter">${metadata.chapter} ${currentIndex}</h2>` +
          chapterLinks(currentIndex, countChapters) +
          nextPrevious +
          chapter +
          nextPrevious;
        createFileContent(
          fileName,
          `${metadata.name} ${currentIndex}`,
          body,
          `${baseIndexPath}/${currentIndex}.html`,
          lang,
        );
      });

      index += `<div><a href="${baseIndexPath}/1.html">${metadata.name}</a></div>`;
    }
  }

  const content = indexTemplate
    .replace("[TITLE]", "Евангелие")
    .replace("[BODY]", index + counter);
  fs.writeFileSync(`${DEST}/index.html`, content);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
