"use strict";

function smallSteps(id,
    items, 
    fnItemHTML,
    fnCheckAnswer,
    fnErrorHTML) {
  const config = getConfig(id);
  let start = config?.start ?? 0;
  const errors = config?.errors ?? [];
  let part;
  let current;
  const partSize = 10;

  const html =
    `<div id="part"></div>
    <div id="progress"></div>
    <hr/>
    <div id="item"></div>
    <div><button onClick="document.dispatchEvent(new Event('next'))">Дальше</button></div>
    <div id="errors"></div>`;
  document.getElementById(id).innerHTML = html;

  document.addEventListener("next", checkAnswer);

  function saveStartAndErrors() {
    saveConfig(id, { start, errors: errors.slice(0, 100) });
  }

  function pickRandomly(fromArray, howMany) {
    if (howMany <= 0) {
      return [];
    }
    const result = [];
    const fromArrayCopy = [...fromArray];
    while (result.length < howMany && fromArrayCopy.length) {
      const index = Math.round(Math.random() * (fromArrayCopy.length - 1));
      result.push(fromArrayCopy[index]);
      fromArrayCopy.splice(index, 1);
    }
    return result;
  }

  function setPart() {
    let messages = [];
    if (part && part.length === 0) {
      start += partSize;
      if (start >= items.length) {
        messages.push("Ура! Все тесты пройдены. Начинаем с начала.");
        start = 0;
      }
    }
    const end = Math.min(start + partSize, items.length);
    part = Array.from({ length: end - start }, (_, i) => start + i);
    if (start > 0) {
      part = part.concat(pickRandomly(errors, partSize));
      const previous = Array.from({ length: start }, (_, i) => i);
      part = part.concat(pickRandomly(previous, 2 * partSize - part.length));
    }
    messages.push(`Тесты по ${end} из ${items.length}.`);
    byId("part").innerHTML = messages.join(" ");
    saveStartAndErrors();
    setCurrent();
  }

  function setCurrent() {
    if (part.length === 0) {
      setPart();
    } else {
      byId("progress").innerHTML = `Осталось тестов: ${part.length}.`;
      const index = Math.round(Math.random() * (part.length - 1));
      current = part[index];
      part.splice(index, 1);
      byId("item").innerHTML = fnItemHTML(items[current]);
    }
  }

  function checkAnswer() {
    const item = items[current];
    const ok = fnCheckAnswer(item);
    if (ok) {
      const index = errors.findIndex(it => it === current);
      if (index) {
        errors.splice(index, 1);
        saveStartAndErrors();
      }  
      setCurrent();
    } else {
      errors.unshift(current);
      saveStartAndErrors()
      byId("errors").innerHTML = fnErrorHTML(item);
      setPart();
    }
  }

  setPart();
}