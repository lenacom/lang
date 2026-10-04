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

const GENDER_ARTICLES = new Set([
  "un", "une", "le", "la", "du", "au", "son", "sa", "ce", "cet", "cette",
  "aucun", "aucune", "ma", "ta", "mon", "ton",
]);
const PLURAL_ARTICLES = new Set(["les", "des", "ses", "ces", "mes", "tes"]);
const ARTICLE_GENDER = {
  un: "m", une: "f", le: "m", la: "f", du: "m", au: "m", son: "m", sa: "f",
  ce: "m", cet: "m", cette: "f", aucun: "m", aucune: "f",
  ma: "f", ta: "f", mon: "m", ton: "m",
};
// "mon"/"ton"/"son" also stand in for "ma"/"ta"/"sa" right before a
// vowel/mute-h-initial feminine noun (euphony, e.g. "mon amie") - see the
// VOWEL_START_RE check below
const POSSESSIVE_VOWEL_EXCEPTION = new Set(["son", "mon", "ton"]);
// closed-class words that can never themselves be the noun - without this,
// a lookahead landing on one of them can pick up a bogus noun sense Yandex
// returns for an accent-insensitive homograph (e.g. "de" matched as "dé")
const STOPWORDS = new Set([
  "de", "et", "à", "en", "y", "se", "ne", "pas", "que", "qui", "dont", "où",
  "leur", "leurs", "lui",
  "nous", "vous", "il", "elle", "ils", "elles", "on", "je", "tu", "moi",
  "toi", "aux", "car", "donc", "mais", "ou", "si", "comme",
  "sans", "sous", "dans", "pour", "avec", "chez", "entre", "vers", "par",
  "après", "avant", "pendant", "depuis",
]);
const ELISION_RE = /^(l['’])(\p{L}.*)$/u;
// a preceding word elided onto "un"/"une" with nothing after (e.g. "d’une", "qu’un") -
// the elided part (e.g. "d’") is not itself an article and is never highlighted
const TRAILING_ARTICLE_RE = /^(\p{L}+['’])(une?)$/iu;
const CLEAN_RE = /^[^\p{L}]+|[^\p{L}]+$/gu;
const VOWEL_START_RE = /^[aeiouyâàéèêëîïôöûüùœæh]/iu;

function cleanWord(token) {
  return token.toLowerCase().replace(CLEAN_RE, "");
}

function lookupGender(word, nounGender) {
  const direct = nounGender.get(word);
  if (direct) return direct;
  // the dictionary only stores singular forms - fall back to the
  // regular plural-"s" singular when the plural itself isn't listed
  if (word.endsWith("s") && word.length > 1) {
    return nounGender.get(word.slice(0, -1));
  }
  return undefined;
}

function buildNounGenderMap() {
  const raw = fs.readFileSync(`${SRC}/fr/all_nouns.js`, "utf8");
  const allNouns = new Function(`${raw}\nreturn all_nouns;`)();
  const map = new Map();
  for (const [word, , gender] of allNouns) {
    const key = word.toLowerCase();
    if (!map.has(key) && (gender === "m" || gender === "f")) {
      map.set(key, gender);
    }
  }
  return map;
}

function findArticleInfo(tokens, i) {
  const token = tokens[i];
  const elisionMatch = token.match(ELISION_RE);
  const trailingMatch = !elisionMatch && token.match(TRAILING_ARTICLE_RE);
  const cleanedToken = cleanWord(token);

  let outerPrefix = "";
  let articlePrefix = token;
  let articleRemainder = null;
  let isGenderArticle = false;
  let isPluralArticle = false;
  let expectedGender = null;

  if (elisionMatch) {
    articlePrefix = elisionMatch[1];
    articleRemainder = elisionMatch[2];
    isGenderArticle = true;
    // "l'" could be an elided "le" or "la" - gender is unknown until the
    // noun itself is found, so there is nothing to check agreement against
  } else if (trailingMatch) {
    outerPrefix = trailingMatch[1];
    articlePrefix = trailingMatch[2];
    isGenderArticle = true;
    expectedGender = ARTICLE_GENDER[articlePrefix.toLowerCase()];
  } else if (GENDER_ARTICLES.has(cleanedToken)) {
    isGenderArticle = true;
    expectedGender = ARTICLE_GENDER[cleanedToken];
  } else if (PLURAL_ARTICLES.has(cleanedToken)) {
    isPluralArticle = true;
  }

  if (!isGenderArticle && !isPluralArticle) {
    return null;
  }

  const candidates = [];
  if (articleRemainder !== null) {
    candidates.push({ word: articleRemainder, tokenIndex: i });
  }
  let idx = i + 1;
  while (candidates.length < 3 && idx < tokens.length) {
    if (!/^\s+$/.test(tokens[idx])) {
      candidates.push({ word: tokens[idx], tokenIndex: idx });
    }
    idx++;
  }

  if (
    POSSESSIVE_VOWEL_EXCEPTION.has(cleanedToken) &&
    candidates.length > 0 &&
    VOWEL_START_RE.test(cleanWord(candidates[0].word))
  ) {
    expectedGender = null;
  }

  return {
    outerPrefix,
    articlePrefix,
    articleRemainder,
    isGenderArticle,
    expectedGender,
    candidates,
  };
}

function highlightNounGender(line, nounGender) {
  const tokens = line.split(/(\s+)/);
  const result = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const info = findArticleInfo(tokens, i);

    if (!info) {
      result.push(token);
      i++;
      continue;
    }

    const { outerPrefix, articlePrefix, articleRemainder, expectedGender, candidates } =
      info;

    let matchedGender = null;
    let matchedCandidate = null;
    for (const candidate of candidates) {
      const cleaned = cleanWord(candidate.word);
      // a determiner or other closed-class word can't itself be the noun -
      // skip it so an unrelated search can't swallow it as a false match
      if (
        GENDER_ARTICLES.has(cleaned) ||
        PLURAL_ARTICLES.has(cleaned) ||
        STOPWORDS.has(cleaned)
      ) {
        continue;
      }
      const gender = lookupGender(cleaned, nounGender);
      if (gender && (!expectedGender || gender === expectedGender)) {
        matchedGender = gender;
        matchedCandidate = candidate;
        break;
      }
    }

    if (!matchedGender) {
      result.push(token);
      i++;
      continue;
    }

    if (matchedCandidate.tokenIndex === i) {
      // the noun is the elision remainder itself ("l'" + noun) - only the
      // noun part is highlighted, never the article
      result.push(articlePrefix);
      result.push(`<span class="${matchedGender}">${articleRemainder}</span>`);
      i++;
    } else {
      // only the noun is highlighted - articles are never highlighted
      // themselves (too many false positives: "le"/"la" are often pronouns,
      // not articles, and the lookahead can land on an unrelated noun)
      result.push(outerPrefix);
      result.push(articlePrefix);
      if (articleRemainder !== null) {
        result.push(articleRemainder);
      }
      i++;
      while (i < matchedCandidate.tokenIndex) {
        result.push(tokens[i]);
        i++;
      }
      result.push(
        `<span class="${matchedGender}">${tokens[matchedCandidate.tokenIndex]}</span>`,
      );
      i = matchedCandidate.tokenIndex + 1;
    }
  }
  return result.join("");
}

function collectUnresolvedWords(line, nounGender, unresolved) {
  const tokens = line.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i++) {
    const info = findArticleInfo(tokens, i);
    if (!info) continue;

    for (const candidate of info.candidates) {
      const cleaned = cleanWord(candidate.word);
      if (
        GENDER_ARTICLES.has(cleaned) ||
        PLURAL_ARTICLES.has(cleaned) ||
        STOPWORDS.has(cleaned)
      ) {
        continue;
      }
      const gender = lookupGender(cleaned, nounGender);
      if (gender) {
        if (!info.expectedGender || gender === info.expectedGender) {
          break; // static match found - highlightNounGender would stop here too
        }
        continue; // found but gender mismatches the article - not a dictionary gap
      }
      if (cleaned) {
        unresolved.add(cleaned);
      }
    }
  }
}

const GENDER_CACHE_PATH = `${SRC}/fr/noun_gender_cache.json`;

function loadGenderCache() {
  try {
    return JSON.parse(fs.readFileSync(GENDER_CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveGenderCache(cache) {
  fs.writeFileSync(GENDER_CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function getYandexJson(word) {
  const url = new URL(
    "https://dictionary.yandex.net/dicservice.json/lookupMultiple",
  );
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

async function fetchGenderFromYandex(word) {
  const json = await getYandexJson(word);
  const regular = json["fr-ru"]?.["regular"];
  if (!regular || regular.length === 0) {
    return null;
  }
  const noun = regular.find((it) => it.pos?.code === "nn");
  const gen = noun?.gen?.code;
  return gen === "m" || gen === "f" ? gen : null;
}

async function resolveMissingGenders(unresolvedWords, cache) {
  for (const word of unresolvedWords) {
    if (word in cache) continue;
    try {
      cache[word] = await fetchGenderFromYandex(word);
    } catch (e) {
      console.error(`Yandex lookup failed for "${word}": ${e.message}`);
    }
  }
}

function mergeGenderMap(baseMap, cache) {
  const merged = new Map(baseMap);
  for (const [word, gender] of Object.entries(cache)) {
    if ((gender === "m" || gender === "f") && !merged.has(word)) {
      merged.set(word, gender);
    }
  }
  return merged;
}

const nounGenderMap = buildNounGenderMap();

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
        collectUnresolvedWords(line, nounGenderMap, unresolved);
      }
      await resolveMissingGenders(unresolved, genderCache);
      saveGenderCache(genderCache);
      const mergedMap = mergeGenderMap(nounGenderMap, genderCache);
      processedLines = rawLines.map((line) =>
        highlightNounGender(line, mergedMap),
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
