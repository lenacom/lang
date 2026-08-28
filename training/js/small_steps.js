"use strict";

function SmallSteps(configName, items) {
  const partSize = 5;
  const config = getConfig(configName);
  let limit = config?.limit ?? 2 * partSize;
  const errors = config?.errors ?? [];
  let order = config?.order ?? "direct";
  if (order === "reverse") {
    items.reverse();
  }
  let part;
  let current;
  let countTests = 0;

  function saveSmallStepsConfig() {
    saveConfig(configName, { limit, errors: errors.slice(0, 100), order });
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
    if (newStep) {
      if (limit === items.length) {
        order = order === "direct"? "reverse" : "direct";
        items.reverse();
        limit = 2 * partSize;
      } else {
        limit = Math.min(limit + partSize, items.length);
      }
      part = Array.from({ length: partSize }, (_, i) => limit - partSize + i);
    } else {
      part = [];
    }
    fillRandomly(part, errors.map(it => it[0]), 2 * partSize);
    const previous = Array.from({ length: limit }, (_, i) => i)
      .filter(it => !part.includes(it));
    fillRandomly(part, previous, 2 * partSize);
    saveSmallStepsConfig();
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
    countTests++;
    const index = errors.findIndex(it => it[0] === current);
    if (correct) {
      if (index >= 0) {
        if (errors[index][1] === 5) {
          errors.splice(index, 1);
        } else {
          errors[index][1]++;
        }
        saveSmallStepsConfig();
      }  
      setCurrent();
    } else {
      if (index == -1) {
        errors.push([current, 0]);
      }
      saveSmallStepsConfig();
      setPart();
    }
  }

  function getState() {
    return { item: items[current], part, limit, countTests };
  }

  setPart();

  return { getState, setAnswered };
}
