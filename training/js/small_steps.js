"use strict";

function smallSteps(id,
    items, 
    fnItemHTML,
    fnCheckAnswer,
    fnErrorHTML) {
  const partSize = 5;
  const config = getConfig(id);
  let limit = config?.limit ?? 2 * partSize;
  const errors = config?.errors ?? [];
  let part;
  let current;

  const html = `<div id="test"></div>
    <div id="progress"></div>
    <hr/>
    <div id="item"></div>
    <div><button onClick="document.dispatchEvent(new Event('next'))">Дальше</button></div>
    <div id="error"></div>`;
  document.getElementById(id).innerHTML = html;

  document.addEventListener("next", checkAnswer);

  function saveLimitAndErrors() {
    saveConfig(id, { limit, errors: errors.slice(0, 100) });
  }

  function fillRandomly(toArray, fromArray, limit) {
    const fromArrayCopy = [...fromArray];
    while (toArray.length < limit && fromArrayCopy.length) {
      const index = Math.round(Math.random() * (fromArrayCopy.length - 1));
      toArray.push(fromArrayCopy[index]);
      fromArrayCopy.splice(index, 1);
    }
  }

  function setPart(newStep = false) {
    let messages = [];
    if (newStep) {
      if (limit === items.length) {
        messages.push("Ура! Все тесты пройдены. Начинаем с начала.");
        limit = partSize;
      } else {
        limit = Math.min(limit + partSize, items.length);
      }
      part = Array.from({ length: partSize }, (_, i) => limit - partSize + i);
    } else {
      part = [];
    }
    fillRandomly(part, errors, 2 * partSize);
    const previous = Array.from({ length: limit }, (_, i) => i)
      .filter(it => !part.includes(it));
    fillRandomly(part, previous, 2 * partSize);
    messages.push(`Тесты по ${limit} из ${items.length}.`);
    byId("test").innerHTML = messages.join(" ");
    saveLimitAndErrors();
    setCurrent();
  }

  function setCurrent() {
    if (part.length === 0) {
      setPart(true);
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
        saveLimitAndErrors();
      }  
      setCurrent();
    } else {
      errors.unshift(current);
      saveLimitAndErrors()
      byId("error").innerHTML = fnErrorHTML(item);
      setPart();
    }
  }

  setPart();
}