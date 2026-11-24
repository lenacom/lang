const infinitives = [];
const formToInfinitives = {};
const endingToVerbType = {};
const endingToTenses = {};

// language of the translations (the second half of the Yandex dictionary pair
// "fr-ru" / "fr-en"), chosen with the ru/en switch in the top right corner and
// remembered in localStorage; Russian until the user switches
const TRANSLATION_LANG_KEY = "translationLang";
const TRANSLATION_LANGS = ["ru", "en"];

// used only when localStorage is unavailable (blocked, private window): the
// choice then lasts until the page is closed instead of being lost at once
let sessionTranslationLang = null;

function getTranslationLang() {
  try {
    const saved = localStorage.getItem(TRANSLATION_LANG_KEY);
    if (TRANSLATION_LANGS.includes(saved)) {
      return saved;
    }
  } catch (e) {
    // fall through to the session value
  }
  return sessionTranslationLang ?? "ru";
}

function dictionaryPair() {
  return `fr-${getTranslationLang()}`;
}

function prefix(value) {
  return `frh__${value}`;
}

function byPrefixId(value) {
  return document.getElementById(prefix(value));
}

// Sizes of the helper panel and the dialogs. Careful: mini-default.css sets
// html{font-size:24px}, so 1rem is NOT 16px, and the stylesheet has no global
// box-sizing, so padding and border come ON TOP of width/max-width. Anything
// derived from the screen width therefore has to be written in CSS units
// that account for both (this used to be "clientWidth / 16" rem, which was
// wider than a phone screen).
//
// The content of a panel/dialog with `padding: 0.63rem` and a 1px border:
// at most `maxRem`, and never wider than the screen minus the padding, the
// border and a small gap (0.5rem) - so the OUTER width always fits the screen.
const PANEL_INNER_MAX = "calc(100vw - 1.76rem - 2px)";
function panelContentWidth(maxRem) {
  return `min(${maxRem}rem, ${PANEL_INNER_MAX})`;
}
// max-width: none cancels the UA rule (100% - 6px - 2em) that would clamp the
// dialog narrower than its own content
const DIALOG_BOX_STYLE =
  "border-radius: 0.31rem; background-color: black; color: #fff8dc; border: 1px solid #fff8dc; padding: 0.63rem; max-width: none;";

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

function getYandexTranslationURL(text, pair) {
  const url = new URL(
    "https://dictionary.yandex.net/dicservice.json/lookupMultiple",
  );
  url.searchParams.set("ui", "ru");
  url.searchParams.set("lang", pair);
  url.searchParams.set("dict", pair + ".regular");
  url.searchParams.set("type", "regular");
  url.searchParams.set("flags", "15783");
  url.searchParams.set("srv", "tr-text");
  url.searchParams.set("text", text);
  return url;
}

async function getTranslation(text) {
  // the pair is read once: switching the language while a request is in
  // flight must not make the answer be looked up under the other pair's key
  const pair = dictionaryPair();
  try {
    const response = await fetch(getYandexTranslationURL(text, pair));
    const json = await response.json();

    const regular = json[pair]["regular"];
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

// the hidden search key of a saved word: the word without the gender,
// transcription, irregular mark etc., so a duplicate check is a plain string
// comparison. Stored as the 5th item of every entry
// [word, translation, repeat, id, key]
function wordToLearnKey(word) {
  return stripAnnotations(word).trim().toLowerCase();
}

function getWordsToLearn() {
  migrateWordsToLearnStorage();
  const data = JSON.parse(localStorage.getItem(WORD_TO_LEARN_KEY) ?? "{}");
  // entries saved before the key existed get it once, here
  let changed = false;
  for (const chapters of Object.values(data)) {
    for (const entries of Object.values(chapters)) {
      for (const entry of entries) {
        if (entry[4] === undefined) {
          entry[4] = wordToLearnKey(entry[0]);
          changed = true;
        }
      }
    }
  }
  if (changed) setWordsToLearn(data);
  return data;
}

function setWordsToLearn(data) {
  localStorage.setItem(WORD_TO_LEARN_KEY, JSON.stringify(data));
}

function generateWordToLearnId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function escHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// where the word (or phrase) stands in the sentence it was saved from:
// { index, length } or null. `forms` are tried in order (the word as it is now
// written, then the form as it stood in the text - it can differ from the
// word: "parlait" for "parler"); a sentence that contains none of them - the
// word was corrected after saving - gives null
function findFormInSentence(sentence, forms) {
  if (!sentence) return null;
  for (const form of forms) {
    if (!form) continue;
    const pattern = form
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/['’]/g, "['’]")
      .replace(/\s+/g, "\\s+");
    const re = new RegExp(`(?<![\\p{L}\\d_])${pattern}(?![\\p{L}\\d_])`, "iu");
    const match = re.exec(sentence);
    if (match) {
      return { index: match.index, length: match[0].length };
    }
  }
  return null;
}

// the sentence the word was saved from, with the word (or phrase) underlined;
// "" when the word is not in it (then the sentence is not shown)
function sentenceWithUnderline(sentence, forms) {
  const found = findFormInSentence(sentence, forms);
  if (!found) return "";
  const end = found.index + found.length;
  return `${escHtml(sentence.slice(0, found.index))}<u>${escHtml(sentence.slice(found.index, end))}</u>${escHtml(sentence.slice(end))}`;
}

// the block of text the selection starts in and where the selection lies in
// the text of that block: { block, start, end } (offsets in block.textContent)
function selectionInBlock(selection) {
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const startNode =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement;
  const block = startNode?.closest("p, li, blockquote, div");
  if (!block) return null;
  const before = document.createRange();
  before.setStart(block, 0);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  const end = start + range.toString().length;
  return { block, start, end };
}

// the sentence around the selected text, from the block it sits in
function sentenceAroundSelection(selection) {
  const inBlock = selectionInBlock(selection);
  if (!inBlock) return "";
  const { block, start, end } = inBlock;
  const full = block.textContent;
  // sentence ends: . ! ? … (with closing quotes) followed by a space
  const enders = /[.!?…]+["»”’)]*\s/g;
  let sentenceStart = 0;
  let sentenceEnd = full.length;
  let m;
  while ((m = enders.exec(full)) !== null) {
    const after = m.index + m[0].length;
    if (after <= start) sentenceStart = after;
    else if (m.index + m[0].trimEnd().length >= end) {
      sentenceEnd = m.index + m[0].trimEnd().length;
      break;
    }
  }
  const raw = full.slice(sentenceStart, sentenceEnd);
  const normalized = raw.replace(/\s+/g, " ");
  const leading = normalized.length - normalized.trimStart().length;
  const wordStart = Math.max(
    0,
    raw.slice(0, start - sentenceStart).replace(/\s+/g, " ").length - leading,
  );
  return cropAroundWord(normalized.trim(), wordStart, end - start);
}

const MAX_SENTENCE_LENGTH = 400;

// a sentence longer than the limit is cut to a window with the word as close
// to the middle as possible, the cuts snapped to word boundaries and marked
// with "…"
function cropAroundWord(sentence, wordStart, wordLength) {
  if (sentence.length <= MAX_SENTENCE_LENGTH) return sentence;
  if (wordLength > MAX_SENTENCE_LENGTH / 2) return "";
  const middle = wordStart + wordLength / 2;
  let from = Math.max(0, Math.round(middle - MAX_SENTENCE_LENGTH / 2));
  let to = Math.min(sentence.length, from + MAX_SENTENCE_LENGTH);
  from = Math.max(0, to - MAX_SENTENCE_LENGTH);
  if (from > 0) {
    const space = sentence.indexOf(" ", from);
    if (space !== -1 && space < wordStart) from = space + 1;
  }
  if (to < sentence.length) {
    const space = sentence.lastIndexOf(" ", to);
    if (space > wordStart + wordLength) to = space;
  }
  return `${from > 0 ? "… " : ""}${sentence.slice(from, to).trim()}${to < sentence.length ? " …" : ""}`;
}

let currentHelperSentence = "";
let currentHelperForm = "";

// shows (or hides) the sentence, the word underlined, in the "Учить" dialog;
// called when the dialog
// opens and whenever the word field is corrected
function updateLearnSentence(id) {
  const el = document.getElementById(`${id}_sentence`);
  if (!el) return;
  const word = document.getElementById(`${id}_part1`)?.value ?? "";
  const html = sentenceWithUnderline(el.dataset.sentence, [
    wordToLearnKey(word),
    el.dataset.form,
  ]);
  el.innerHTML = html;
  el.style.display = html ? "block" : "none";
}

function saveWordToLearnFromDialog(id) {
  const word = document.getElementById(`${id}_part1`).value;
  const translation = document.getElementById(`${id}_part2`).value;
  const el = document.getElementById(`${id}_sentence`);
  const shown = el && el.style.display !== "none" && el.innerHTML;
  saveWordToLearn(word, translation, shown ? el.dataset.sentence : "", shown ? el.dataset.form : "");
  document.getElementById(id).close();
}

function saveWordToLearn(word, translation, sentence = "", form = "") {
  const book = document.querySelector(".title")?.textContent ?? "";
  const chapter = document.querySelector(".chapter")?.textContent ?? "";
  const data = getWordsToLearn();
  if (!data[book]) {
    data[book] = {};
  }
  if (!data[book][chapter]) {
    data[book][chapter] = [];
  }
  // the same word saved earlier (anywhere) is replaced: the previous place is
  // removed, the word goes to the current chapter
  const key = wordToLearnKey(word);
  for (const [otherBook, chapters] of Object.entries(data)) {
    for (const [otherChapter, entries] of Object.entries(chapters)) {
      chapters[otherChapter] = entries.filter((entry) => entry[4] !== key);
      if (chapters[otherChapter].length === 0 && otherChapter !== chapter) {
        delete chapters[otherChapter];
      }
    }
    if (Object.keys(chapters).length === 0 && otherBook !== book) {
      delete data[otherBook];
    }
  }
  // [word, translation, repeat, id, key, sentence, form as in the text]
  data[book][chapter].push([word, translation, false, generateWordToLearnId(), key, sentence, form]);
  setWordsToLearn(data);
  refreshWordsToLearnLink();
  refreshSavedWordHighlights();
}

function getLearnedEntry(book, chapter, id) {
  const data = getWordsToLearn();
  return (data[book]?.[chapter] ?? []).find((entry) => entry[3] === id);
}

function findWordToLearnLocation(word) {
  const key = wordToLearnKey(word);
  const data = getWordsToLearn();
  for (const [book, chapters] of Object.entries(data)) {
    for (const [chapter, entries] of Object.entries(chapters)) {
      if (entries.some((entry) => entry[4] === key)) {
        return { book, chapter };
      }
    }
  }
  return null;
}

function escJs(text) {
  return text.replace(/'/g, "\\'");
}

// ---- saved words underlined in the text of the chapter ----
//
// A saved entry remembers the sentence it came from and the form of the word
// as it stood in the text. On a chapter page that sentence is looked up in the
// text, the form inside it is underlined (CSS Custom Highlight API: nothing in
// the page is changed, so the selection, the gender colours and the helper
// panel are not disturbed) and the selection of an underlined word turns the
// "Учить" buttons of the helper into one "Удалить".

// the sentence as it stood in the text, without the "…" that marks a cut
function sentenceCore(sentence) {
  return sentence.replace(/^…\s+/, "").replace(/\s+…$/, "");
}

// runs of white space become one space (as in sentenceAroundSelection);
// map[i] is where the i-th character of `text` stands in `raw`
function normalizeSpaces(raw) {
  let text = "";
  const map = [];
  for (let i = 0; i < raw.length; i++) {
    if (/\s/.test(raw[i])) {
      if (text.endsWith(" ")) continue;
      text += " ";
    } else {
      text += raw[i];
    }
    map.push(i);
  }
  map.push(raw.length);
  return { text, map };
}

// { start, end } - where, in the text of a block, the form saved from
// `sentence` stands (offsets in the raw text); null if the sentence is not
// in this block
function locateSavedForm(blockText, sentence, forms) {
  const core = sentenceCore(sentence ?? "");
  if (!core) return null;
  const { text, map } = normalizeSpaces(blockText);
  const at = text.indexOf(core);
  if (at === -1) return null;
  const found = findFormInSentence(core, forms);
  if (!found) return null;
  const first = at + found.index;
  const last = first + found.length - 1;
  return { start: map[first], end: map[last] + 1 };
}

// every place in a block where the word stands as a whole word - for the
// entries saved without a sentence, so there is no way to tell which one it was
function locateAllForms(blockText, forms) {
  const places = [];
  for (const form of forms) {
    if (!form) continue;
    const pattern = form
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/['’]/g, "['’]")
      .replace(/\s+/g, "\\s+");
    const re = new RegExp(`(?<![\\p{L}\\d_])${pattern}(?![\\p{L}\\d_])`, "giu");
    for (const match of blockText.matchAll(re)) {
      places.push({ start: match.index, end: match.index + match[0].length });
    }
    if (places.length) break;
  }
  return places;
}

// the selection with the punctuation, quotes and spaces cut off its edges
// (as trimToLetters does for its text)
function trimOffsetsToLetters(text, start, end) {
  const isLetter = (ch) => /[\p{L}\p{M}]/u.test(ch);
  while (start < end && !isLetter(text[start])) start++;
  while (end > start && !isLetter(text[end - 1])) end--;
  return { start, end };
}

// { block, start, end } of the selection with the edges trimmed to letters
function trimmedSelectionPlace(at) {
  if (!at) return null;
  const { start, end } = trimOffsetsToLetters(at.block.textContent, at.start, at.end);
  return { block: at.block, start, end };
}

function sameSelectionPlace(a, b) {
  if (!a || !b) return a === b;
  return a.block === b.block && a.start === b.start && a.end === b.end;
}

// the selection is "the saved word" when it lies inside the underlined text
// or covers all of it
function selectionMatchesSaved(start, end, saved) {
  return (
    (start >= saved.start && end <= saved.end) ||
    (start <= saved.start && end >= saved.end)
  );
}

// the text nodes of a block have these lengths; where do the offsets
// start..end of the block text fall: { startIndex, startOffset, endIndex,
// endOffset } (a node index and an offset in that node), or null
function offsetsToNodePositions(lengths, start, end) {
  let pos = 0;
  let result = null;
  for (let i = 0; i < lengths.length; i++) {
    if (!result && start < pos + lengths[i]) {
      result = { startIndex: i, startOffset: start - pos };
    }
    if (result && end <= pos + lengths[i]) {
      return { ...result, endIndex: i, endOffset: end - pos };
    }
    pos += lengths[i];
  }
  return null;
}

// the blocks of the chapter text: the lines (the innermost blocks), not the
// links, the helper panel or the dialogs
function chapterTextBlocks() {
  return Array.from(
    document.querySelectorAll("main p, main li, main blockquote, main div"),
  ).filter(
    (el) =>
      !el.querySelector("p, li, blockquote, div") &&
      !el.closest("#fr-helper, dialog, .chapter-links"),
  );
}

function rangeForBlockOffsets(block, start, end) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node);
  }
  const at = offsetsToNodePositions(
    nodes.map((node) => node.nodeValue.length),
    start,
    end,
  );
  if (!at) return null;
  const range = document.createRange();
  range.setStart(nodes[at.startIndex], at.startOffset);
  range.setEnd(nodes[at.endIndex], at.endOffset);
  return range;
}

// the underlined places of the page: { id, block, start, end, range }
let savedWordPlaces = [];

function canHighlightSavedWords() {
  return typeof Highlight !== "undefined" && !!window.CSS?.highlights;
}

function refreshSavedWordHighlights() {
  savedWordPlaces = [];
  if (canHighlightSavedWords()) CSS.highlights.delete(prefix("saved"));
  const book = document.querySelector(".title")?.textContent;
  const chapter = document.querySelector(".chapter")?.textContent;
  if (!book || !chapter) return;
  const entries = getWordsToLearn()[book]?.[chapter] ?? [];
  if (entries.length === 0) {
    updateHelperSavedState();
    return;
  }
  const blocks = chapterTextBlocks().map((block) => ({ block, text: block.textContent }));
  for (const [, , , id, key, sentence, form] of entries) {
    const forms = [key, form];
    const places = [];
    if (sentence) {
      for (const { block, text } of blocks) {
        const place = locateSavedForm(text, sentence, forms);
        if (place) {
          places.push({ block, ...place });
          break;
        }
      }
    } else {
      for (const { block, text } of blocks) {
        for (const place of locateAllForms(text, forms)) {
          places.push({ block, ...place });
        }
      }
    }
    for (const place of places) {
      const range = rangeForBlockOffsets(place.block, place.start, place.end);
      if (range) savedWordPlaces.push({ id, ...place, range });
    }
  }
  if (canHighlightSavedWords()) {
    CSS.highlights.set(
      prefix("saved"),
      new Highlight(...savedWordPlaces.map((place) => place.range)),
    );
  }
  updateHelperSavedState();
}

// the saved word the selected text is (the selection of an underlined word),
// or null; `at` is { block, start, end } from selectionInBlock; the underlined
// places of one entry are all offered, the one under the selection is found
function savedPlaceForSelection(at) {
  const place = trimmedSelectionPlace(at);
  if (!place || place.start >= place.end) return null;
  return (
    savedWordPlaces.find(
      (saved) =>
        saved.block === place.block &&
        selectionMatchesSaved(place.start, place.end, saved),
    ) ?? null
  );
}

// where the text now shown in the helper lies; kept so the helper can follow
// the word being saved or deleted without the selection (which the dialog and
// the buttons may move)
let currentHelperAt = null;

// one "Удалить" instead of the "Учить" buttons while the word of the helper is
// a saved one; both kinds of buttons are in the panel, the attribute chooses
function updateHelperSavedState() {
  const helper = document.getElementById("fr-helper");
  if (!helper) return;
  if (savedPlaceForSelection(currentHelperAt)) {
    helper.dataset.saved = "1";
  } else {
    delete helper.dataset.saved;
  }
}

function deleteSavedWordUnderHelper() {
  const place = savedPlaceForSelection(currentHelperAt);
  if (!place) return;
  const book = document.querySelector(".title")?.textContent ?? "";
  const chapter = document.querySelector(".chapter")?.textContent ?? "";
  const data = getWordsToLearn();
  const list = data[book]?.[chapter];
  if (list) {
    const index = list.findIndex((entry) => entry[3] === place.id);
    if (index !== -1) list.splice(index, 1);
  }
  setWordsToLearn(data);
  refreshWordsToLearnLink();
  refreshSavedWordHighlights();
}

function initSavedWordsUI() {
  document.head.insertAdjacentHTML(
    "beforeend",
    `<style>
      ::highlight(${prefix("saved")}) { text-decoration: underline; }
      #fr-helper[data-saved="1"] .${prefix("learnBtn")} { display: none !important; }
      #fr-helper:not([data-saved="1"]) .${prefix("deleteBtn")} { display: none !important; }
    </style>`,
  );
  refreshSavedWordHighlights();
}
document.addEventListener("DOMContentLoaded", initSavedWordsUI);

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
      <dialog id="${prefix("wordsToLearnDialog")}" style="${DIALOG_BOX_STYLE}">
        <div id="${prefix("wordsToLearnContent")}" style="display: flex; flex-direction: column; gap: 0.5rem; width: ${panelContentWidth(20)};"></div>
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
  speakWordToLearnIfWordFirst();
}

let nextWordToLearnLocked = false;

function nextWordToLearn() {
  if (nextWordToLearnLocked) return;
  nextWordToLearnLocked = true;
  setTimeout(() => {
    nextWordToLearnLocked = false;
  }, 300);

  if (!learnedSession.revealed) {
    learnedSession.revealed = true;
    // "перевод - слово": the word is revealed now, so it is spoken now; in
    // "слово - перевод" it was already spoken when it was shown
    if (getWordsToLearnAutospeak() && !getWordsToLearnWordFirst()) {
      const { book, currentRef } = learnedSession;
      speak(stripAnnotations(getLearnedEntry(book, currentRef.chapter, currentRef.id)[0]));
    }
  } else {
    learnedSession.shown.add(learnedSession.currentRef.id);
    pickNextWordToLearn();
    renderWordsToLearnStudy();
    speakWordToLearnIfWordFirst();
    return;
  }
  renderWordsToLearnStudy();
}

// "слово - перевод": the word is shown first, so that is when it is spoken
function speakWordToLearnIfWordFirst() {
  if (
    !getWordsToLearnWordFirst() ||
    !getWordsToLearnAutospeak() ||
    !learnedSession?.currentRef
  ) {
    return;
  }
  const { book, currentRef } = learnedSession;
  const entry = getLearnedEntry(book, currentRef.chapter, currentRef.id);
  if (entry) {
    speak(stripAnnotations(entry[0]));
  }
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
  speakWordToLearnIfWordFirst();
  refreshWordsToLearnLink();
  refreshSavedWordHighlights();
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
  refreshSavedWordHighlights();
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
  refreshSavedWordHighlights();
}

function getWordsToLearnAutospeak() {
  return localStorage.getItem("wordsToLearnAutospeak") === "true";
}

function toggleWordsToLearnAutospeak(checked) {
  localStorage.setItem("wordsToLearnAutospeak", checked);
}

// false (default): the translation is shown first, the word is revealed
// ("перевод - слово"); true: the word is shown first, the translation is
// revealed ("слово - перевод"). Remembered between sessions
function getWordsToLearnWordFirst() {
  return localStorage.getItem("wordsToLearnWordFirst") === "true";
}

function setWordsToLearnWordFirst(wordFirst) {
  localStorage.setItem("wordsToLearnWordFirst", wordFirst);
  renderWordsToLearnStudy();
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
      `<span class="${marker === "m" ? "m" : "f"}">${before}${marker}</span>`,
  );
  text = text.replace(/\b(une|la)\s+(\S+)/gi, '<span class="f">$1 $2</span>');
  text = text.replace(/\b(un|le)\s+(\S+)/gi, '<span class="m">$1 $2</span>');
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
  const [word, translation, repeatOften, , key, sentence, form] = entry;
  // the sentence would give away the word in "перевод - слово", so it appears
  // together with the word
  const sentenceHTML = sentenceWithUnderline(sentence, [key, form]);
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

  const wordFirst = getWordsToLearnWordFirst();
  // the word is visible from the start in "слово - перевод", and only once
  // revealed in "перевод - слово"; the translation is the other way round
  const wordVisible = wordFirst || revealed;
  const translationVisible = !wordFirst || revealed;
  const translationHTML = `<div style="visibility: ${translationVisible ? "visible" : "hidden"};">${translation}</div>`;
  const wordRowHTML = `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; min-height: 4.5rem; visibility: ${wordVisible ? "visible" : "hidden"};"><span>${wordVisible ? wordHTML : ""}</span>${speakBtnHTML(stripAnnotations(word))}${conjugationButtonHTML}</div>`;
  const orderName = prefix("wordsToLearnOrder");
  const orderRadioHTML = (id, label, checked, value) => `
      <div style="display: flex; align-items: center; gap: 0.2rem;">
        <input type="radio" id="${prefix(id)}" name="${orderName}" style="padding: 0;" ${checked ? "checked" : ""} onChange="setWordsToLearnWordFirst(${value})">
        <label for="${prefix(id)}" style="padding: 0;">${label}</label>
      </div>`;

  contentEl.innerHTML = `
    <h4 style="margin: 0; padding: 0;">${chapterFilter ?? book}</h4>
    <div style="display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem;">
      ${orderRadioHTML("wordsToLearnOrderTranslationFirst", "перевод - слово", !wordFirst, "false")}
      ${orderRadioHTML("wordsToLearnOrderWordFirst", "слово - перевод", wordFirst, "true")}
    </div>
    <div>
      <div>Осталось: ${remaining}</div>
      ${wordFirst ? wordRowHTML + translationHTML : translationHTML + wordRowHTML}
      ${sentenceHTML && wordVisible ? `<div style="font-style: italic; padding-top: 0.5rem;">${sentenceHTML}</div>` : ""}
    </div>
    <div style="display: flex; flex-direction: row; justify-content: flex-end; padding-top: 0.5rem;">
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
  const { text, ts, tr, gen, pos } = item;
  const irregular = pos?.code === "vrb" && isIrregularVerb(text);
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
        onClick="const elm = document.getElementById('${id}_part2'); elm.value = elm.value ? elm.value + ', ' + this.textContent : this.textContent;
        document.getElementById('${id}_save').disabled = !elm.value.trim();">${it.text}</a>`;
          })
          .join("");

  return `<dialog id="${id}" style="${DIALOG_BOX_STYLE}">
      <div id="${id}_warning" style="display: none; flex-direction: column; gap: 0.5rem; width: ${panelContentWidth(20)};">
        <div id="${id}_warning_text"></div>
        <div style="display: flex; flex-direction: row; justify-content: flex-end; gap: 0.5rem;">
          <button style="margin: 0;" onClick="document.getElementById('${id}_warning').style.display = 'none'; document.getElementById('${id}_form').style.display = 'flex';">Да</button>
          <button style="margin: 0;" onClick="document.getElementById('${id}').close();">Нет</button>
        </div>
      </div>
      <div id="${id}_form" style="display: flex; flex-direction: column; gap: 0.5rem; width: ${panelContentWidth(20)};">
        <input type="text" id="${id}_part1" placeholder="Слова" value="${wordValue}" style="${inputStyle}" oninput="updateLearnSentence('${id}')">
        <div id="${id}_sentence" data-sentence="${escHtml(currentHelperSentence)}" data-form="${escHtml(currentHelperForm)}" style="display: none; font-style: italic;"></div>
        <input type="text" id="${id}_part2" placeholder="Перевод" value="${translationValue}" style="${inputStyle}"
          oninput="document.getElementById('${id}_save').disabled = !this.value.trim();">
        <div style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 0.5rem;">${links}</div>
        <div style="display: flex; flex-direction: row; justify-content: space-between; gap: 0.5rem; margin-top: 0.5rem;">
          <button id="${id}_save" style="margin: 0;" ${translationValue.trim() ? "" : "disabled"}
            onClick="saveWordToLearnFromDialog('${id}')">Сохранить</button>
          <button style="margin: 0;" onClick="document.getElementById('${id}').close();">Закрыть</button>
        </div>
      </div>
    </dialog>`;
}

function getTranslationHTML(data) {
  return data
    .map((item, index) => {
      const { text, ts, tr, gen, pos } = item;
      const genderClass =
        gen?.code === "m" ? "m" : gen?.code === "f" ? "f" : null;
      const irregular = pos?.code === "vrb" && isIrregularVerb(text);
      const result = [
        `<b${genderClass ? ` class="${genderClass}"` : ""}>${text}${irregular ? "*" : ""}</b>`,
        genderClass
          ? `<span class="${genderClass}">${gen.code}</span>`
          : gen?.code,
        ts ? `[${ts}]` : "",
      ]
        .filter((it) => it)
        .map((it) => `<div>${it}</div>`);
      result.push(speakBtnHTML(text));
      const learnId = prefix(`learn${index}`);
      // a word already saved from this place gets one "Удалить" (on the first
      // variant only) instead of the "Учить" buttons - the panel's data-saved
      // attribute decides which are visible
      if (index === 0) {
        result.push(
          `<button class="${prefix("deleteBtn")}" style="margin: 0; padding: 0 0.5rem; height: 2rem; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;"
            onClick="deleteSavedWordUnderHelper()">Удалить</button>`,
        );
      }
      result.push(
        `<button class="${prefix("learnBtn")}" style="margin: 0; padding: 0 0.5rem; height: 2rem; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;"
          onClick="const existing = findWordToLearnLocation('${escJs(text)}');
          if (existing) {
            document.getElementById('${learnId}_warning_text').textContent = 'Слово уже сохранено в книге ' + existing.book + ', глава ' + existing.chapter + '. Добавить его сюда, удалив предыдущее?';
            document.getElementById('${learnId}_warning').style.display = 'flex';
            document.getElementById('${learnId}_form').style.display = 'none';
          } else {
            document.getElementById('${learnId}_warning').style.display = 'none';
            document.getElementById('${learnId}_form').style.display = 'flex';
          }
          updateLearnSentence('${learnId}');
          document.getElementById('${learnId}').showModal();
          document.getElementById('${learnId}_part2').focus();">Учить</button>`,
      );
      return `<div style="display: flex; flex-wrap: wrap; flex-direction: row; align-items: baseline; gap: 0.5rem; width: max-content; max-width: ${PANEL_INNER_MAX};">
      ${result.join("")}
    </div><div style="max-width: ${panelContentWidth(31.25)};">${tr.map((it) => it.text).join(", ")}</div>
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

// The first utterance wakes the speech engine up, and on a phone that can take
// a long time. It is said silently (volume 0) on the first touch of the page
// so the engine is ready by the time a word is wanted. While it is going on
// nothing is cancelled (cancelling it can start the waking up over): a word
// asked for meanwhile waits, and only the latest one is said when the engine is
// ready, so taps made during the wait do not pile up.
let warmingUp = false;
let waitingText = null;
// if the engine never reports the end of the silent utterance
const WARM_UP_LIMIT_MS = 120000;

document.addEventListener("pointerdown", (event) => {
  if (!started) speak("a");
});

function speak(text) {
  if (warmingUp) {
    waitingText = text;
    return;
  }
  const synth = window.speechSynthesis;
  // cancel() right before speak() is only needed to interrupt a phrase that is
  // still playing; on Android it can delay or swallow the next phrase
  if (synth.speaking || synth.pending) {
    synth.cancel();
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.8;
  const warmUp = !started;
  utterance.volume = warmUp ? 0 : 1;
  if (voice) {
    utterance.voice = voice;
  }
  started = true;
  if (warmUp) {
    warmingUp = true;
    const done = () => {
      if (!warmingUp) return;
      warmingUp = false;
      if (waitingText !== null) {
        const next = waitingText;
        waitingText = null;
        speak(next);
      }
    };
    utterance.onend = done;
    utterance.onerror = done;
    setTimeout(done, WARM_UP_LIMIT_MS);
  }
  synth.speak(utterance);
}

// the voice for `lang` among `voices`: a voice of the device is preferred - a
// network one has to be fetched and is slow to start. Android names the
// language "fr_FR" (underscore), so the comparison ignores that and the case
function pickVoice(voices, lang) {
  const wanted = lang.toLowerCase();
  const sameLang = voices.filter(
    (it) => it.lang.replace("_", "-").toLowerCase() === wanted,
  );
  return sameLang.find((it) => it.localService) ?? sameLang[0];
}

function loadVoices() {
  voice = pickVoice(window.speechSynthesis?.getVoices?.() ?? [], "fr-FR");
}

// asking for the list at once makes the browser start loading the voices
loadVoices();
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

// gap kept between the helper panel and the screen edge, so both borders show
const HELPER_EDGE_GAP = 5;

function keepOnScreen(pnl) {
  const { clientWidth: screenWidth } = document.documentElement;
  const overflow = pnl.getBoundingClientRect().right + HELPER_EDGE_GAP - screenWidth;
  if (overflow > 0) {
    pnl.style.left = `${parseFloat(pnl.style.left) - overflow}px`;
  }
}

function renderHelper(helper, selection, parts) {
  const { clientWidth: screenWidth } = document.documentElement;
  const selRange = selection.getRangeAt(0);
  const selRect = selRange.getBoundingClientRect();
  const style = (left, top, position) => {
    // border-box, so the padding and the border are INSIDE max-width (there is
    // no global box-sizing); the gap on both sides keeps both borders visible
    return `background-color:black; color:#fff8dc; border:1px solid #fff8dc; padding:0.63rem; margin:0;
    border-radius:0.31rem; position:${position}; box-sizing:border-box;
    left:${left}px; top:${top}px; max-width:${screenWidth - 2 * HELPER_EDGE_GAP}px;`;
  };
  const helperHTML = (style) => {
    // the ru/en switch floats in the top right corner of the panel itself
    return `<div id="${prefix("helper")}" style="${style}"><div id="${prefix("langSwitch")}" style="float: right; display: flex; margin: 0 0 0.3rem 0.63rem;">${langSwitchButtonsHTML()}</div>${parts.join("<hr/>")}</div>`;
  };

  let left = Math.max(selRect.left, HELPER_EDGE_GAP);
  let top = selRect.top + selRect.height;
  helper.innerHTML = helperHTML(style(left, top, "fixed"));
  const pnl = byPrefixId("helper");
  while (
    pnl.getBoundingClientRect().right + HELPER_EDGE_GAP > screenWidth &&
    left > HELPER_EDGE_GAP
  ) {
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

// a selection often drags punctuation, quotes, a verse number or an italic
// "_" along with the word ("fente.", «Si, 12 ") - only the edges are cut, so
// what is inside stays intact ("aujourd'hui", "peut-être", several words)
function trimToLetters(text) {
  return text.replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, "");
}

async function showHelper(selection) {
  const text = trimToLetters(selection.toString()).toLowerCase();
  const helper = document.getElementById("fr-helper"); //TODO

  // the same word selected in another place of the text is a new selection:
  // its sentence and its being saved or not are different
  const at = trimmedSelectionPlace(selectionInBlock(selection));
  if (
    text &&
    helper.getAttribute("text") === text &&
    sameSelectionPlace(at, currentHelperAt)
  ) {
    return;
  }

  if (!text) {
    helper.removeAttribute("text");
    helper.innerHTML = ""; // TODO
    currentHelperAt = null;
    updateHelperSavedState();
    return;
  }

  helper.setAttribute("text", text);
  currentHelperSentence = sentenceAroundSelection(selection);
  currentHelperForm = text;
  currentHelperAt = at;
  updateHelperSavedState();

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
  const langSwitch = byPrefixId("langSwitch");
  return !!(
    node &&
    ((helper && helper.contains(node)) ||
      (langSwitch && langSwitch.contains(node)))
  );
}

// the ru/en switch in the top right corner of the helper panel (black panel,
// cream text): two buttons, the active one filled
function langSwitchButtonsHTML() {
  const current = getTranslationLang();
  const base =
    "margin: 0; padding: 0 0.5rem; height: 1.6rem; box-sizing: border-box; border: 1px solid #fff8dc; font-size: 0.75rem;";
  return TRANSLATION_LANGS.map((lang, index) => {
    const active = lang === current;
    const radius =
      index === 0
        ? "border-radius: 0.31rem 0 0 0.31rem;"
        : "border-radius: 0 0.31rem 0.31rem 0; border-left: 0;";
    const colors = active
      ? "background: #fff8dc; color: black; font-weight: bold;"
      : "background: black; color: #fff8dc;";
    return `<button type="button" data-lang="${lang}" style="${base} ${radius} ${colors}">${lang}</button>`;
  }).join("");
}

function renderTranslationLangSwitch() {
  const langSwitch = byPrefixId("langSwitch");
  if (langSwitch) langSwitch.innerHTML = langSwitchButtonsHTML();
}

// the switch lives inside the helper panel, which is rebuilt on every render,
// so its events are delegated from the document. Pressing it must not drop the
// text the user has selected, otherwise there would be nothing left to
// translate in the other language
const isLangSwitchTarget = (event) => !!event.target.closest?.(`#${prefix("langSwitch")}`);
["pointerdown", "mousedown"].forEach((type) =>
  document.addEventListener(type, (event) => {
    if (isLangSwitchTarget(event)) event.preventDefault();
  }),
);
document.addEventListener("click", (event) => {
  if (!isLangSwitchTarget(event)) return;
  const lang = event.target.closest("button[data-lang]")?.dataset.lang;
  if (lang) setTranslationLang(lang);
});

function setTranslationLang(lang) {
  if (!TRANSLATION_LANGS.includes(lang) || lang === getTranslationLang()) {
    return;
  }
  sessionTranslationLang = lang;
  try {
    localStorage.setItem(TRANSLATION_LANG_KEY, lang);
  } catch (e) {
    // not remembered between visits, but still applies until the page is closed
  }
  renderTranslationLangSwitch();
  // translate the word that is open in the helper again, in the new language
  const helper = document.getElementById("fr-helper");
  if (helper?.getAttribute("text")) {
    helper.removeAttribute("text");
    showHelper(document.getSelection());
  }
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
// saississent не находит
