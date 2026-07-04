const endingToVerbType = {"e":1,"es":1,"ons":1,"ez":1,"ent":1,"ais":1,"ait":1,"ions":1,"iez":1,"aient":1,"ai":1,"as":1,"a":1,"âmes":1,"âtes":1,"èrent":1,"erai":1,"eras":1,"era":1,"erons":1,"erez":1,"eront":1,"asse":1,"asses":1,"ât":1,"assions":1,"assiez":1,"assent":1,"erais":1,"erait":1,"erions":1,"eriez":1,"eraient":1,"ant":1,"é":1,"is":2,"it":2,"issons":2,"issez":2,"issent":2,"issais":2,"issait":2,"issions":2,"issiez":2,"issaient":2,"îmes":2,"îtes":2,"irent":2,"irai":2,"iras":2,"ira":2,"irons":2,"irez":2,"iront":2,"isse":2,"isses":2,"ît":2,"irais":2,"irait":2,"irions":2,"iriez":2,"iraient":2,"issant":2,"i":2};
const endingToTenses = {"e":[0,4,7],"es":[0,4],"ons":[0,7],"ez":[0,7],"ent":[0,4],"ais":[1],"ait":[1],"ions":[1,4],"iez":[1,4],"aient":[1],"ai":[2],"as":[2],"a":[2],"âmes":[2],"âtes":[2],"èrent":[2],"erai":[3],"eras":[3],"era":[3],"erons":[3],"erez":[3],"eront":[3],"asse":[5],"asses":[5],"ât":[5],"assions":[5],"assiez":[5],"assent":[5],"erais":[6],"erait":[6],"erions":[6],"eriez":[6],"eraient":[6],"ant":[8],"é":[9],"is":[0,2,7],"it":[0,2],"issons":[0,7],"issez":[0,7],"issent":[0,4,5],"issais":[1],"issait":[1],"issions":[1,4,5],"issiez":[1,4,5],"issaient":[1],"îmes":[2],"îtes":[2],"irent":[2],"irai":[3],"iras":[3],"ira":[3],"irons":[3],"irez":[3],"iront":[3],"isse":[4,5],"isses":[4,5],"ît":[5],"irais":[6],"irait":[6],"irions":[6],"iriez":[6],"iraient":[6],"issant":[8],"i":[9]};

function findVerbTenses(form) {
  function stringify(array, ids) {
    return ids.map(it => array[it]).join(", ");
  }

  const infinitiveIds = formToInfinitives[form];
  if (infinitiveIds !== undefined) {
    // irregular verb
    const tenseIds = formToTenses[form];
    return { 
      infinitives: stringify(infinitives, infinitiveIds), 
      tenses: stringify(tenses, tenseIds),
      type: "irregular"
    }
  } else {
    // regular verb
    for (let i = 1; i <= 8; i++) {
      const baseLength = form.length - i;
      if (baseLength >= 2) {
        const base = form.slice(0, baseLength).replace("ç", "c");
        const ending = form.slice(baseLength);
        const tenseIds = endingToTenses[ending];
        if (tenseIds !== undefined) {
          const verbType = endingToVerbType[ending];
          const verbs = verbType === 1 ? regularVerbs1 : regularVerbs2;
          if (verbs.has(base)) {
            const infinitive = base + (verbType === 1 ? "er" : "ir");
            return { 
              infinitives: infinitive, 
              tenses: stringify(tenses, tenseIds),
              type: "regular"
            }
          }
        }
      }
    }
  }
}
