"use strict";

function WordsInGroups(id, items, lang) {
  let indexHtml = "";
  for (let key of Object.keys(items)) {
    indexHtml += `<div><a href="javascript:document.dispatchEvent(new CustomEvent('part', { detail: { name: '${key}' } }))">${key}</a></div>`;
  }

  const html = `<div id="index" style="display: block;">${indexHtml}</div>
    <div id="part" style="display: block;">
      <div id="progress"></div>
      <div id="text1"></div>
      <div id="text2"></div>
      <div><button onClick="document.dispatchEvent(new Event('next'))">Дальше</button></div>
    </div>`;

  byId(id).innerHTML = html;

  document.addEventListener("next", next);
  document.addEventListener("part", (event) => setPart(event.detail.name));

  let remained;
  let partName;
  let itemIndex;
  let part;

  function setPart(name) {
    partName = name;
    part = items[name];
    remained = part.length;
    hide("index");
    show("part");
    setItem();
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
      itemIndex = Math.round(Math.random() * (part.length - 1)); 
      const text = part[itemIndex][1];
      byId("text1").innerHTML = text;
    } 
  }

  function next() {
    if (byId("text2").innerHTML === "") {
      const text = part[itemIndex][0];
      const speakText = text.split("[")[0];
      byId("text2").innerHTML = `<span>${text}</span> ${speakButtonHTML(speakText, lang)}`;
      part.splice(itemIndex, 1); 

      if (globalThis.autospeak) {
        speak(speakText, lang);
      }
    } else {
      setItem();
    }
  }

  document.write(autospeakHTML());
}
