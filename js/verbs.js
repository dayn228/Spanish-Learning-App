/*
  Verb conjugation: present, preterite (pretérito indefinido) and imperfect.

  How it works:
  1. Regular endings for -ar, -er and -ir verbs.
  2. Rules on top: stem changes (e→ie, o→ue, e→i, u→ue), an irregular "yo"
     form (hago, tengo, conozco…), and -uir verbs (construyo).
  3. Fully irregular verbs (ser, estar, ir…) are written out in full.

  Persons, in order: yo, tú, él/ella/usted, nosotros, vosotros, ellos/ellas/ustedes.
*/

export const PERSONS = ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / ellas / ustedes'];
export const PERSON_SHORT = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'];
export const TENSES = { present: 'Present', preterite: 'Past (pretérito indefinido)', imperfect: 'Imperfect (pretérito imperfecto)' };

const ENDINGS = {
  present: {
    ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
    er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
    ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
  },
  preterite: {
    ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'],
    er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
    ir: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
  },
  imperfect: {
    ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'],
    er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
    ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
  },
};

/* Irregular ("strong") preterite stems take these endings, with no accents. */
const STRONG = ['e', 'iste', 'o', 'imos', 'isteis', 'ieron'];

/* Past forms that follow no pattern. */
const FULL_PAST = {
  preterite: {
    ser: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
    ir: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
    dar: ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'],
    ver: ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'],
    estar: null, haber: null,
  },
  imperfect: {
    ser: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
    ir: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'],
    ver: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'],
  },
};

/*
  Verb list. Fields:
    en       meaning
    stem     stem change in the present: 'ie' | 'ue' | 'i' | 'u-ue'
    yo       irregular yo form in the present
    full     all six present forms (fully irregular)
*/
export const VERBS = {
  ser:       { en: 'to be (identity)', full: ['soy', 'eres', 'es', 'somos', 'sois', 'son'] },
  estar:     { en: 'to be (place, state)', full: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'], pret: 'estuv' },
  ir:        { en: 'to go', full: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'] },
  haber:     { en: 'to have (auxiliary)', full: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'], pret: 'hub' },
  dar:       { en: 'to give', full: ['doy', 'das', 'da', 'damos', 'dais', 'dan'] },
  ver:       { en: 'to see', full: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'] },
  oír:       { en: 'to hear', full: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'], yPast: true },
  tener:     { en: 'to have', stem: 'ie', yo: 'tengo', pret: 'tuv' },
  venir:     { en: 'to come', stem: 'ie', yo: 'vengo', pret: 'vin' },
  decir:     { en: 'to say', stem: 'i', yo: 'digo', pret: 'dij' },
  hacer:     { en: 'to do, to make', yo: 'hago', pret: 'hic' },
  poner:     { en: 'to put', yo: 'pongo', pret: 'pus' },
  salir:     { en: 'to go out', yo: 'salgo' },
  traer:     { en: 'to bring', yo: 'traigo', pret: 'traj' },
  saber:     { en: 'to know (a fact)', yo: 'sé', pret: 'sup' },
  conocer:   { en: 'to know (a person, a place)', yo: 'conozco' },
  conducir:  { en: 'to drive', yo: 'conduzco', pret: 'conduj' },
  poder:     { en: 'can, to be able to', stem: 'ue', pret: 'pud' },
  querer:    { en: 'to want', stem: 'ie', pret: 'quis' },
  pensar:    { en: 'to think', stem: 'ie' },
  empezar:   { en: 'to start', stem: 'ie' },
  entender:  { en: 'to understand', stem: 'ie' },
  cerrar:    { en: 'to close', stem: 'ie' },
  preferir:  { en: 'to prefer', stem: 'ie' },
  sentir:    { en: 'to feel', stem: 'ie' },
  volver:    { en: 'to come back', stem: 'ue' },
  encontrar: { en: 'to find', stem: 'ue' },
  costar:    { en: 'to cost', stem: 'ue' },
  dormir:    { en: 'to sleep', stem: 'ue' },
  contar:    { en: 'to count, to tell', stem: 'ue' },
  recordar:  { en: 'to remember', stem: 'ue' },
  jugar:     { en: 'to play', stem: 'u-ue' },
  pedir:     { en: 'to ask for, to order', stem: 'i' },
  seguir:    { en: 'to follow, to continue', stem: 'i', yo: 'sigo' },
  repetir:   { en: 'to repeat', stem: 'i' },
  medir:     { en: 'to measure', stem: 'i' },
  construir: { en: 'to build', uir: true },
  hablar:    { en: 'to speak' },
  trabajar:  { en: 'to work' },
  llegar:    { en: 'to arrive' },
  llevar:    { en: 'to carry, to wear' },
  llamar:    { en: 'to call' },
  necesitar: { en: 'to need' },
  tomar:     { en: 'to take, to have (drink)' },
  pagar:     { en: 'to pay' },
  comprar:   { en: 'to buy' },
  instalar:  { en: 'to install' },
  terminar:  { en: 'to finish' },
  comer:     { en: 'to eat' },
  beber:     { en: 'to drink' },
  leer:      { en: 'to read', yPast: true },
  aprender:  { en: 'to learn' },
  vender:    { en: 'to sell' },
  deber:     { en: 'must, to owe' },
  creer:     { en: 'to believe', yPast: true },
  vivir:     { en: 'to live' },
  escribir:  { en: 'to write' },
  abrir:     { en: 'to open' },
  recibir:   { en: 'to receive' },
  decidir:   { en: 'to decide' },
};

const STRESSED = [0, 1, 2, 5];   // persons whose stem changes (not nosotros, vosotros)

/** Present forms of an infinitive, or null if unknown. Handles reflexives like "levantarse". */
export function conjugate(infinitive, tense = 'present') {
  const reflexive = /se$/.test(infinitive) && !VERBS[infinitive] && !/^(ser)$/.test(infinitive);
  const base = reflexive ? infinitive.slice(0, -2) : infinitive;
  const forms = simple(base, tense);
  if (!forms) return null;
  if (!reflexive) return forms;
  const pron = ['me', 'te', 'se', 'nos', 'os', 'se'];
  return forms.map((f, i) => `${pron[i]} ${f}`);
}

function simple(inf, tense) {
  const v = VERBS[inf] || {};
  if (tense === 'preterite') return preterite(inf, v);
  if (tense === 'imperfect') return imperfect(inf, v);
  if (tense !== 'present') return null;
  if (v.full) return [...v.full];
  const type = inf.slice(-2).replace('í', 'i');
  const ends = ENDINGS[tense][type];
  if (!ends) return null;
  let stem = inf.slice(0, -2);
  const forms = ends.map((e) => stem + e);

  if (v.stem) {
    const changed = changeStem(stem, v.stem);
    for (const i of STRESSED) forms[i] = changed + ends[i];
  }
  if (v.uir) {
    for (const i of STRESSED) forms[i] = stem + 'y' + ends[i];
  }
  if (v.yo) forms[0] = v.yo;
  return forms;
}

function preterite(inf, v) {
  const full = FULL_PAST.preterite[inf];
  if (full) return [...full];
  const type = inf.slice(-2).replace('í', 'i');
  if (!ENDINGS.preterite[type]) return null;
  let stem = inf.slice(0, -2);
  if (v.pret) {
    // Strong stem: tuve, tuviste, tuvo… ; stems ending in j drop the i: dijeron, trajeron.
    const forms = STRONG.map((e, i) => v.pret + (i === 5 && v.pret.endsWith('j') ? 'eron' : e));
    if (inf === 'hacer') forms[2] = 'hizo';
    return forms;
  }
  const forms = ENDINGS.preterite[type].map((e) => stem + e);
  // -ir stem-changers change in él and ellos: pidió, pidieron; durmió, durmieron.
  if (type === 'ir' && v.stem) {
    const changed = v.stem === 'ue' ? swapLast(stem, 'o', 'u') : swapLast(stem, 'e', 'i');
    forms[2] = changed + 'ió';
    forms[5] = changed + 'ieron';
  }
  // Vowel before the ending (leer, creer, oír, construir): leyó, leyeron, leíste, leímos.
  if (v.yPast || v.uir) {
    forms[2] = stem + 'yó';
    forms[5] = stem + 'yeron';
    if (!v.uir) { forms[0] = stem + 'í'; forms[1] = stem + 'íste'; forms[3] = stem + 'ímos'; forms[4] = stem + 'ísteis'; }
  }
  // Spelling in the yo form: llegué, pagué, empecé, busqué, jugué.
  if (type === 'ar') {
    if (stem.endsWith('g')) forms[0] = stem + 'ué';
    else if (stem.endsWith('c')) forms[0] = stem.slice(0, -1) + 'qué';
    else if (stem.endsWith('z')) forms[0] = stem.slice(0, -1) + 'cé';
  }
  return forms;
}

function imperfect(inf, v) {
  const full = FULL_PAST.imperfect[inf];
  if (full) return [...full];
  const type = inf.slice(-2).replace('í', 'i');
  if (!ENDINGS.imperfect[type]) return null;
  const stem = inf.slice(0, -2);
  return ENDINGS.imperfect[type].map((e) => stem + e);
}

function swapLast(stem, from, to) {
  const at = stem.lastIndexOf(from);
  return at < 0 ? stem : stem.slice(0, at) + to + stem.slice(at + 1);
}

/** Change the last matching vowel of the stem (pensar → piens-, poder → pued-). */
function changeStem(stem, kind) {
  const [from, to] = kind === 'ie' ? ['e', 'ie'] : kind === 'ue' ? ['o', 'ue'] : kind === 'u-ue' ? ['u', 'ue'] : ['e', 'i'];
  const at = stem.lastIndexOf(from);
  return at < 0 ? stem : stem.slice(0, at) + to + stem.slice(at + 1);
}

export function isKnownVerb(inf) {
  return !!conjugate(inf);
}
