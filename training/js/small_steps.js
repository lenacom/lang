function smallSteps(id,
    items, 
    fnItemHTML,
    fnCheckAnswer,
    fnErrorHTML) {
  const config = getConfig(id);
  let start = config?.start ?? 0;
  let part;
  let item;
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
    part = [...items.slice(start, end)];
    if (start > 0) {
      const previousItems = [...items.slice(0, start)];
      while (previousItems.length > (start - partSize)) {
        const index = Math.round(Math.random() * (previousItems.length - 1));
        part.push(previousItems[index]);
        previousItems.splice(index, 1);
      }
    }
    messages.push(`Тесты по ${end} из ${items.length}.`);
    byId("part").innerHTML = messages.join(" ");
    saveConfig(id, { start });
    setItem();
  }

  function setItem() {
    if (part.length === 0) {
      setPart();
    } else {
      byId("progress").innerHTML = `Осталось тестов: ${part.length}.`;
      const index = Math.round(Math.random() * (part.length - 1));
      item = part[index];
      part.splice(index, 1);
      byId("item").innerHTML = fnItemHTML(item);
    }
  }

  function checkAnswer() {
    const ok = fnCheckAnswer(item);
    if (ok) {
      setItem();
    } else {
      const errors = byId("errors");
      errors.innerHTML = fnErrorHTML(item) + errors.innerHTML;
      setPart();
    }
  }

  setPart();
}