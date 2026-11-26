/*
  Verb conjugation (present tense for now; more tenses arrive with later units).

  How it works:
  1. Regular endings for -ar, -er and -ir verbs.
  2. Rules on top: stem changes (e→ie, o→ue, e→i, u→ue), an irregular "yo"
     form (hago, tengo, conozco…), and -uir verbs (construyo).
  3. Fully irregular verbs (ser, estar, ir…) are written out in full.

  Persons, in order: yo, tú, él/ella/usted, nosotros, vosotros, ellos/ellas/ustedes.
*/

export const PERSONS = ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / ellas / ustedes'];
export const PERSON_SHORT = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'];
export const TENSES = { present: 'Present' };

const ENDINGS = {
  present: {
    ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
    er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
    ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
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
  estar:     { en: 'to be (place, state)', full: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'] },
  ir:        { en: 'to go', full: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'] },
  haber:     { en: 'to have (auxiliary)', full: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'] },
  dar:       { en: 'to give', full: ['doy', 'das', 'da', 'damos', 'dais', 'dan'] },
  ver:       { en: 'to see', full: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'] },
  oír:       { en: 'to hear', full: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'] },
  tener:     { en: 'to have', stem: 'ie', yo: 'tengo' },
  venir:     { en: 'to come', stem: 'ie', yo: 'vengo' },
  decir:     { en: 'to say', stem: 'i', yo: 'digo' },
  hacer:     { en: 'to do, to make', yo: 'hago' },
  poner:     { en: 'to put', yo: 'pongo' },
  salir:     { en: 'to go out', yo: 'salgo' },
  traer:     { en: 'to bring', yo: 'traigo' },
  saber:     { en: 'to know (a fact)', yo: 'sé' },
  conocer:   { en: 'to know (a person, a place)', yo: 'conozco' },
  conducir:  { en: 'to drive', yo: 'conduzco' },
  poder:     { en: 'can, to be able to', stem: 'ue' },
  querer:    { en: 'to want', stem: 'ie' },
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
  leer:      { en: 'to read' },
  aprender:  { en: 'to learn' },
  vender:    { en: 'to sell' },
  deber:     { en: 'must, to owe' },
  creer:     { en: 'to believe' },
  vivir:     { en: 'to live' },
  escribir:  { en: 'to write' },
  abrir:     { en: 'to open' },
  recibir:   { en: 'to receive' },
  decidir:   { en: 'to decide' },
};

const STRESSED = [0, 1, 2, 5];   // persons whose stem changes (not nosotros, vosotros)

/** Present forms of an infinitive, or null if unknown. Handles reflexives like "levantarse". */
export function conjugate(infinitive, tense = 'present') {
  const reflexive = /se$/.test(infinitive) && !VERBS[infinitive];
  const base = reflexive ? infinitive.slice(0, -2) : infinitive;
  const forms = simple(base, tense);
  if (!forms) return null;
  if (!reflexive) return forms;
  const pron = ['me', 'te', 'se', 'nos', 'os', 'se'];
  return forms.map((f, i) => `${pron[i]} ${f}`);
}

function simple(inf, tense) {
  const v = VERBS[inf] || {};
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

/** Change the last matching vowel of the stem (pensar → piens-, poder → pued-). */
function changeStem(stem, kind) {
  const [from, to] = kind === 'ie' ? ['e', 'ie'] : kind === 'ue' ? ['o', 'ue'] : kind === 'u-ue' ? ['u', 'ue'] : ['e', 'i'];
  const at = stem.lastIndexOf(from);
  return at < 0 ? stem : stem.slice(0, at) + to + stem.slice(at + 1);
}

export function isKnownVerb(inf) {
  return !!conjugate(inf);
}
