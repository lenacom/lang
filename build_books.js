const fs = require("fs");

const PREVIOUS = "Предыдущая глава";
const NEXT = "Следующая глава";

// approximate size (in characters) of a piece when a single-file book has no chapters
const CHUNK_SIZE = 6000;
const SINGLE_FILE_CHAPTER = "Chapitre";

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

// A text copied from a printed book keeps its line wraps. Lines are glued back
// into paragraphs; a paragraph ends where a line finishes a sentence and the
// next one starts a new one (capital letter, quote or dialogue dash), so a
// phrase is never cut in the middle. Words hyphenated at the wrap ("au- teur",
// or "au-" at the end of a line) are put back together.
function reflowParagraphs(lines, isHeading) {
  const result = [];
  let current = "";
  const flush = () => {
    if (current) result.push(current);
    current = "";
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0 || isHeading(line)) {
      flush();
      if (line.length > 0) result.push(line);
      continue;
    }
    if (current) {
      if (/\p{Ll}-$/u.test(current) && /^\p{Ll}/u.test(line)) {
        current = current.slice(0, -1) + line;
      } else {
        current += " " + line;
      }
    } else {
      current = line;
    }
    const endsSentence = /[.!?…»]["»]?$/u.test(current);
    const next = lines.slice(i + 1).find((l) => l.trim());
    if (endsSentence && (!next || /^[\p{Lu}«—–"]/u.test(next.trim()))) {
      flush();
    }
  }
  flush();
  return result.map((p) => p.replace(/(\p{Ll}{2,})- (\p{Ll})/gu, "$1$2"));
}

async function buildChapters(lang, book, text, metadata, genderCache) {
  let lines = text.split(/\r?\n/);
  // a chapter heading is the chapter word followed by ONLY its number (e.g.
  // "Psaume 3") - matching on startsWith alone would also catch a psalm's own
  // superscription line when it happens to begin with the same word (e.g.
  // "Psaume de David. A l'occasion de sa fuite..."), wrongly splitting that
  // line into a new chapter and leaving the real chapter empty
  const chapterHeadingRe = new RegExp(`^${metadata.chapter} [0-9]+$`);
  // a line written entirely in capitals is also a heading (e.g. the tale
  // titles of "conte"); it needs at least one letter, so "[p. 29]" or a bare
  // number never counts
  const isUpperCaseHeading = (line) =>
    /\p{L}/u.test(line) && line === line.toUpperCase();
  // a single-file book has no metadata.json to say how it is organised, so
  // only the plain "Chapitre N" headings count there: an all-capitals line such
  // as the author's name on the first line must not become a chapter
  const useUpperCaseHeadings = !metadata.singleFile;
  if (metadata.singleFile) {
    lines = reflowParagraphs(lines, (line) => chapterHeadingRe.test(line));
  }
  const chapterLines = [];
  const chapterTitles = [];
  for (const line of lines) {
    const isNumbered = chapterHeadingRe.test(line.trim());
    if (isNumbered || (useUpperCaseHeadings && isUpperCaseHeading(line.trim()))) {
      chapterLines.push([]);
      // the chapter number is shown by the page itself; only a heading that
      // carries a name of its own (a tale title) is kept, under the number
      chapterTitles.push(isNumbered ? "" : line.trim());
    } else if (line.trim().length > 0) {
      // text before the first heading still belongs to a chapter
      if (chapterLines.length === 0) {
        chapterLines.push([]);
        chapterTitles.push("");
      }
      chapterLines[chapterLines.length - 1].push(line);
    }
  }
  if (metadata.singleFile && chapterLines.length <= 1) {
    // no chapter headings were found: cut the text into pieces of a sensible size
    const all = lines.filter((line) => line.trim().length > 0);
    chapterLines.length = 0;
    chapterTitles.length = 0;
    let chunk = [];
    let size = 0;
    for (const line of all) {
      chunk.push(line);
      size += line.length;
      if (size >= CHUNK_SIZE) {
        chapterLines.push(chunk);
        chapterTitles.push("");
        chunk = [];
        size = 0;
      }
    }
    // a short tail is merged into the previous piece instead of standing alone
    if (chunk.length > 0) {
      if (chapterLines.length > 0 && size < CHUNK_SIZE / 2) {
        chapterLines[chapterLines.length - 1].push(...chunk);
      } else {
        chapterLines.push(chunk);
        chapterTitles.push("");
      }
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

    const title = chapterTitles[idx]
      ? `<h3 class="chapter-title">${chapterTitles[idx]}</h3>`
      : "";
    chapters.push(
      title +
        processedLines
        .map(
          (line) => `<div>${line.replace(/([0-9]+)\s/, "<sup>$1</sup> ")}</div>`,
        )
        .join(""),
    );
  }
  return chapters;
}

// the book code ends up in URLs, so it is made of plain lowercase latin letters
// and digits: "La gloire de mon père" -> "la-gloire-de-mon-pere"
function codeFromFileName(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// books of a language: first the folders (metadata.json + <code>.txt), then
// the bare .txt files lying right in the language folder
function listBooks(langSrcDir) {
  const known = ["mf", "mk", "lk", "jn", "psaumes", "conte"];
  const entries = fs.readdirSync(langSrcDir, { withFileTypes: true });
  const dirs = entries
    .filter(
      (e) =>
        e.isDirectory() &&
        fs.existsSync(`${langSrcDir}/${e.name}/metadata.json`),
    )
    .map((e) => e.name)
    .sort((a, b) => {
      const ia = known.indexOf(a);
      const ib = known.indexOf(b);
      return (ia < 0 ? known.length : ia) - (ib < 0 ? known.length : ib);
    });
  const books = dirs.map((dir) => {
    const bookDir = `${langSrcDir}/${dir}`;
    const metadata = JSON.parse(fs.readFileSync(`${bookDir}/metadata.json`));
    return {
      code: dir,
      metadata,
      text: fs.readFileSync(`${bookDir}/${metadata.code}.txt`, "utf8"),
    };
  });
  const taken = new Set(dirs);
  const files = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".txt"))
    .map((e) => e.name)
    .sort();
  for (const file of files) {
    const name = file.replace(/\.txt$/i, "");
    const code = codeFromFileName(name) || `book-${taken.size + 1}`;
    if (taken.has(code)) {
      throw new Error(`Book code "${code}" of "${file}" is already used`);
    }
    taken.add(code);
    books.push({
      code,
      metadata: { name, chapter: SINGLE_FILE_CHAPTER, singleFile: true },
      text: fs.readFileSync(`${langSrcDir}/${file}`, "utf8"),
    });
  }
  return books;
}

async function main() {
  const genderCache = loadGenderCache();
  const booksSrcDir = `${SRC}/books`;
  const langs = fs
    .readdirSync(booksSrcDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  let index = "";

  for (const lang of langs) {
    const langSrcDir = `${booksSrcDir}/${lang}`;
    const langDestDir = `${DEST}/${lang}`;
    fs.mkdirSync(langDestDir);
    for (const { code: book, metadata, text } of listBooks(langSrcDir)) {

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
