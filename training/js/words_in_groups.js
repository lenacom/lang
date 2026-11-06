"use strict";

function WordsInGroups(id, items, lang) {
  const config = getConfig(id);
  const repeatOftener = config.repeatOftener ?? {};
  // earlier versions appended the same index again on every un-tick, so
  // the saved lists may contain duplicates - collapse them (this also keeps
  // the cookie small)
  for (const name of Object.keys(repeatOftener)) {
    repeatOftener[name] = [...new Set(repeatOftener[name])];
  }
  let wordFirst = config.wordFirst ?? false;

  let indexHtml = "";
  for (let key of Object.keys(items)) {
    indexHtml += `<div><a href="javascript:document.dispatchEvent(new CustomEvent('part', { detail: { name: '${key}' } }))">${key}</a></div>`;
  }

  const html = `<div id="index" style="display: block;">${indexHtml}</div>
    <div id="part" style="display: none;">
      <div id="name" class="header"></div>
      <div class="valign" style="margin-bottom: 0.5rem;">
        <input type="radio" id="orderTranslationFirst" name="wordOrder" ${!wordFirst ? "checked" : ""}
          onClick="document.dispatchEvent(new CustomEvent('wordOrder', { detail: { wordFirst: false } }))"/>
        <label for="orderTranslationFirst">перевод - слово</label>
        <input type="radio" id="orderWordFirst" name="wordOrder" ${wordFirst ? "checked" : ""}
          onClick="document.dispatchEvent(new CustomEvent('wordOrder', { detail: { wordFirst: true } }))"/>
        <label for="orderWordFirst">слово - перевод</label>
      </div>
      <div id="progress"></div>
      <div id="text1"></div>
      <div id="text2"></div>
      <div><button style="margin-top: 1rem" onClick="document.dispatchEvent(new Event('next'))">Дальше</button></div>
    </div>`;

  byId(id).innerHTML = html;

  document.addEventListener("next", next);
  document.addEventListener("part", ({ detail }) => setPart(detail.name));
  document.addEventListener("wordOrder", ({ detail }) => {
    wordFirst = detail.wordFirst;
    saveConfig(id, { repeatOftener, wordFirst });
  });
  document.addEventListener("repeatOftener", ({ detail }) => {
    const list = repeatOftener[detail.partName] ?? [];
    if (detail.value) {
      if (!list.includes(detail.index)) {
        list.push(detail.index);
      }
      repeatOftener[detail.partName] = list;
    } else {
      repeatOftener[detail.partName] = list.filter((it) => it !== detail.index);
    }
    saveConfig(id, { repeatOftener, wordFirst });
  });

  let remained;
  let partName;
  let itemIndex;
  let part;
  let partRepeatOftener;

  function setPart(name) {
    partName = name;
    part = items[name].map((it, id) => [id, it[1], it[0], it[2]]);
    partRepeatOftener = part.filter((it) =>
      (repeatOftener[partName] ?? []).includes(it[0]),
    );
    remained = partRepeatOftener.length + part.length;
    hide("index");
    byId("name").innerHTML = partName;
    show("part");
    setItem();
  }

  function currentPart() {
    return partRepeatOftener.length ? partRepeatOftener : part;
  }

  // gender given by the article before a word (du = de le, au = à le)
  const ARTICLE_GENDER = {
    un: "m",
    le: "m",
    du: "m",
    au: "m",
    une: "f",
    la: "f",
  };

  // a standalone "m" / "f" marks only the word right before it; an article
  // marks the word right after it. Where the two overlap (an article, its
  // word and the marker) they become one span, and the marker's gender wins.
  function highlightGender(source) {
    const tokens = source.split(" ");
    // "m" / "f", possibly with punctuation stuck to it ("f,", "m)")
    const markerOf = (token) => token.match(/^([mf])[^\p{L}\d_'’]*$/u)?.[1];
    const groups = [];
    tokens.forEach((token, i) => {
      const marker = markerOf(token);
      if (marker) {
        if (i > 0) groups.push({ from: i - 1, to: i, gender: marker });
        return;
      }
      const gender = ARTICLE_GENDER[token.toLowerCase()];
      if (
        gender &&
        i + 1 < tokens.length &&
        !markerOf(tokens[i + 1]) &&
        /\p{L}/u.test(tokens[i + 1])
      ) {
        groups.push({ from: i, to: i + 1, gender, article: true });
      }
    });

    const merged = [];
    for (const group of groups.sort((a, b) => a.from - b.from)) {
      const last = merged[merged.length - 1];
      if (last && group.from <= last.to) {
        last.to = Math.max(last.to, group.to);
        if (!group.article) last.gender = group.gender;
      } else {
        merged.push({ ...group });
      }
    }

    const parts = [];
    let i = 0;
    for (const group of merged) {
      while (i < group.from) parts.push(tokens[i++]);
      const words = tokens.slice(group.from, group.to + 1);
      // punctuation stuck to the last word (a comma, a bracket) stays outside
      const punctuation = words[words.length - 1].match(/[^\p{L}\d]*$/u)[0];
      words[words.length - 1] = words[words.length - 1].slice(
        0,
        words[words.length - 1].length - punctuation.length,
      );
      parts.push(
        `<span class="${group.gender}">${words.join(" ")}</span>${punctuation}`,
      );
      i = group.to + 1;
    }
    while (i < tokens.length) parts.push(tokens[i++]);
    return parts.join(" ");
  }

  function formatWord(item) {
    const text = highlightGender(item[2]);
    const speakText = item[2]
      .split(" ")
      .filter(
        (it) =>
          !["m", "f"].includes(it) &&
          !/^\[.*$/i.test(it) &&
          !/^.*\]$/i.test(it),
      )
      .join(" ");
    return { html: withSpeakButtonHTML(text, lang, speakText), speakText };
  }

  function reveal(item) {
    const checked =
      (repeatOftener[partName] ?? []).find((it) => it === item[0]) !==
      undefined;
    const addition = item[3] ? `<div class="small">${item[3]}</div>` : "";
    // the value must be read from the checkbox at click time (this.checked):
    // the page is not re-rendered between clicks, so a value baked into the
    // HTML here would be stale on the second click (un-ticking would re-add)
    return `${addition}
        <div class="valign">
          <label for="repeatOftener">Повторять чаще</label>
          <input type="checkbox" ${checked ? "checked" : ""} id="repeatOftener"
            onClick="document.dispatchEvent(new CustomEvent('repeatOftener', { detail: { partName: '${partName}', index: ${item[0]}, value: this.checked } }))"/>
        <div>`;
  }

  function setItem() {
    byId("text1").innerHTML = "";
    byId("text2").innerHTML = "";
    if (part.length === 0) {
      show("index");
      hide("part");
    } else {
      byId("progress").innerHTML = `Осталось: ${remained}`;
      remained -= 1;
      itemIndex = Math.round(Math.random() * (currentPart().length - 1));
      const item = currentPart()[itemIndex];
      if (wordFirst) {
        const { html, speakText } = formatWord(item);
        byId("text1").innerHTML = html;
        if (globalThis.autospeak) {
          speak(speakText, lang);
        }
      } else {
        byId("text1").innerHTML = item[1];
      }
    }
  }

  function next() {
    if (byId("text2").innerHTML === "") {
      const item = currentPart()[itemIndex];
      if (wordFirst) {
        byId("text2").innerHTML = `${item[1]}${reveal(item)}`;
      } else {
        const { html, speakText } = formatWord(item);
        byId("text2").innerHTML = `${html}${reveal(item)}`;
        if (globalThis.autospeak) {
          speak(speakText, lang);
        }
      }

      currentPart().splice(itemIndex, 1);
    } else {
      setItem();
    }
  }

  document.write(autospeakHTML());
}
