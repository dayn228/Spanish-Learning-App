import test from 'node:test';
import assert from 'node:assert/strict';
import { conjugate, VERBS } from '../js/verbs.js';

const cases = {
  hablar: 'hablo hablas habla hablamos habláis hablan',
  comer: 'como comes come comemos coméis comen',
  vivir: 'vivo vives vive vivimos vivís viven',
  ser: 'soy eres es somos sois son',
  estar: 'estoy estás está estamos estáis están',
  ir: 'voy vas va vamos vais van',
  tener: 'tengo tienes tiene tenemos tenéis tienen',
  venir: 'vengo vienes viene venimos venís vienen',
  decir: 'digo dices dice decimos decís dicen',
  hacer: 'hago haces hace hacemos hacéis hacen',
  poder: 'puedo puedes puede podemos podéis pueden',
  querer: 'quiero quieres quiere queremos queréis quieren',
  empezar: 'empiezo empiezas empieza empezamos empezáis empiezan',
  preferir: 'prefiero prefieres prefiere preferimos preferís prefieren',
  volver: 'vuelvo vuelves vuelve volvemos volvéis vuelven',
  dormir: 'duermo duermes duerme dormimos dormís duermen',
  jugar: 'juego juegas juega jugamos jugáis juegan',
  pedir: 'pido pides pide pedimos pedís piden',
  seguir: 'sigo sigues sigue seguimos seguís siguen',
  medir: 'mido mides mide medimos medís miden',
  construir: 'construyo construyes construye construimos construís construyen',
  conocer: 'conozco conoces conoce conocemos conocéis conocen',
  saber: 'sé sabes sabe sabemos sabéis saben',
  dar: 'doy das da damos dais dan',
  ver: 'veo ves ve vemos veis ven',
  oír: 'oigo oyes oye oímos oís oyen',
  salir: 'salgo sales sale salimos salís salen',
  levantarse: 'me levanto|te levantas|se levanta|nos levantamos|os levantáis|se levantan',
};

for (const [inf, expected] of Object.entries(cases)) {
  test(`present of ${inf}`, () => {
    const exp = expected.includes('|') ? expected.split('|') : expected.split(' ');
    assert.deepEqual(conjugate(inf), exp);
  });
}

test('every listed verb conjugates', () => {
  for (const inf of Object.keys(VERBS)) assert.equal(conjugate(inf).length, 6, inf);
});

test('unknown endings return null', () => {
  assert.equal(conjugate('xyz'), null);
});

test('preterite: regular, strong, stem-changing and spelling forms', () => {
  const p = (v) => conjugate(v, 'preterite').join(' ');
  assert.equal(p('hablar'), 'hablé hablaste habló hablamos hablasteis hablaron');
  assert.equal(p('tener'), 'tuve tuviste tuvo tuvimos tuvisteis tuvieron');
  assert.equal(p('decir'), 'dije dijiste dijo dijimos dijisteis dijeron');
  assert.equal(conjugate('hacer', 'preterite')[2], 'hizo');
  assert.equal(p('ir'), p('ser'));
  assert.equal(conjugate('pedir', 'preterite')[5], 'pidieron');
  assert.equal(conjugate('dormir', 'preterite')[2], 'durmió');
  assert.equal(conjugate('leer', 'preterite')[2], 'leyó');
  assert.equal(conjugate('construir', 'preterite')[5], 'construyeron');
  assert.equal(conjugate('llegar', 'preterite')[0], 'llegué');
  assert.equal(conjugate('buscar', 'preterite')[0], 'busqué');
  assert.equal(conjugate('empezar', 'preterite')[0], 'empecé');
});

test('imperfect: regular and the three irregulars', () => {
  assert.equal(conjugate('trabajar', 'imperfect')[3], 'trabajábamos');
  assert.equal(conjugate('vivir', 'imperfect')[0], 'vivía');
  assert.equal(conjugate('ser', 'imperfect').join(' '), 'era eras era éramos erais eran');
  assert.equal(conjugate('ir', 'imperfect')[3], 'íbamos');
  assert.equal(conjugate('ver', 'imperfect')[0], 'veía');
  assert.equal(conjugate('levantarse', 'imperfect')[0], 'me levantaba');
});
