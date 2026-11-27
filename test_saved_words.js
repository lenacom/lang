// Tests for the logic of the helper (src/fr/verbs_code.js): where a saved word
// stands in the text of the chapter (it is underlined there), how a selection
// is matched to it (the "Удалить" button), how the sentence of the "Учить"
// dialog underlines the word, and the speech (choice of the voice, the silent
// warm-up of the engine).
//
// Run from the project root:  node test_saved_words.js
//
// verbs_code.js is a browser script, so it is loaded into a sandbox with just
// enough fake browser to run its top level; only the pure functions are called.
const fs = require("fs");
const vm = require("vm");

const noop = () => {};
const sandbox = {
  irregularVerbs: {},
  regularVerbs: {},
  regularVerbBases1: new Set(),
  regularVerbBases2: new Set(),
  document: { addEventListener: noop },
  speechSynthesis: { addEventListener: noop },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  window: {},
  console,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("./src/fr/verbs_code.js", "utf8"), sandbox);
const call = (name, ...args) => sandbox[name] ?? vm.runInContext(name, sandbox);
const fn = (name) => vm.runInContext(name, sandbox);

let failed = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failed++;
    console.log(`FAIL ${name}\n  got      ${a}\n  expected ${e}`);
  }
}

// ---- the sentence of the dialog: the word underlined, not bold ----
const underline = fn("sentenceWithUnderline");
check("underline: the form as in the text",
  underline("Elle parlait trop.", ["parler", "parlait"]),
  "Elle <u>parlait</u> trop.");
check("underline: a phrase",
  underline("Il faut faire attention ici.", ["faire attention", "attention"]),
  "Il faut <u>faire attention</u> ici.");
check("underline: no bold left",
  underline("Le chat dort.", ["chat"]).includes("<b>"), false);
check("underline: the word is corrected and is not in the sentence",
  underline("Le chat dort.", ["chien", "chiot"]), "");
check("underline: whole words only",
  underline("Il chante dans la chambre.", ["chant"]), "");
check("underline: apostrophe of either kind",
  underline("Je pense à l’homme.", ["l'homme"]), "Je pense à <u>l’homme</u>.");
check("underline: html in the sentence is escaped",
  underline("a < b et chat", ["chat"]), "a &lt; b et <u>chat</u>");
check("underline: nothing without a sentence", underline("", ["chat"]), "");

// ---- where the saved word stands in the text of a block ----
const locate = fn("locateSavedForm");
const text1 = "Il disait : « Elle parlait trop. » Puis il partit.";
let p = locate(text1, "Elle parlait trop.", ["parler", "parlait"]);
check("locate: the form", p && text1.slice(p.start, p.end), "parlait");
p = locate(text1, "Puis il partit.", ["partit"]);
check("locate: the second sentence", p && text1.slice(p.start, p.end), "partit");
check("locate: the sentence is not in the block",
  locate(text1, "Autre phrase.", ["parlait"]), null);
check("locate: the word is not in the sentence",
  locate(text1, "Puis il partit.", ["chat"]), null);

const spaced = "Le   chat\n  noir dort.";
p = locate(spaced, "Le chat noir dort.", ["chat noir"]);
check("locate: a phrase across white space", p && spaced.slice(p.start, p.end), "chat\n  noir");

const longText = "Un début. Elle parlait trop et trop longtemps, vraiment. La fin.";
p = locate(longText, "… Elle parlait trop et trop longtemps, vraiment. …", ["parlait"]);
check("locate: a sentence cut with the … marks", p && longText.slice(p.start, p.end), "parlait");

const repeated = "Chat noir. Le chat dort.";
p = locate(repeated, "Le chat dort.", ["chat"]);
check("locate: the right sentence, not the first occurrence of the word",
  p, { start: 14, end: 18 });

// ---- an entry saved without a sentence: every place of the word ----
const all = fn("locateAllForms");
const t2 = "Le chat voit un chat. Les chats dorment.";
check("locate all: whole words",
  all(t2, ["chat"]).map((it) => t2.slice(it.start, it.end)), ["chat", "chat"]);
check("locate all: falls back to the next form only if the first has none",
  all(t2, ["chien", "chats"]).map((it) => t2.slice(it.start, it.end)), ["chats"]);

// ---- the selection ----
const trim = fn("trimOffsetsToLetters");
const t3 = "«Elle parlait trop.»";
check("trim: quotes and the full stop", trim(t3, 0, t3.length), { start: 1, end: 18 });
check("trim: only punctuation", trim("...", 0, 3), { start: 3, end: 3 });
check("trim: a trailing space after a double click",
  trim("le chat dort", 3, 8), { start: 3, end: 7 });

const matches = fn("selectionMatchesSaved");
const saved = { start: 10, end: 20 };
check("match: the same word", matches(10, 20, saved), true);
check("match: a part of a saved phrase", matches(15, 20, saved), true);
check("match: a selection that covers the saved word", matches(8, 22, saved), true);
check("match: the neighbour word", matches(21, 25, saved), false);
check("match: a selection that only touches the saved word", matches(18, 25, saved), false);

// ---- the text nodes of a block ----
const pos = fn("offsetsToNodePositions");
// "Le " + <span>chat</span> + " noir"  -> node lengths 3, 4, 5
check("nodes: inside one node", pos([3, 4, 5], 3, 7),
  { startIndex: 1, startOffset: 0, endIndex: 1, endOffset: 4 });
check("nodes: across nodes", pos([3, 4, 5], 1, 10),
  { startIndex: 0, startOffset: 1, endIndex: 2, endOffset: 3 });
check("nodes: ends exactly where a node ends", pos([3, 4, 5], 0, 3),
  { startIndex: 0, startOffset: 0, endIndex: 0, endOffset: 3 });
check("nodes: to the very end", pos([3, 4, 5], 7, 12),
  { startIndex: 2, startOffset: 0, endIndex: 2, endOffset: 5 });
check("nodes: beyond the text", pos([3, 4, 5], 20, 25), null);

const norm = fn("normalizeSpaces");
check("normalize: map", norm("a \n b"), { text: "a b", map: [0, 1, 4, 5] });

// ---- the voice of the speech: a device voice, "fr_FR" of Android included ----
const pick = fn("pickVoice");
const v = (lang, localService, name) => ({ lang, localService, name });
const names = (voice) => voice && voice.name;
check("voice: the exact language",
  names(pick([v("en-US", true, "en"), v("fr-FR", true, "fr")], "fr-FR")), "fr");
check("voice: Android writes fr_FR",
  names(pick([v("fr_FR", true, "fr")], "fr-FR")), "fr");
check("voice: a device voice is preferred to a network one",
  names(pick([v("fr-FR", false, "net"), v("fr-FR", true, "local")], "fr-FR")), "local");
check("voice: only a network one is left - it is used",
  names(pick([v("fr-FR", false, "net")], "fr-FR")), "net");
check("voice: none for the language", pick([v("en-US", true, "en")], "fr-FR"), undefined);
check("voice: no voices at all", pick([], "fr-FR"), undefined);
check("voice: Canadian French is not French of France",
  pick([v("fr-CA", true, "ca")], "fr-FR"), undefined);

// ---- the text of a selected phrase: names keep their capitals ----
const shownText = fn("phraseDisplayText");
check("phrase: a name at the start of the sentence stays",
  shownText("Pierre se souvint de la parole", ""), "Pierre se souvint de la parole");
check("phrase: a name after a full stop stays",
  shownText("Pierre se souvint de la parole", "Il partit. "), "Pierre se souvint de la parole");
check("phrase: a name in the middle of the sentence stays",
  shownText("Pierre se lever", "Il voit "), "Pierre se lever");
check("phrase: a name inside the phrase stays",
  shownText("Elle parlait avec Marie", ""), "elle parlait avec Marie");
check("phrase: a capital only at the sentence start goes",
  shownText("Il faut faire attention", ""), "il faut faire attention");
check("phrase: ... also after a quote mark",
  shownText("Le chat dort", "Il dit : « "), "le chat dort");
check("phrase: an elided article at the start",
  shownText("L'homme parle", ""), "l'homme parle");
check("phrase: the second sentence inside the selection",
  shownText("Il part. Elle reste", ""), "il part. elle reste");
check("phrase: a name that is also a verb form stays",
  shownText("Marie parlait", ""), "Marie parlait");
check("phrase: already lowercase is untouched",
  shownText("faire attention", "Il faut "), "faire attention");
check("single word: lowercased as before", shownText("Pierre", ""), "pierre");
check("single word: lowercased as before (2)", shownText("Maintenant", ""), "maintenant");

// ---- the gender colours of a saved word or phrase in the study dialog ----
// (the sandbox has no vowel-noun table of the build; a small one is put in)
vm.runInContext(
  `var vowelNounGenders = { "égard": "m", "idée": "f", "ami": "m", "amie": "f" };`,
  sandbox,
);
const paint = fn("highlightGender");
check("gender: a whole phrase, each noun phrase on its own",
  paint("une bonne action à mon égard"),
  '<span class="f">une bonne action</span> à <span class="m">mon égard</span>');
check("gender: article and noun", paint("le chat"), '<span class="m">le chat</span>');
check("gender: feminine", paint("la maison"), '<span class="f">la maison</span>');
check("gender: adjectives in between",
  paint("un très bon ami"), '<span class="m">un très bon ami</span>');
check("gender: a phrase of two nouns",
  paint("le chat de la voisine"),
  '<span class="m">le chat</span> de <span class="f">la voisine</span>');
check("gender: an elided \"d'une\"",
  paint("avoir peur d'une bonne idée"),
  'avoir peur d\'<span class="f">une bonne idée</span>');
check("gender: stops before a comma",
  paint("un chat, une chatte"),
  '<span class="m">un chat</span>, <span class="f">une chatte</span>');
check("gender: stops before a pronoun or a verb form of être",
  paint("la porte est ouverte"), '<span class="f">la porte</span> est ouverte');
check("gender: mon + a feminine noun with a vowel",
  paint("mon idée"), '<span class="f">mon idée</span>');
check("gender: mon + a masculine noun with a vowel",
  paint("mon égard"), '<span class="m">mon égard</span>');
check("gender: mon + an unknown noun with a vowel is left alone",
  paint("mon inconnu"), "mon inconnu");
check("gender: ma + a consonant", paint("ma sœur"), '<span class="f">ma sœur</span>');
check("gender: a lone determiner colours nothing", paint("à la"), "à la");
check("gender: no determiner", paint("faire attention"), "faire attention");
check("gender: the marker of the dictionary is as before",
  paint("chat m"), '<span class="m">chat m</span>');
check("gender: html is escaped", paint("le chat<b>"), '<span class="m">le chat</span>&lt;b&gt;');

// the gender the chapter itself showed when the word was saved wins over a guess
const genders = { n: 28, r: [[10, 16, "f"], [23, 28, "m"]] };
check("gender: ranges saved from the chapter",
  paint("une bonne action à mon égard", genders),
  'une bonne <span class="f">action</span> à mon <span class="m">égard</span>');
check("gender: ranges that do not fit the (corrected) word are ignored",
  paint("une bonne action", genders), '<span class="f">une bonne action</span>');
check("gender: the dictionary marker still comes first",
  paint("chat m", { n: 6, r: [[0, 4, "f"]] }), '<span class="m">chat m</span>');
check("gender: ranges are escaped", paint("a<b", { n: 3, r: [[0, 1, "m"]] }),
  '<span class="m">a</span>&lt;b');

// ---- the speak button of the translation: English only ----
const isEnglish = fn("isEnglishText");
check("english: words", isEnglish("house, building"), true);
check("english: Russian", isEnglish("дом, здание"), false);
check("english: a mix is not English", isEnglish("house, дом"), false);
check("english: no letters", isEnglish("12, 3"), false);
sandbox.window.speechSynthesis = {};
const translationButton = fn("translationSpeakBtnHTML");
check("button: Russian translation has none", translationButton("дом, здание"), "");
const englishButton = translationButton("house, building");
check("button: English translation has one for all the words",
  englishButton.includes("speak('house, building', 'en-US')"), true);
check("button: only one button", (englishButton.match(/<button/g) || []).length, 1);
check("button: quotes are escaped",
  translationButton("to take (someone's) place").includes("someone\\'s"), true);
check("button: the French word keeps its old form",
  fn("speakBtnHTML")("bonjour").includes("speak('bonjour')"), true);
delete sandbox.window.speechSynthesis;

// ---- the first, silent utterance wakes the engine; words wait for it ----
function speechWorld() {
  const spoken = [];
  const listeners = {};
  const synth = {
    speaking: false,
    pending: false,
    cancelled: 0,
    getVoices: () => [],
    addEventListener: noop,
    cancel() { this.cancelled++; },
    speak(utterance) { spoken.push(utterance); },
  };
  const world = {
    irregularVerbs: {}, regularVerbs: {}, regularVerbBases1: new Set(), regularVerbBases2: new Set(),
    document: { addEventListener: (type, fn) => (listeners[type] ??= []).push(fn) },
    speechSynthesis: synth,
    SpeechSynthesisUtterance: function (text) { this.text = text; },
    window: { speechSynthesis: synth },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    setTimeout: noop,
    console,
  };
  vm.createContext(world);
  vm.runInContext(fs.readFileSync("./src/fr/verbs_code.js", "utf8"), world);
  return { world, spoken, synth, touch: () => listeners.pointerdown.forEach((f) => f({ target: {} })), speak: (t) => vm.runInContext(`speak(${JSON.stringify(t)})`, world) };
}

let w = speechWorld();
w.touch();
check("speech: the first touch says one silent utterance", w.spoken.map((u) => [u.text, u.volume]), [["a", 0]]);
w.touch();
check("speech: a second touch does not warm up again", w.spoken.length, 1);
w.speak("bonjour");
check("speech: a word asked for while warming up waits", w.spoken.length, 1);
check("speech: ... and nothing is cancelled meanwhile", w.synth.cancelled, 0);
w.speak("merci");
w.speak("salut");
w.spoken[0].onend();
check("speech: only the latest waiting word is said, once, aloud",
  w.spoken.slice(1).map((u) => [u.text, u.volume]), [["salut", 1]]);
w.spoken[0].onend();
check("speech: a repeated end of the warm-up changes nothing", w.spoken.length, 2);

w = speechWorld();
w.touch();
w.spoken[0].onend();
vm.runInContext(`speak("house, building", "en-US")`, w.world);
check("speech: an English text is said in English",
  w.spoken.slice(1).map((u) => [u.text, u.lang, u.volume]), [["house, building", "en-US", 1]]);
w.speak("bonjour");
check("speech: a French word is still French", w.spoken.at(-1).lang, "fr-FR");

w = speechWorld();
w.touch();
vm.runInContext(`speak("house", "en-US")`, w.world);
w.spoken[0].onend();
check("speech: a waiting English text keeps its language",
  w.spoken.slice(1).map((u) => [u.text, u.lang]), [["house", "en-US"]]);

w = speechWorld();
w.touch();
w.speak("bonjour");
w.spoken[0].onerror();
check("speech: a failed warm-up still releases the waiting word",
  w.spoken.slice(1).map((u) => u.text), ["bonjour"]);

w = speechWorld();
w.touch();
w.spoken[0].onend();
w.speak("un");
check("speech: after the warm-up a word is said at once", w.spoken.slice(1).map((u) => [u.text, u.volume]), [["un", 1]]);
check("speech: nothing is playing, so no cancel", w.synth.cancelled, 0);
w.synth.speaking = true;
w.speak("deux");
check("speech: a phrase still playing is cancelled", w.synth.cancelled, 1);

console.log(failed ? `\n${failed} test(s) FAILED` : "all saved-words tests passed");
process.exit(failed ? 1 : 0);
