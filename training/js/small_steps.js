"use strict";

function SmallSteps(configName, containerId, items, sectionSize = 50, restartOnError = true) {
  const partSize = 5;
  let config;
  try {
    config = getConfig(configName);
  } catch (e) {
    config = {};
  }

  const sectionsCount = Math.max(1, Math.ceil(items.length / sectionSize));
  let section = config.section ?? 1;
  if (section < 1 || section > sectionsCount) {
    section = 1;
  }

  let part;
  let limit;
  let errors;
  let order;
  let countPartPasses;
  let window;
  let current;
  let countTests = 0;

  function getSectionItems(sectionNumber) {
    const start = (sectionNumber - 1) * sectionSize;
    return items.slice(start, start + sectionSize);
  }

  function addSectionSelect() {
    if (sectionsCount <= 1) {
      document.getElementById(containerId).innerHTML = "";
      return;
    }
    const selectId = `smallStepsSection__${configName}`;
    const optionsHTML = Array.from({ length: sectionsCount }, (_, i) => {
      const value = i + 1;
      const start = i * sectionSize + 1;
      const end = Math.min(value * sectionSize, items.length);
      return `<option value="${value}"${value === section ? " selected" : ""}>${start}-${end}</option>`;
    }).join("");
    document.getElementById(containerId).innerHTML =
      `Часть: <select id="${selectId}">${optionsHTML}</select>`;
    document.getElementById(selectId).addEventListener("change", (event) => {
      section = Number(event.target.value);
      initSection();
    });
  }

  function saveSmallStepsConfig() {
    config.section = section;
    config.sections = config.sections ?? {};
    config.sections[section] = {
      limit,
      errors: errors.slice(0, 100),
      order,
      countPartPasses,
    };
    saveConfig(configName, config);
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
      if (limit === part.length) {
        order = order === "direct" ? "reverse" : "direct";
        part.reverse();
        limit = 2 * partSize;
        countPartPasses++;
      } else {
        limit = Math.min(limit + partSize, part.length);
      }
      window = Array.from({ length: partSize }, (_, i) => limit - partSize + i);
    } else {
      window = [];
    }
    fillRandomly(
      window,
      errors.map((it) => it[0]),
      2 * partSize,
    );
    const previous = Array.from({ length: limit }, (_, i) => i).filter(
      (it) => !window.includes(it),
    );
    fillRandomly(window, previous, 2 * partSize);
    saveSmallStepsConfig();
    setCurrent();
  }

  function setCurrent() {
    if (window.length === 0) {
      setPart(true);
    } else {
      const index = Math.round(Math.random() * (window.length - 1));
      current = window[index];
      window.splice(index, 1);
    }
  }

  function setAnswered(correct) {
    countTests++;
    const index = errors.findIndex((it) => it[0] === current);
    if (correct) {
      if (index >= 0) {
        if (errors[index][1] === 7) {
          errors.splice(index, 1);
        } else {
          errors[index][1]++;
        }
        saveSmallStepsConfig();
      }
      setCurrent();
    } else {
      if (index >= 0) {
        errors[index][1] = 0;
      } else {
        errors.push([current, 0]);
      }
      saveSmallStepsConfig();
      if (restartOnError) {
        setPart();
      }
    }
  }

  function getState() {
    return { item: part[current], part, limit, countTests, countPartPasses };
  }

  function initSection() {
    part = getSectionItems(section);
    const sectionConfig = config.sections?.[section];
    limit = sectionConfig?.limit ?? 2 * partSize;
    errors = sectionConfig?.errors ?? [];
    order = sectionConfig?.order ?? "direct";
    countPartPasses = sectionConfig?.countPartPasses ?? 0;
    if (order === "reverse") {
      part.reverse();
    }
    setPart();
  }

  addSectionSelect();
  initSection();

  return { getState, setAnswered };
}
