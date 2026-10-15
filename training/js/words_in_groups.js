"use strict";

function WordsInGroups(id, items, lang) {
  const config = getConfig(id);
  const repeatOftener = config.repeatOftener ?? {};
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
    if (detail.value) {
      if (!repeatOftener[detail.partName]) {
        repeatOftener[detail.partName] = [];
      }
      repeatOftener[detail.partName].push(detail.index);
    } else {
      const index = repeatOftener[detail.partName].indexOf(detail.index);
      repeatOftener[detail.partName].splice(index, 1);
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

  function formatWord(item) {
    let text = item[2].replace(
      /(.*?)(?<![\p{L}\d_'’])([mf])(?![\p{L}\d_'’])/gu,
      '<span class="$2">$1$2</span>',
    );
    text = text.replace(/\b(une|la)\s+(\S+)/gi, '<span class="f">$1 $2</span>');
    text = text.replace(/\b(un|le)\s+(\S+)/gi, '<span class="m">$1 $2</span>');
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
    return `${addition}
        <div class="valign">
          <label for="repeatOftener">Повторять чаще</label>
          <input type="checkbox" ${checked ? "checked" : ""} id="repeatOftener"
            onClick="document.dispatchEvent(new CustomEvent('repeatOftener', { detail: { partName: '${partName}', index: ${item[0]}, value: ${!checked} } }))"/>
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
