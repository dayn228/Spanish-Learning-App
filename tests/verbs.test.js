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
