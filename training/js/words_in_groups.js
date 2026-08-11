"use strict";

function WordsInGroups(id, items, lang) {
  const config = getConfig(id);
  const repeatOftener = config.repeatOftener ?? {};

  let indexHtml = "";
  for (let key of Object.keys(items)) {
    indexHtml += `<div><a href="javascript:document.dispatchEvent(new CustomEvent('part', { detail: { name: '${key}' } }))">${key}</a></div>`;
  }

  const html = `<div id="index" style="display: block;">${indexHtml}</div>
    <div id="part" style="display: none;">
      <div id="progress"></div>
      <div id="text1"></div>
      <div id="text2"></div>
      <div><button style="margin-top:10px" onClick="document.dispatchEvent(new Event('next'))">Дальше</button></div>
    </div>`;

  byId(id).innerHTML = html;

  document.addEventListener("next", next);
  document.addEventListener("part", ({ detail }) => setPart(detail.name));
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
    saveConfig(id, { repeatOftener });
  });

  let remained;
  let partName;
  let itemIndex;
  let part;
  let partRepeatOftener;

  function setPart(name) {
    partName = name;
    part = items[name].map((it, id) => [id, it[1], it[0]]);
    partRepeatOftener = part.filter(it => (repeatOftener[partName] ?? []).includes(it[0]));
    remained = partRepeatOftener.length + part.length;
    hide("index");
    show("part");
    setItem();
  }

  function currentPart() {
    return partRepeatOftener.length? partRepeatOftener : part;
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
      byId("text1").innerHTML = currentPart()[itemIndex][1];
    } 
  }

  function next() {
    if (byId("text2").innerHTML === "") {
      const item = currentPart()[itemIndex];
      const text = item[2];
      const speakText = text.split("[")[0];
      const checked = (repeatOftener[partName] ?? []).find(it => it === item[0]);
      byId("text2").innerHTML = `${withSpeakButtonHTML(text, lang, speakText)}
        <div>
          <label for="repeatOftener">Повторять чаще</label>
            <input type="checkbox" ${checked ? "checked" : ""} id="repeatOftener" 
              onClick="document.dispatchEvent(new CustomEvent('repeatOftener', { detail: { partName: '${partName}', index: ${item[0]}, value: ${!checked} } }))"/>
          </label>
        <div>`;
 
      currentPart().splice(itemIndex, 1); 

      if (globalThis.autospeak) {
        speak(speakText, lang);
      }
    } else {
      setItem();
    }
  }

  document.write(autospeakHTML());
}
