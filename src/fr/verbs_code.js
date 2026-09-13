const infinitives = [];
const formToInfinitives = {};
const endingToVerbType = {};
const endingToTenses = {};

const LANG = "fr-ru";

function prefix(value) {
  return `frh__${value}`;
}

function byPrefixId(value) {
  return document.getElementById(prefix(value));
}

function buildVerbs() {
  function getId(array, item) {
    const id = array.indexOf(item);
    if (id >= 0) {
      return id;
    }
    array.push(item);
    return array.length - 1;
  }

  function addMultipleValue(map, key, value) {
    if (!map[key]) {
      map[key] = [];
    }
    if (!map[key].includes(value)) {
      map[key].push(value);
    }
  }

  for (const [infinitive, data] of Object.entries(irregularVerbs)) {
    for (const [tense, forms] of Object.entries(data)) {
      const infinitiveId = getId(infinitives, infinitive);
      for (const form of Array.isArray(forms) ? forms : [forms]) {
        addMultipleValue(formToInfinitives, form, infinitiveId);
      }
    }
  }

  for (const [verbType, data] of Object.entries(regularVerbs)) {
    for (const [tense, endings] of Object.entries(data)) {
      for (const ending of Array.isArray(endings) ? endings : [endings]) {
        endingToVerbType[ending] = verbType;
      }
      if (["participe présent", "participe passé"].includes(tense)) {
        for (const agreement of ["e", "s", "es"]) {
          endingToVerbType[endings + agreement] = verbType;
        }
      }
    }
  }
}
buildVerbs();

function replaceLastOccurance(text, char, replacement) {
  const index = text.lastIndexOf(char);
  return text.substring(0, index) + replacement + text.substring(index + 1);
}

function verbTenses(infinitive, form = "") {
  const tenses = irregularVerbs[infinitive];
  if (tenses) {
    const type = infinitive === "haïr" ? "regular" : "irregular";
    return { infinitive, type, tenses };
  } else if (/er$|ir$/i.test(infinitive)) {
    const verbType = /er$/i.test(infinitive) ? "1" : "2";
    const base = infinitive.slice(0, infinitive.length - 2);
    return {
      infinitive,
      type: "regular",
      tenses: regularVerbTenses(base, verbType, form),
    };
  }
  return { infinitive, type: "unknown", tenses: {} };
}

function regularVerbTenses(base, verbType, form) {
  const tenses = {};
  for (const [tenseName, endings] of Object.entries(regularVerbs[verbType])) {
    const normalizedEndings = Array.isArray(endings) ? endings : [endings];
    const tenseForms = [];
    for (let i = 0; i < normalizedEndings.length; i++) {
      tenseForms[i] = base;
      if (verbType === "1") {
        const cond1 =
          (["présent", "subjonctif présent"].includes(tenseName) &&
            (i < 3 || i === 5)) ||
          (tenseName === "imperatif" && i === 0);
        const cond2 = ["futur simple", "conditionnel présent"].includes(
          tenseName,
        );
        if (/el$|et$/i.test(base) && (cond1 || cond2)) {
          if (
            [
              "achet",
              "béguet",
              "cisel",
              "congel",
              "corset",
              "crochet",
              "décel",
              "dégel",
              "démantel",
              "écartel",
              "encastel",
              "filet",
              "furet",
              "gel",
              "halet",
              "martel",
              "model",
              "pel",
              "rachet",
              "recel",
              "surgel",
              "cel",
            ].includes(base)
          ) {
            tenseForms[i] = replaceLastOccurance(base, "e", "è");
          } else {
            tenseForms[i] = base + base.at(-1);
          }
        } else if (
          /ec$|em$|ep$|er$|es$|ev$|evr$/.test(base) &&
          (cond1 || cond2)
        ) {
          tenseForms[i] = replaceLastOccurance(base, "e", "è");
        } else if (
          /ébr$|éc$|éch$|écr$|éd$|égl$|égn$|égr$|égu$|él$|ém$|én$|équ$|ér$|és$|ét$|étr$|évr$|éy$/i.test(
            base,
          ) &&
          cond1
        ) {
          tenseForms[i] = replaceLastOccurance(base, "é", "è");
        } else if (
          base.endsWith("g") &&
          "oaâ".includes(normalizedEndings[i].at(0))
        ) {
          tenseForms[i] += "e";
        } else if (
          base.endsWith("c") &&
          "oaâ".includes(normalizedEndings[i].at(0))
        ) {
          tenseForms[i] = base.slice(0, -1) + "ç";
        } else if (
          /ay$/.test(base) &&
          /ai$/.test(form.substring(0, base.length)) &&
          (cond1 || cond2)
        ) {
          tenseForms[i] = replaceLastOccurance(base, "y", "i");
        } else if (/oy$|uy$/.test(base) && (cond1 || cond2)) {
          tenseForms[i] = replaceLastOccurance(base, "y", "i");
        }
      }
      tenseForms[i] += normalizedEndings[i];
    }
    tenses[tenseName] = tenseForms.length > 1 ? tenseForms : tenseForms[0];
  }
  return tenses;
}

function findInfinitiveTenses(text) {
  if (infinitives.includes(text)) {
    return [verbTenses(text)];
  }
  if (/er$/i.test(text) && regularVerbBases1.has(text.slice(0, -2))) {
    return [verbTenses(text)];
  }
  if (/ir$/i.test(text) && regularVerbBases2.has(text.slice(0, -2))) {
    return [verbTenses(text)];
  }
  return undefined;
}

function getConjugation(form) {
  const infinitiveIds = formToInfinitives[form];
  if (infinitiveIds !== undefined) {
    return infinitiveIds.map((id) => {
      const infinitive = infinitives[id];
      return verbTenses(infinitive, form);
    });
  } else {
    for (let i = 1; i <= 8; i++) {
      const baseLength = form.length - i;
      if (baseLength >= 2) {
        let base = form.slice(0, baseLength);
        const ending = form.slice(baseLength);
        let verbType = endingToVerbType[ending];
        if (verbType) {
          const verbs =
            verbType === "1" ? regularVerbBases1 : regularVerbBases2;
          const bases = [base];
          if (verbType === "1") {
            if (/ell$|ett$|ge$/i.test(base)) {
              bases[1] = base.slice(0, -1);
            } else if (/èt$|èl$|èc$|èm$|èp$|èr$|ès$|èv$|èvr$/i.test(base)) {
              bases[1] = replaceLastOccurance(base, "è", "e");
            } else if (
              /èbr$|èc$|èch$|ècr$|èd$|ègl$|ègn$|ègr$|ègu$|èl$|èm$|èn$|èqu$|èr$|ès$|èt$|ètr$|èvr$|èy$/i.test(
                base,
              )
            ) {
              bases[1] = replaceLastOccurance(base, "è", "é");
            } else if (/ç$/i.test(base)) {
              bases[1] = replaceLastOccurance(base, "ç", "c");
            } else if (/ai$|oi$|ui$/i.test(base)) {
              bases[1] = replaceLastOccurance(base, "i", "y");
            }
          }
          const result = bases
            .map((base) => {
              if (verbs.has(base)) {
                const infinitive = base + (verbType === "1" ? "er" : "ir");
                return verbTenses(infinitive, form);
              }
            })
            .filter((it) => it);
          if (result.length) {
            return result;
          }
        }
      }
    }
  }
}

function getYandexTranslationURL(text) {
  const url = new URL(
    "https://dictionary.yandex.net/dicservice.json/lookupMultiple",
  );
  url.searchParams.set("ui", "ru");
  url.searchParams.set("lang", LANG);
  url.searchParams.set("dict", LANG + ".regular");
  url.searchParams.set("type", "regular");
  url.searchParams.set("flags", "15783");
  url.searchParams.set("srv", "tr-text");
  url.searchParams.set("text", text);
  return url;
}

async function getTranslation(text) {
  try {
    const response = await fetch(getYandexTranslationURL(text));
    const json = await response.json();

    const regular = json[LANG]["regular"];
    if (!regular || regular.length === 0) {
      return undefined;
    }

    return regular;
  } catch (e) {
    return undefined;
  }
}

const WORD_TO_LEARN_KEY = "wordsToLearn";
let learnedSession = null;

function migrateWordsToLearnStorage() {
  const oldRaw = localStorage.getItem("learnedWords");
  if (oldRaw === null) {
    return;
  }
  const oldData = JSON.parse(oldRaw);
  const newData = JSON.parse(localStorage.getItem(WORD_TO_LEARN_KEY) ?? "{}");
  for (const [book, chapters] of Object.entries(oldData)) {
    if (!newData[book]) {
      newData[book] = {};
    }
    for (const [chapter, entries] of Object.entries(chapters)) {
      if (!newData[book][chapter]) {
        newData[book][chapter] = [];
      }
      newData[book][chapter].push(...entries);
    }
  }
  localStorage.setItem(WORD_TO_LEARN_KEY, JSON.stringify(newData));
  localStorage.removeItem("learnedWords");
}

function getWordsToLearn() {
  migrateWordsToLearnStorage();
  return JSON.parse(localStorage.getItem(WORD_TO_LEARN_KEY) ?? "{}");
}

function setWordsToLearn(data) {
  localStorage.setItem(WORD_TO_LEARN_KEY, JSON.stringify(data));
}

function generateWordToLearnId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function saveWordToLearn(word, translation) {
  const book = document.querySelector(".title")?.textContent ?? "";
  const chapter = document.querySelector(".chapter")?.textContent ?? "";
  const data = getWordsToLearn();
  if (!data[book]) {
    data[book] = {};
  }
  if (!data[book][chapter]) {
    data[book][chapter] = [];
  }
  data[book][chapter].push([word, translation, false, generateWordToLearnId()]);
  setWordsToLearn(data);
  refreshWordsToLearnLink();
}

function getLearnedEntry(book, chapter, id) {
  const data = getWordsToLearn();
  return (data[book]?.[chapter] ?? []).find((entry) => entry[3] === id);
}

function findWordToLearnLocation(word) {
  const normalized = stripAnnotations(word);
  const data = getWordsToLearn();
  for (const [book, chapters] of Object.entries(data)) {
    for (const [chapter, entries] of Object.entries(chapters)) {
      if (entries.some((entry) => stripAnnotations(entry[0]) === normalized)) {
        return { book, chapter };
      }
    }
  }
  return null;
}

function escJs(text) {
  return text.replace(/'/g, "\\'");
}

function refreshWordsToLearnLink() {
  const book = document.querySelector(".title")?.textContent ?? "";
  const chapterLinksEl = document.querySelector(".chapter-links");
  if (!chapterLinksEl) {
    return;
  }
  const existingLink = byPrefixId("wordsToLearnLink");
  const data = getWordsToLearn();
  const hasWords = Object.values(data[book] ?? {}).some(
    (list) => list.length > 0,
  );

  if (!hasWords) {
    existingLink?.parentElement?.remove();
    return;
  }
  if (existingLink) {
    return;
  }

  chapterLinksEl.insertAdjacentHTML(
    "beforebegin",
    `<div><a id="${prefix("wordsToLearnLink")}" class="${prefix("link")}" href="javascript:void(0)" onclick="openWordsToLearnChooser()">Учить слова</a></div>`,
  );
}

function initWordsToLearnUI() {
  if (!document.querySelector(".chapter-links")) {
    return;
  }
  if (!byPrefixId("wordsToLearnDialog")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<style>.${prefix("link")} { text-decoration: none; } .${prefix("link")}:hover { text-decoration: underline; }</style>
      <dialog id="${prefix("wordsToLearnDialog")}" style="border-radius: 0.31rem; background-color: black; color: #fff8dc; border: 1px solid #fff8dc; padding: 0.63rem; max-width: ${document.documentElement.clientWidth}px;">
        <div id="${prefix("wordsToLearnContent")}" style="display: flex; flex-direction: column; gap: 0.5rem; width: ${Math.min(document.documentElement.clientWidth / 16, 20)}rem;"></div>
      </dialog>`,
    );
  }
  refreshWordsToLearnLink();
}

function wordsToLearnChooserHTML() {
  const book = document.querySelector(".title")?.textContent ?? "";
  const data = getWordsToLearn();
  const chapters = Object.keys(data[book] ?? {}).filter(
    (chapter) => (data[book][chapter] ?? []).length > 0,
  );
  const totalCount = chapters.reduce(
    (sum, chapter) => sum + data[book][chapter].length,
    0,
  );

  const items = [];
  items.push(`<h3 style="margin: 0; padding: 0;">Учить слова</h3>`);
  if (totalCount > 0) {
    items.push(
      `<div><a class="${prefix("link")}" href="javascript:void(0)" onclick="startWordsToLearnStudy('${escJs(book)}', null)">${book} (${totalCount})</a></div>`,
    );
  }
  for (const chapter of chapters) {
    items.push(
      `<div><a class="${prefix("link")}" href="javascript:void(0)" onclick="startWordsToLearnStudy('${escJs(book)}', '${escJs(chapter)}')">${chapter} (${data[book][chapter].length})</a></div>`,
    );
  }
  items.push(
    `<div style="display: flex; flex-direction: row; justify-content: flex-end; gap: 0.5rem; padding-top: 0.5rem;">
      <button style="margin: 0;" onClick="document.getElementById('${prefix("wordsToLearnDialog")}').close();">Закрыть</button>
    </div>`,
  );
  return items.join("");
}

function openWordsToLearnChooser() {
  byPrefixId("wordsToLearnContent").innerHTML = wordsToLearnChooserHTML();
  const dialog = byPrefixId("wordsToLearnDialog");
  if (!dialog.open) {
    dialog.showModal();
  }
}

function collectWordsToLearnSessionRefs() {
  const { book, chapterFilter, shown } = learnedSession;
  const data = getWordsToLearn();
  const chapters = chapterFilter ? [chapterFilter] : Object.keys(data[book] ?? {});
  const refs = [];
  for (const chapter of chapters) {
    for (const entry of data[book]?.[chapter] ?? []) {
      if (!shown.has(entry[3])) {
        refs.push({ chapter, id: entry[3] });
      }
    }
  }
  return refs;
}

function pickNextWordToLearn() {
  const refs = collectWordsToLearnSessionRefs();
  if (refs.length === 0) {
    learnedSession.currentRef = null;
    learnedSession.revealed = false;
    return;
  }
  const repeatRefs = refs.filter(
    (ref) => getLearnedEntry(learnedSession.book, ref.chapter, ref.id)?.[2],
  );
  const pool = repeatRefs.length ? repeatRefs : refs;
  learnedSession.currentRef = pool[Math.floor(Math.random() * pool.length)];
  learnedSession.revealed = false;
}

function startWordsToLearnStudy(book, chapterFilter) {
  learnedSession = { book, chapterFilter, shown: new Set() };
  pickNextWordToLearn();
  renderWordsToLearnStudy();
}

function nextWordToLearn() {
  if (!learnedSession.revealed) {
    learnedSession.revealed = true;
    if (getWordsToLearnAutospeak()) {
      const { book, currentRef } = learnedSession;
      speak(stripAnnotations(getLearnedEntry(book, currentRef.chapter, currentRef.id)[0]));
    }
  } else {
    learnedSession.shown.add(learnedSession.currentRef.id);
    pickNextWordToLearn();
  }
  renderWordsToLearnStudy();
}

function toggleWordToLearnRepeat(checked) {
  const { book, currentRef } = learnedSession;
  const data = getWordsToLearn();
  const entry = data[book]?.[currentRef.chapter]?.find(
    (it) => it[3] === currentRef.id,
  );
  if (entry) {
    entry[2] = checked;
    setWordsToLearn(data);
  }
}

function deleteWordToLearn() {
  const { book, currentRef } = learnedSession;
  const word = getLearnedEntry(book, currentRef.chapter, currentRef.id)?.[0];
  if (!confirm(`Удалить слово "${word}"?`)) {
    return;
  }
  const data = getWordsToLearn();
  const list = data[book]?.[currentRef.chapter];
  if (list) {
    const index = list.findIndex((it) => it[3] === currentRef.id);
    if (index !== -1) {
      list.splice(index, 1);
    }
  }
  setWordsToLearn(data);
  pickNextWordToLearn();
  renderWordsToLearnStudy();
  refreshWordsToLearnLink();
}

function deleteChapterWordsFromChooser(book, chapter) {
  if (!confirm(`Удалить все слова главы "${chapter}"?`)) {
    return;
  }
  const data = getWordsToLearn();
  if (data[book]) {
    delete data[book][chapter];
  }
  setWordsToLearn(data);
  openWordsToLearnChooser();
  refreshWordsToLearnLink();
}

function deleteBookWordsFromChooser(book) {
  if (!confirm(`Удалить все слова ${book}?`)) {
    return;
  }
  const data = getWordsToLearn();
  delete data[book];
  setWordsToLearn(data);
  openWordsToLearnChooser();
  refreshWordsToLearnLink();
}

function getWordsToLearnAutospeak() {
  return localStorage.getItem("wordsToLearnAutospeak") === "true";
}

function toggleWordsToLearnAutospeak(checked) {
  localStorage.setItem("wordsToLearnAutospeak", checked);
}

function stripAnnotations(text) {
  return text
    .split(" ")
    .filter(
      (it) =>
        !["m", "f"].includes(it) &&
        !/^\[.*$/.test(it) &&
        !/^.*\]$/.test(it),
    )
    .map((it) => it.replace(/\*$/, ""))
    .join(" ");
}

function highlightGender(text) {
  text = text.replace(
    /(.*?)(?<![\p{L}\d_'’])([mf])(?![\p{L}\d_'’])/gu,
    (_match, before, marker) =>
      `<span style="color: ${marker === "m" ? "#87CEFA" : "#F08080"};">${before}${marker}</span>`,
  );
  text = text.replace(
    /\b(une|la)\s+(\S+)/gi,
    '<span style="color: #F08080;">$1 $2</span>',
  );
  text = text.replace(
    /\b(un|le)\s+(\S+)/gi,
    '<span style="color: #87CEFA;">$1 $2</span>',
  );
  return text;
}

function renderWordsToLearnStudy() {
  const contentEl = byPrefixId("wordsToLearnContent");
  const dialogId = prefix("wordsToLearnDialog");

  if (!learnedSession.currentRef) {
    openWordsToLearnChooser();
    return;
  }

  const { book, chapterFilter, currentRef, revealed } = learnedSession;
  const entry = getLearnedEntry(book, currentRef.chapter, currentRef.id);
  const [word, translation, repeatOften] = entry;
  const remaining = collectWordsToLearnSessionRefs().length;
  const conjugation = findInfinitiveTenses(stripAnnotations(word).trim());
  const transcriptionMatch = word.match(/\s*\[[^\]]*\]\s*$/);
  const transcription = transcriptionMatch ? transcriptionMatch[0] : "";
  const wordCore = highlightGender(
    transcriptionMatch
      ? word.slice(0, word.length - transcriptionMatch[0].length)
      : word,
  );
  const wordHTML = wordCore + transcription;
  const conjugationButtonHTML = conjugation
    ? `<button style="margin: 0;" onClick="showWordToLearnConjugation()">Спряжение</button>`
    : "";

  contentEl.innerHTML = `
    <h4 style="margin: 0; padding: 0;">${chapterFilter ?? book}</h4>
    <div style="display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
      <div>
        <div>Осталось: ${remaining}</div>
        <div>${translation}</div>
        <div style="display: flex; align-items: center; gap: 0.5rem; visibility: ${revealed ? "visible" : "hidden"};"><span>${revealed ? wordHTML : ""}</span>${speakBtnHTML(stripAnnotations(word))}${conjugationButtonHTML}</div>
      </div>
      <button style="margin: 0;" onClick="nextWordToLearn()">Дальше</button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0;">
      <div style="display: flex; align-items: center; gap: 0.2rem;">
        <label for="${prefix("wordsToLearnRepeat")}" style="padding: 0;">Повторять чаще</label>
        <input type="checkbox" id="${prefix("wordsToLearnRepeat")}" style="padding: 0;" ${repeatOften ? "checked" : ""} onChange="toggleWordToLearnRepeat(this.checked)">
      </div>
      <div style="display: flex; align-items: center; gap: 0.2rem;">
        <label for="${prefix("wordsToLearnAutospeak")}" style="padding: 0;">Озвучивать автоматически</label>
        <input type="checkbox" id="${prefix("wordsToLearnAutospeak")}" style="padding: 0;" ${getWordsToLearnAutospeak() ? "checked" : ""} onChange="toggleWordsToLearnAutospeak(this.checked)">
      </div>
    </div>
    <div style="display: flex; flex-direction: row; align-items: flex-end; justify-content: space-between; gap: 0.5rem; padding-top: 0.5rem;">
      <a class="${prefix("link")}" href="javascript:void(0)" style="color: #F08080;" onclick="showWordToLearnDeleteOptions()">Удалить</a>
      <div style="display: flex; flex-direction: row; gap: 0.5rem;">
        <button style="margin: 0;" onClick="openWordsToLearnChooser()">Назад</button>
        <button style="margin: 0;" onClick="document.getElementById('${dialogId}').close();">Закрыть</button>
      </div>
    </div>`;
}

function wordToLearnDeleteOptionsHTML() {
  const { book, currentRef } = learnedSession;
  const { chapter } = currentRef;
  const word = getLearnedEntry(book, chapter, currentRef.id)[0];
  return `
    <div><a class="${prefix("link")}" href="javascript:void(0)" style="color: #F08080;" onclick="deleteWordToLearn()">Удалить ${word}?</a></div>
    <div><a class="${prefix("link")}" href="javascript:void(0)" style="color: #F08080;" onclick="deleteChapterWordsFromChooser('${escJs(book)}', '${escJs(chapter)}')">Удалить все слова в ${chapter}?</a></div>
    <div><a class="${prefix("link")}" href="javascript:void(0)" style="color: #F08080;" onclick="deleteBookWordsFromChooser('${escJs(book)}')">Удалить все слова в ${book}?</a></div>
    <div style="display: flex; flex-direction: row; justify-content: flex-end; padding-top: 0.5rem;">
      <button style="margin: 0;" onClick="renderWordsToLearnStudy()">Назад</button>
    </div>`;
}

function showWordToLearnDeleteOptions() {
  byPrefixId("wordsToLearnContent").innerHTML = wordToLearnDeleteOptionsHTML();
}

function wordToLearnConjugationHTML() {
  const { book, currentRef } = learnedSession;
  const [word] = getLearnedEntry(book, currentRef.chapter, currentRef.id);
  const text = stripAnnotations(word).trim();
  const conjugation = findInfinitiveTenses(text);
  return `
    <div>${getConjugationHTML(text, conjugation, { showToggle: false })}</div>
    <div style="display: flex; flex-direction: row; justify-content: flex-end; padding-top: 0.5rem;">
      <button style="margin: 0;" onClick="renderWordsToLearnStudy()">Назад</button>
    </div>`;
}

function showWordToLearnConjugation() {
  byPrefixId("wordsToLearnContent").innerHTML = wordToLearnConjugationHTML();
}

document.addEventListener("DOMContentLoaded", initWordsToLearnUI);

function isIrregularVerb(text) {
  if (verbTenses(text).type === "irregular") {
    return true;
  }
  return !!getConjugation(text)?.some((it) => it.type === "irregular");
}

function learnDialogHTML(id, item) {
  const { text, ts, tr, gen } = item;
  const irregular = isIrregularVerb(text);
  const wordValue = `${text}${irregular ? "*" : ""}${gen ? ` ${gen?.code}` : ""}${ts ? ` [${ts}]` : ""}`;
  const inputStyle =
    "background-color: black; color: #fff8dc; border: 1px solid #fff8dc; margin: 0; padding: 0.5rem; border-radius: 0.31rem;";

  const translationValue = tr.length === 1 ? tr[0].text : "";
  const links =
    tr.length === 1
      ? ""
      : tr
          .map((it) => {
            return `<a href="javascript:void(0)" style="margin: 0; padding: 0;"
        onClick="const elm = document.getElementById('${id}_part2'); elm.value = elm.value ? elm.value + ', ' + this.textContent : this.textContent;">${it.text}</a>`;
          })
          .join("");

  return `<dialog id="${id}" style="border-radius: 0.31rem; background-color: black; color: #fff8dc; border: 1px solid #fff8dc; padding: 0.63rem; max-width: ${document.documentElement.clientWidth}px;">
      <div id="${id}_warning" style="display: none; flex-direction: column; gap: 0.5rem; width: ${Math.min(document.documentElement.clientWidth / 16, 20)}rem;">
        <div id="${id}_warning_text"></div>
        <div style="display: flex; flex-direction: row; justify-content: flex-end; gap: 0.5rem;">
          <button style="margin: 0;" onClick="document.getElementById('${id}_warning').style.display = 'none'; document.getElementById('${id}_form').style.display = 'flex';">Да</button>
          <button style="margin: 0;" onClick="document.getElementById('${id}').close();">Нет</button>
        </div>
      </div>
      <div id="${id}_form" style="display: flex; flex-direction: column; gap: 0.5rem; width: ${Math.min(document.documentElement.clientWidth / 16, 20)}rem;">
        <input type="text" id="${id}_part1" placeholder="Слова" value="${wordValue}" style="${inputStyle}">
        <input type="text" id="${id}_part2" placeholder="Перевод" value="${translationValue}" style="${inputStyle}">
        <div style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 0.5rem;">${links}</div>
        <div style="display: flex; flex-direction: row; justify-content: space-between; gap: 0.5rem; margin-top: 0.5rem;">
          <button style="margin: 0;"
            onClick="const word = document.getElementById('${id}_part1').value; const translation = document.getElementById('${id}_part2').value;
            if (!translation.trim()) { alert('Введите перевод.'); return; }
            saveWordToLearn(word, translation);
            document.getElementById('${id}').close();">Сохранить</button>
          <button style="margin: 0;" onClick="document.getElementById('${id}').close();">Закрыть</button>
        </div>
      </div>
    </dialog>`;
}

function getTranslationHTML(data) {
  return data
    .map((item, index) => {
      const { text, ts, tr, gen } = item;
      const result = [
        `<b>${text}${isIrregularVerb(text) ? "*" : ""}</b>`,
        gen?.code,
        ts ? `[${ts}]` : "",
      ]
        .filter((it) => it)
        .map((it) => `<div>${it}</div>`);
      result.push(speakBtnHTML(text));
      const learnId = prefix(`learn${index}`);
      result.push(
        `<button style="margin: 0; padding: 0 0.5rem; height: 2rem; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;"
          onClick="const existing = findWordToLearnLocation('${escJs(text)}');
          if (existing) {
            document.getElementById('${learnId}_warning_text').textContent = 'Слово уже сохранено в книге ' + existing.book + ', глава ' + existing.chapter + '. Сохранить ещё раз?';
            document.getElementById('${learnId}_warning').style.display = 'flex';
            document.getElementById('${learnId}_form').style.display = 'none';
          } else {
            document.getElementById('${learnId}_warning').style.display = 'none';
            document.getElementById('${learnId}_form').style.display = 'flex';
          }
          document.getElementById('${learnId}').showModal();
          document.getElementById('${learnId}_part2').focus();">Учить</button>`,
      );
      return `<div style="display: flex; flex-wrap: wrap; flex-direction: row; align-items: baseline; gap: 0.5rem; width: max-content; max-width: ${document.documentElement.clientWidth}px;">
      ${result.join("")}
    </div><div style="max-width:${Math.min(document.documentElement.clientWidth / 16, 31.25)}rem">${tr.map((it) => it.text).join(", ")}</div>
    ${learnDialogHTML(learnId, item)}
    `;
    })
    .join("");
}

function speakBtnHTML(text) {
  if (!window.speechSynthesis) {
    return "";
  }
  return `
    <button style="font-size:0; margin: 0; padding: 0 0.5rem; height: 2rem; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;" onClick="speak('${text.replace("'", "\\'")}')">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20px" height="20px">
        <path fill="currentColor" d="M48 352l48 0 134.1 119.2c6.4 5.7 14.6 8.8 23.1 8.8 19.2 0 34.8-15.6 34.8-34.8l0-378.4c0-19.2-15.6-34.8-34.8-34.8-8.5 0-16.7 3.1-23.1 8.8L96 160 48 160c-26.5 0-48 21.5-48 48l0 96c0 26.5 21.5 48 48 48zM441.1 107c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C443.3 170.7 464 210.9 464 256s-20.7 85.3-53.2 111.8c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5c43.2-35.2 70.9-88.9 70.9-149s-27.7-113.8-70.9-149zm-60.5 74.5c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C361.1 227.6 368 241 368 256s-6.9 28.4-17.7 37.3c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5C402.1 312.9 416 286.1 416 256s-13.9-56.9-35.5-74.5z"/>
      </svg>
    </button>`;
}

let started = false;
let voice;

document.addEventListener("pointerdown", (event) => {
  if (!started) speak(" ");
});

function speak(text) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.8;
  utterance.volume = started ? 1 : 0;
  if (voice) {
    utterance.voice = voice;
  }
  started = true;
  window.speechSynthesis.speak(utterance);
}

function loadVoices() {
  const voices = window.speechSynthesis.getVoices();
  voice = voices.find(
    (voice) => voice.lang === "fr-FR" /* && voice.localService*/,
  );
}

speechSynthesis.addEventListener("voiceschanged", loadVoices);

function startsWithVowel(text) {
  return "haeéêioôuy".includes(text.at(0));
}

function participleAgreementMatches(form, text) {
  return ["", "e", "s", "es"].some((agreement) => form + agreement === text);
}

function getConjugationHTML(text, data, { showToggle = true } = {}) {
  return data
    ?.map(({ infinitive, type, tenses }) => {
      const tensesHTML = Object.entries(tenses).map(([tenseName, __forms]) => {
        const forms = Array.isArray(__forms) ? __forms : [__forms];
        const isParticiple = ["participe présent", "participe passé"].includes(
          tenseName,
        );
        const matches = (form) =>
          isParticiple ? participleAgreementMatches(form, text) : form === text;

        let formsHTML = forms.map((form) => {
          return matches(form)
            ? `<span style='color:red; font-weight:bold;'>${form}</span>`
            : form;
        });
        let formsToSpeak = [...forms];
        if (forms.length === 6) {
          const pronouns = ["je", "tu", "il", "nous", "vous", "ils"];
          for (let i = 0; i < 6; i++) {
            const pronoun =
              i === 0 && startsWithVowel(forms[i]) ? "j'" : pronouns[i] + " ";
            formsHTML[i] = `${pronoun}${formsHTML[i]}`;
            formsToSpeak[i] = `${pronoun}${forms[i]}`;
          }
        }
        formsHTML = formsHTML.map((it) => `<div>${it}</div>`);
        if (formsHTML.length === 6) {
          formsHTML = `<div style="display:flex; gap:1.25rem">
          <div>${formsHTML.slice(0, 3).join("")}</div>
          <div>${formsHTML.slice(3, 6).join("")}</div>
          </div>`;
        } else {
          formsHTML = formsHTML.join("");
        }
        const found = forms.find(matches);
        return `<div class="${showToggle && !found ? prefix(infinitive) : ""}">
          <div style="display:flex; flex-direction:row; align-items:center; gap:0.63rem; font-weight:bold">
            <span>${tenseName}</span>
            ${speakBtnHTML(formsToSpeak.join(", "))}
          </div>
          <div>${formsHTML}</div>
        </div>`;
      });
      const onClick = `this.innerHTML = this.innerHTML === 'Больше'? 'Меньше' : 'Больше';
      Array.from(document.getElementsByClassName('${prefix(infinitive)}'))
      .forEach(it => { it.style.display = it.style.display === 'none'? 'block' : 'none'});`;
      return `<div>
      ${infinitive + (type === "irregular" ? "*" : "")}
      ${showToggle ? `<button style="border-radius:0.31rem; padding:0.31rem; margin:0;" class="${prefix("conjugation")}" onClick="${onClick}">Меньше</button>` : ""}
      </div>
      ${tensesHTML.join("")}`;
    })
    .join("<hr/>")
    .replace(/\s\s*/, " ");
}

async function getHelperData(text) {
  let translation = await getTranslation(text);
  let conjugation = getConjugation(text);
  if (!translation && conjugation) {
    const infinitive = conjugation[0].infinitive;
    const reflexiveVerb = `${startsWithVowel(infinitive) ? "s'" : "se "}${infinitive}`;
    translation = await getTranslation(reflexiveVerb);
  }
  if (translation && !conjugation) {
    const verbs = translation.filter((it) => it.pos?.code === "vrb");
    const verbTense = verbs
      .map((it) => verbTenses(it.text))
      .find((it) => Object.keys(it.tenses).length > 0);
    if (verbTense) {
      conjugation = [verbTense];
    }
  }
  return { translation, conjugation };
}

function translationSlotHTML(text, translation) {
  return getTranslationHTML(translation ?? [{ text, tr: [] }]);
}

function helperParts(text, translation, conjugation) {
  const parts = [
    `<div id="${prefix("translation")}">${translationSlotHTML(text, translation)}</div>`,
  ];
  if (conjugation) {
    parts.push(`<div>${getConjugationHTML(text, conjugation)}</div>`);
  }
  return parts;
}

function keepOnScreen(pnl) {
  const { clientWidth: screenWidth } = document.documentElement;
  const overflow = pnl.getBoundingClientRect().right + 10 - screenWidth;
  if (overflow > 0) {
    pnl.style.left = `${parseFloat(pnl.style.left) - overflow}px`;
  }
}

function renderHelper(helper, selection, parts) {
  const { clientWidth: screenWidth } = document.documentElement;
  const selRange = selection.getRangeAt(0);
  const selRect = selRange.getBoundingClientRect();
  const style = (left, top, position) => {
    return `background-color:black; color:#fff8dc; border:1px solid #fff8dc; padding:0.63rem; margin:0;
    border-radius:0.31rem; position:${position};
    left:${left}px; top:${top}px; max-width:${screenWidth}px;`;
  };
  const helperHTML = (style) => {
    return `<div id="${prefix("helper")}" style="${style}">${parts.join("<hr/>")}</div>`;
  };

  let left = selRect.left;
  let top = selRect.top + selRect.height;
  helper.innerHTML = helperHTML(style(left, top, "fixed"));
  const pnl = byPrefixId("helper");
  while (pnl.getBoundingClientRect().right + 10 > screenWidth && left > 0) {
    left -= 1;
    pnl.style = style(left, top, "fixed");
  }
  helper.innerHTML = helperHTML(
    style(left + window.scrollX, top + window.scrollY, "absolute"),
  );
  Array.from(document.getElementsByClassName(prefix("conjugation"))).forEach(
    (it) => it.click(),
  );
}

async function showHelper(selection) {
  const text = selection.toString().trim().toLowerCase();
  const helper = document.getElementById("fr-helper"); //TODO

  if (text && helper.getAttribute("text") === text) {
    return;
  }

  if (!text) {
    helper.removeAttribute("text");
    helper.innerHTML = ""; // TODO
    return;
  }

  helper.setAttribute("text", text);

  const conjugation = getConjugation(text);
  const dataPromise = getHelperData(text);

  // Give the translation half a second to arrive before showing anything -
  // if it's fast enough, we can render the final result in one go instead of
  // popping up a loading placeholder that immediately jerks/resizes once the
  // translation lands.
  const timedOut = Symbol("timedOut");
  const raceResult = await Promise.race([
    dataPromise,
    new Promise((resolve) => setTimeout(resolve, 500)).then(() => timedOut),
  ]);
  if (helper.getAttribute("text") !== text) {
    return; // selection moved on while we were waiting
  }

  if (raceResult !== timedOut) {
    renderHelper(
      helper,
      selection,
      helperParts(text, raceResult.translation, raceResult.conjugation),
    );
    return;
  }

  // Translation is taking a while - show the conjugation now (it's computed
  // locally, no network needed) so the helper still shows something useful
  // while offline or slow. The translation slot starts out as a loading
  // placeholder and gets updated in place once it loads.
  const parts = [`<div id="${prefix("translation")}">Перевожу...</div>`];
  if (conjugation) {
    parts.push(`<div>${getConjugationHTML(text, conjugation)}</div>`);
  }
  renderHelper(helper, selection, parts);

  const data = await dataPromise;
  if (helper.getAttribute("text") !== text) {
    return; // selection moved on while the translation was loading
  }

  if (!conjugation && data.conjugation) {
    // Conjugation was only discoverable via the translation lookup, so the
    // initial render had no slot for it - rebuild the whole panel.
    renderHelper(
      helper,
      selection,
      helperParts(text, data.translation, data.conjugation),
    );
    return;
  }

  const elm = byPrefixId("translation");
  if (elm) {
    elm.innerHTML = translationSlotHTML(text, data.translation);
    keepOnScreen(byPrefixId("helper"));
  }
}

function isInsideHelper(node) {
  const helper = document.getElementById("fr-helper");
  return !!(helper && node && helper.contains(node));
}

function isInsideDialog(node) {
  const elm = node instanceof Element ? node : node?.parentElement;
  return !!elm?.closest("dialog");
}

const listener = async (event) => {
  if (isInsideHelper(event.target) || isInsideDialog(event.target)) {
    return;
  }
  await showHelper(document.getSelection());
};
document.addEventListener("contextmenu", listener);
document.addEventListener("pointerup", listener);
document.addEventListener("selectionchange", async () => {
  const selection = document.getSelection();
  if (
    !selection.toString() &&
    !isInsideHelper(selection.anchorNode) &&
    !isInsideDialog(selection.anchorNode)
  ) {
    await showHelper(document.getSelection());
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (document.querySelector("dialog[open]")) {
      return;
    }
    const helper = document.getElementById("fr-helper");
    helper.removeAttribute("text");
    helper.innerHTML = "";
    document.getSelection().removeAllRanges();
  }
});

/*

s’efforcer ?

Основные глаголы только в возвратной форме
Se souvenir — помнить, вспоминать
S'enfuir — убегать, сбегать
Se méfier — остерегаться, не доверять
Se repentir — раскаиваться
S'évanouir — падать в обморок, исчезать
S'écrier — воскликнуть
S'absenter — отсутствовать
S'efforcer — стараться, силиться
Se douter — догадываться, подозревать
Se suicider — покончить с собой
S'emparer — завладеть, захватить
Se moquer — насмехаться, издеваться
S'agenouiller — вставать на колени
S'envoler — улетать
Se syndiquer — вступать в профсоюз
se morfondre
*/

// s’entretenaient не находит
// prosternaient не находит
