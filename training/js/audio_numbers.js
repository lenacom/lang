"use strict";

function AudioNumbers(id, lang) {
  const options = ["100", "1000", "1000"].map(it => {
    return `<input type="radio" id="limit${it}" name="limit" checked onClick="document.dispatchEvent(new CustomEvent('limit', { detail: { limit: ${it} } }))">
    <label for="limit${it}">${it}</label>`;
  }).join("");
  const html = `<div style="margin-bottom: 1rem; display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 1rem;">
    ${options}
  </div>
  <div style="margin-bottom: 1rem; display: flex; flex-direction: row; flex-wrap: wrap; gap: 1rem;">
    <input style="display: none" id="response" type="text" size="4">
    <button id="next" onClick="document.dispatchEvent(new Event('next'))">Начать</button>
  </div>
  <div id="time"></div>
  <div id="error" class="error"></div>`;
  byId(id).innerHTML = html;

  document.addEventListener("next", next);
  document.addEventListener("part", ({ detail }) => limit = detail.limit);

  let limit = 100;
  let number;
  let startTime;
  let countResponses = 0;
  let responsesTotalTime = 0;

  byId("response").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      event.preventDefault(); 
      next();
    }
  });

  function newNumber() {
    number = Math.floor(Math.random() * limit);
  }

  function next() {
    if (byId("response").value !== "") {
      countResponses += 1;
      responsesTotalTime += performance.now() - startTime;
      const avgTime = Math.round(responsesTotalTime / countResponses / 1000);
      byId("time").innerHTML = `Среднее время ответа: ${avgTime} c`;
      const response = Number(byId("response").value);
      byId("error").innerHTML = response === number? "" : withSpeakButtonHTML(number.toString(), LANG);
      byId("response").value = "";
      newNumber();
    }
    byId("next").innerHTML = "Дальше";
    show("response");
    speak(number.toString(), LANG, () => startTime = performance.now());        
  }

  newNumber();
}
