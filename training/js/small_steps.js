"use strict";

function SmallSteps(configName, containerId, items, sectionSize = 50) {
  const partSize = 5;
  const config = getConfig(configName);
  migrateLegacyConfig();

  const sectionsCount = Math.max(1, Math.ceil(items.length / sectionSize));
  let section = config.section ?? 1;
  if (section < 1 || section > sectionsCount) {
    section = 1;
  }

  let selection;
  let limit;
  let errors;
  let order;
  let part;
  let current;
  let countTests = 0;

  function migrateLegacyConfig() {
    if (
      !config.sections &&
      (config.limit !== undefined ||
        config.errors !== undefined ||
        config.order !== undefined)
    ) {
      config.sections = {
        1: { limit: config.limit, errors: config.errors, order: config.order },
      };
      delete config.limit;
      delete config.errors;
      delete config.order;
    }
  }

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
    config.sections[section] = { limit, errors: errors.slice(0, 100), order };
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
      if (limit === selection.length) {
        order = order === "direct" ? "reverse" : "direct";
        selection.reverse();
        limit = 2 * partSize;
      } else {
        limit = Math.min(limit + partSize, selection.length);
      }
      part = Array.from({ length: partSize }, (_, i) => limit - partSize + i);
    } else {
      part = [];
    }
    fillRandomly(
      part,
      errors.map((it) => it[0]),
      2 * partSize,
    );
    const previous = Array.from({ length: limit }, (_, i) => i).filter(
      (it) => !part.includes(it),
    );
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
      setPart();
    }
  }

  function getState() {
    return { item: selection[current], selection, part, limit, countTests };
  }

  function initSection() {
    selection = getSectionItems(section);
    const sectionConfig = config.sections?.[section];
    limit = sectionConfig?.limit ?? 2 * partSize;
    errors = sectionConfig?.errors ?? [];
    order = sectionConfig?.order ?? "direct";
    if (order === "reverse") {
      selection.reverse();
    }
    setPart();
  }

  addSectionSelect();
  initSection();

  return { getState, setAnswered };
}
