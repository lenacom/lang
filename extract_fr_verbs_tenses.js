/* 
  'contre-battre',  'emboire',
  'débouillir',     'rebouillir',
  'reclure',        'déconfire',
  'accroire',       'renduire',
  'redevoir',       'refaire',
  'entre-luire',    'repleuvoir',
  'dépourvoir',     'désaprendre',
  'se ressouvenir', 'revaloir'
  
  refaire ?
  réécrire ?
 */
const irregularVerbs = ["absoudre", "dissoudre", "acquérir", "conquérir", "quérir", "reconquérir", 
  "requérir", "aller", "assaillir", "saillir", "tressaillir", "asseoir", "rasseoir", "avoir", "battre", 
  "abattre", "combattre", "débattre", "s'ébattre", "embattre", "rabattre", "rebattre", "boire", "bouillir", 
  "choir", "déchoir", "échoir", "clore", "résoudre", "contre-battre", "emboire", "débouillir", "rebouillir",
  "déclore", "éclore", "enclore", "forclore", "conclure", "exclure", "inclure", "occlure", "reclure", 
  "confire", "déconfire", "circoncire", "frire", "suffire", "connaître", "méconnaître", "reconnaître", 
  "paraître", "apparaître", "comparaître", "disparaître", "réapparaître", "recomparaître", "reparaître", 
  "transparaître", "coudre", "découdre", "recoudre", "courir", "accourir", "concourir", "encourir", 
  "parcourir", "recourir", "secourir", "couvrir", "découvrir", "recouvrir", "ouvrir", "entrouvrir", 
  "rentrouvrir", "rouvrir", "souffrir", "offrir", "craindre", "contraindre", "plaindre", "croire", 
  "accroire", "croître", "accroître", "décroître", "recroître", "cueillir", "accueillir", "recueillir", 
  "cuire", "recuire", "conduire", "déduire", "éconduire", "enduire", "induire", "introduire", "produire", 
  "reconduire", "réduire", "réintroduire", "renduire", "reproduire", "retraduire", "séduire", "traduire", 
  "construire", "détruire", "instruire", "reconstruire", "devoir", "redevoir", "dire", "contredire", 
  "dédire", "interdire", "maudire", "médire", "prédire", "redire", "dormir", "endormir", "rendormir", 
  "écrire", "circonscrire", "décrire", "inscrire", "prescrire", "proscrire", "récrire", 
  "réinscrire", "retranscrire", "souscrire", "transcrire", "être", "faillir", "défaillir", "faire", 
  "contrefaire", "défaire", "malfaire", "méfaire", "parfaire", "redéfaire", "refaire", "satisfaire", 
  "surfaire", "falloir", "fuir", "s'enfuir", "joindre", "adjoindre", "conjoindre", "disjoindre", "enjoindre", 
  "rejoindre", "oindre", "poindre", "lire", "élire", "réélire", "relire", "luire", "entre-luire", "reluire", 
  "nuire", "s'entre-nuire", "mettre", "admettre", "commettre", "démettre", "émettre", "s'entremettre", "omettre", 
  "permettre", "promettre", "réadmettre", "remettre", "retransmettre", "soumettre", "transmettre", "moudre", 
  "émoudre", "remoudre", "mourir", "mouvoir", "émouvoir", "promouvoir", "naître", "renaître", "ouîr", "gésir", 
  "paître", "repaître", "peindre", "dépeindre", "repeindre", "astreindre", "étreindre", "restreindre", "atteindre", 
  "ceindre", "enceindre", "empreindre", "feindre", "geindre", "teindre", "déteindre", "éteindre", "reteindre", 
  "plaire", "complaire", "déplaire", "taire", "pleuvoir", "repleuvoir", "pourvoir", "dépourvoir", "pouvoir", 
  "prendre", "apprendre", "comprendre", "détendre", "déprendre", "désaprendre", "entreprendre", "s'éprendre", 
  "se méprendre", "réapprendre", "reprendre", "surprendre", "recevoir", "apercevoir", "concevoir", "décevoir", 
  "percevoir", "rendre", "défendre", "descendre", "condescendre", "fendre", "pourfendre", "refendre", "dépendre", 
  "suspendre", "tendre", "attendre", "détendre", "distendre", "entendre", "étendre", "prétendre", "retendre", 
  "sous-entendre", "sous-tendre", "vendre", "mévendre", "épandre", "répandre", "répandre", "fondre", "confondre", 
  "parfondre", "refondre", "pondre", "répondre", "correspondre", "tondre", "perdre", "reperdre", "mordre", 
  "démordre", "remordre", "tordre", "détordre", "distordre", "retordre", "rompre", "corrompre", "interrompre", 
  "foutre", "se contrefoutre", "rire", "sourire", "savoir", "sentir", "consentir", "pressentir", "ressentir", 
  "mentir", "démentir", "partir", "départir", "repartir", "se repentir", "sortir", "ressortir", "seoir", "messeoir", 
  "servir", "desservir", "resservir", "suivre", "s'ensuivre", "poursuivre", "surseoir", "tenir", "s'abstenir", 
  "appartenir", "contenir", "détenir", "entretenir", "maintenir", "obtenir", "retenir", "soutenir", "venir", 
  "advenir", "circonvenir", "contrevenir", "convenir", "devenir", "disconvenir", "intervenir", "obvenir", "parvenir", 
  "prévenir", "provenir", "redevenir", "se ressouvenir", "revenir", "se souvenir", "subvenir", "survenir", "traire", 
  "abstraire", "distraire", "extraire", "soustraire", "braire", "vaincre", "convaincre", "valoir", "équivaloir", 
  "prévaloir", "revaloir", "vêtir", "dévêtir", "revêtir", "vivre", "revivre", "survivre", "voir", "entrevoir", 
  "prévoir", "revoir", "vouloir", "ouïr", "pendre", "haïr", "envoyer", "renvoyer", "compromettre", "enfreindre", 
  "se morfondre", "redescendre", "revendre"];

const fs = require('fs');
const SRC = "./src";
const { parse } = require('node-html-parser');

function extractTense(doc, selector, cutBase = "") {
  return doc.querySelector(`${selector} .person`)
    .querySelectorAll(".form0")
    .map(it => it.text.replace(cutBase, ""));
}

async function extractVerb(verb, cutBase = "") {
  console.log(verb);
  const path = verb.replace(/[\s']/g, "_").replace(/[éê]/g, "e").replace("î", "i");
  const url = `https://www.le-francais.ru/conjugaison/${path}/`;
  const response = await fetch(url);
  const html = await response.text();
  const doc = parse(html);

  let result = {};
  result["présent"] = extractTense(doc, ".indicative .present", cutBase);
  result["imparfait"] = extractTense(doc, ".indicative .imperfect", cutBase);
  result["passé simple"] = extractTense(doc, ".indicative .simple-past", cutBase);
  result["futur simple"] = extractTense(doc, ".indicative .future", cutBase);
  result["subjonctif présent"] = extractTense(doc, ".subjunctive .present", cutBase);
  result["subjonctif imparfait"] = extractTense(doc, ".subjunctive .imperfect", cutBase);
  result["conditionnel présent"] = extractTense(doc, ".conditional .present", cutBase);
  result["imperatif"] = extractTense(doc, ".imperative .present", cutBase);
  result["participe présent"] = extractTense(doc, ".participle .present", cutBase);
  result["participe passé"] = extractTense(doc, ".participle .past", cutBase).slice(0, 1);

  result = Object.fromEntries(
    Object.entries(result)
    .map(([key, value]) => {
      if (!value.find(it => it)) {
        return [key, undefined];
      }
      return [key, value.length === 1? value[0] : value];
    })
    .filter(([_, value]) => value)
  );
  return result;
}

async function extractVerbs() {
  const irregularVerbsTenses = {};

  const failedVerbs = [];
  for (const verb of irregularVerbs) { //.slice(0,10)
    try {
      irregularVerbsTenses[verb] = await extractVerb(verb);
    } catch {
      failedVerbs.push(verb);
    }
  }
  console.log("failed irregular verbs:");
  console.log(failedVerbs);
  fs.writeFileSync(`${SRC}/fr/irregular_verbs.json`, JSON.stringify(irregularVerbsTenses));

  const regularVerbsEndings = {
    "1": await extractVerb("parler", "parl"),
    "2": await extractVerb("finir", "fin"),
  };
  fs.writeFileSync(`${SRC}/verbs/fr/regular_verbs.json`, JSON.stringify(regularVerbsEndings));
}

extractVerbs();
