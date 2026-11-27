import test from 'node:test';
import assert from 'node:assert/strict';
import { checkExercise, checkWord, checkText } from '../js/validate.js';
import { computeRequests, estimateLevel } from '../js/refill.js';
import { newGrammarProgress, recordAnswer } from '../js/grammar.js';
import { review, newState, GOOD } from '../js/srs.js';

test('validation catches broken generated exercises', () => {
  assert.deepEqual(checkExercise({ type: 'gap', q: 'Yo ___ aquí.', a: 'estoy', tags: ['x'] }), []);
  assert.ok(checkExercise({ type: 'gap', q: 'Yo aquí.', a: 'estoy', tags: ['x'] }).length);
  assert.ok(checkExercise({ type: 'choice', q: 'a', options: ['es', 'es'], a: 0, tags: ['x'] }).length, 'duplicate options');
  assert.ok(checkExercise({ type: 'choice', q: 'a', options: ['es', 'está'], a: 2, tags: ['x'] }).length);
  assert.ok(checkExercise({ type: 'reorder', words: ['la', 'casa', 'es'], a: 'la casa es grande', tags: ['x'] }).length);
  assert.ok(checkExercise({ type: 'error', q: 'Estoy aquí.', a: 'Estoy aquí.', tags: ['x'] }).length, 'not actually a mistake');
  assert.ok(checkExercise({ type: 'poem', tags: ['x'] }).length);
  assert.ok(checkExercise({ type: 'gap', q: 'a ___', a: 'b' }).length, 'tags required');
  assert.deepEqual(checkWord(['el andamio', 'scaffolding', 'Está montado.', 'It is up.']), []);
  assert.ok(checkWord(['el andamio', '']).length);
  assert.ok(checkText({ id: 'x', title: 't', level: 'A2', paragraphs: [[['Hola.', '']]], questions: [] }).length);
});

const unit = (id, n, level = 'A1') => ({ id, level, title: id, exercises: Array.from({ length: n }, (_, i) => ({ type: 'gap', q: `${id} ___ ${i}`, a: 'x', tags: ['t' + (i % 3)] })) });

test('grammar refill asks only for the unit in progress when it runs low', () => {
  const units = [unit('u01', 30), unit('u02', 12)];
  const g = newGrammarProgress();
  // u01 is the next unit with plenty left: no request.
  assert.equal(computeRequests({ units, grammar: g }).filter((r) => r.kind === 'exercises').length, 0);
  // master u01; u02 becomes next and has only 12 exercises → request.
  g.units.u01 = { score: 100, mastered: true, sets: 1, seen: {}, forms: {} };
  for (let i = 0; i < 3; i++) recordAnswer(g, 'u02', units[1].exercises[0], 0);
  const reqs = computeRequests({ units, grammar: g }).filter((r) => r.kind === 'exercises');
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].unitId, 'u02');
  assert.deepEqual(reqs[0].weakTags, ['t0']);
});

test('a request is not repeated for 3 days', () => {
  const units = [unit('u01', 5)];
  const now = 10 * 864e5;
  assert.equal(computeRequests({ units, pending: { 'exercises:u01': now - 864e5 }, now }).filter((r) => r.kind === 'exercises').length, 0);
  assert.equal(computeRequests({ units, pending: { 'exercises:u01': now - 4 * 864e5 }, now }).filter((r) => r.kind === 'exercises').length, 1);
});

test('word refill for focus topics running out; reading keeps 3 unread', () => {
  const words = Array.from({ length: 25 }, (_, i) => ({ id: `finance:w${i}`, topic: 'finance', es: `w${i}` }));
  const topics = [{ id: 'finance', name: 'Finance', level: 'A2' }];
  const cards = {};
  assert.equal(computeRequests({ words, topics, focus: ['finance'], cards }).filter((r) => r.kind === 'words').length, 0);
  for (let i = 0; i < 10; i++) cards[`finance:w${i}`] = review(newState(), GOOD, 0);
  const w = computeRequests({ words, topics, focus: ['finance'], cards }).find((r) => r.kind === 'words');
  assert.equal(w.topicId, 'finance');
  assert.equal(w.existing.length, 25);
  const news = computeRequests({ texts: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], reading: { a: { done: true } }, focus: ['finance'] }).find((r) => r.kind === 'news');
  assert.deepEqual(news.topics, ['finance']);
});

test('level estimate follows mastered units', () => {
  const units = [unit('u01', 1), unit('u02', 1), unit('u09', 1, 'A2')];
  const g = newGrammarProgress();
  assert.equal(estimateLevel(units, g), 'A1');
  g.units.u01 = { mastered: true }; g.units.u02 = { mastered: true };
  assert.equal(estimateLevel(units, g), 'A2');
});

test('backups never contain the backend token, and restoring keeps this phone\'s connection', async () => {
  const { state, exportBackup, importBackup } = await import('../js/state.js');
  state.settings = { focus: ['construction'], minutes: 15, backend: { url: 'https://x/exec', token: 'secret123' } };
  const text = exportBackup();
  assert.ok(!text.includes('secret123'));
  assert.ok(!text.includes('https://x/exec'));
  const evil = JSON.parse(text);
  evil.settings.backend = { url: 'https://attacker/exec', token: 't' };
  await importBackup(JSON.stringify(evil));
  assert.equal(state.settings.backend.url, 'https://x/exec');
});

test('background photo: accent picks the most colourful hue', async () => {
  const { pickAccent } = await import('../js/backdrop.js');
  const px = (r, g, b, n) => Array.from({ length: n }, () => [r, g, b, 255]).flat();
  const data = Uint8ClampedArray.from([...px(230, 90, 150, 300), ...px(40, 40, 40, 900), ...px(240, 240, 240, 500)]);
  const hex = pickAccent(data);
  assert.match(hex, /^#[0-9a-f]{6}$/);
  const r = parseInt(hex.slice(1, 3), 16), b = parseInt(hex.slice(5, 7), 16), g = parseInt(hex.slice(3, 5), 16);
  assert.ok(r > g && b > g, 'pink stays pink');
  assert.equal(pickAccent(Uint8ClampedArray.from(px(128, 128, 128, 500))), null);
});

test('a backup file downloaded from Drive (wrapped in savedAt/data) can be restored', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../js/state.js', import.meta.url), 'utf8');
  assert.match(src, /data\.data && data\.data\.app === 'mi-espanol'/);
});

test('content packs from ChatGPT: fences stripped, bad items dropped with reasons', async () => {
  const { parsePasted, checkPack } = await import('../js/importpack.js');
  const pasted = 'Here you go!\n```json\n' + JSON.stringify({
    format: 'mi-espanol-content-1',
    exercises: [
      { unit: 'u10', type: 'gap', q: 'Ayer ___ tarde.', a: 'llegué', tags: ['spelling'] },
      { unit: 'u99', type: 'gap', q: 'x ___', a: 'y', tags: ['t'] },
      { unit: 'u10', type: 'choice', q: '¿?', options: ['a'], a: 3, tags: ['t'] },
    ],
    words: [{ topic: 'series', name: 'TV series', words: [['la trama', 'plot', 'La trama es buena.', 'The plot is good.', 'n'], ['', '']] }],
    texts: [{ title: 'Hola', level: 'A2', paragraphs: [[['Hola.', 'Hello.']]], questions: [] }],
  }) + '\n```\nEnjoy!';
  const r = checkPack(parsePasted(pasted), [{ id: 'u10' }]);
  assert.deepEqual(r.counts, { exercises: 1, words: 1, texts: 1 });
  assert.equal(r.problems.length, 3);
  assert.throws(() => parsePasted('no json here'), /No JSON/);
});
