"use strict";

function SmallSteps(configName, items) {
  const partSize = 5;
  const config = getConfig(configName);
  let limit = config?.limit ?? 2 * partSize;
  const errors = config?.errors ?? [];
  let part;
  let current;

  function saveLimitAndErrors() {
    saveConfig(configName, { limit, errors: errors.slice(0, 100) });
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
    saveLimitAndErrors();
    setCurrent();
  }

  function setCurrent() {
    if (part.length === 0) {
      setPart(true);
    } else {
      const index = Math.round(Math.random() * (part.length - 1));
      current = part[index];
      part.splice(index, 1);
    }
  }

  function setAnswered(correct) {
    const item = items[current];
    if (correct) {
      const index = errors.findIndex(it => it === current);
      if (index) {
        errors.splice(index, 1);
        saveLimitAndErrors();
      }  
      setCurrent();
    } else {
      errors.unshift(current);
      saveLimitAndErrors();
      setPart();
    }
  }

  function getState() {
    return { item: items[current], part, limit };
  }

  setPart();

  return { getState, setAnswered };
}
