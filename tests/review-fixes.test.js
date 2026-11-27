// Regression tests for the fixes made in the review of 2026-11-27 (docs/reviews/REVIEW-2026-11-27.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkText } from '../js/validate.js';

const emptyContent = () => {
  const base = { topics: [], words: [], units: [], texts: [] };
  return { ...base, byId: new Map(), common: {}, base };
};

test('R1: a malformed AI text is dropped by validation instead of throwing', () => {
  assert.deepEqual(checkText({ id: 'x', title: 'x', level: 'A1', paragraphs: 'not a list', questions: [] }), ['no paragraphs']);
  assert.deepEqual(checkText({ id: 'x', title: 'x', level: 'A1', paragraphs: [[['Hola.', 'Hi.']]], questions: 'none' }), ['questions must be a list']);
});

test('R1: one broken content batch does not block sync and backups for ever', async () => {
  const { state } = await import('../js/state.js');
  const { syncNow } = await import('../js/sync.js');
  state.content = emptyContent();
  state.settings = { focus: [], minutes: 15, backend: { url: 'https://fake/exec', token: 't' } };
  state.sync = { lastSeq: 0, pending: {}, reports: [], user: 'owner', name: 'X' };
  const good = { title: 'Bien', level: 'A1', paragraphs: [[['Hola.', 'Hello.']]], questions: [] };
  const batches = [
    { seq: 1, kind: 'texts', meta: {}, items: [null, { title: 'x', level: 'A1', paragraphs: 'not a list', questions: [] }] },
    { seq: 2, kind: 'texts', meta: {}, items: [good] },
  ];
  const actions = [];
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    actions.push(body.action);
    const reply = body.action === 'content.since' ? { ok: true, batches: batches.filter((b) => b.seq > body.after), last: 2 }
      : body.action === 'backup.save' ? { ok: true, savedAt: 'now' } : { ok: true };
    return { ok: true, json: async () => reply };
  };
  const r = await syncNow({ forceBackup: true });
  assert.equal(state.sync.lastError, null);
  assert.equal(state.sync.lastSeq, 2);
  assert.equal(r.added, 1);
  assert.ok(actions.includes('backup.save'), 'the backup still runs');
  delete globalThis.fetch;
});

test('R2: retyping the faulty sentence of an "error" exercise is not right, even for an accent-only mistake', async () => {
  const { gradeAnswer } = await import('../js/check.js');
  const ex = { type: 'error', q: '¿Donde está la furgoneta?', a: '¿Dónde está la furgoneta?', tags: ['x'] };
  assert.equal(gradeAnswer('¿Donde está la furgoneta?', ex.a, ex).points, 0);
  assert.equal(gradeAnswer('Nosotros trabajabamos en la misma obra.', 'Nosotros trabajábamos en la misma obra.', { type: 'error', q: 'Nosotros trabajabamos en la misma obra.' }).points, 0);
  assert.equal(gradeAnswer('¿Dónde está la furgoneta?', ex.a, ex).points, 1);
  // Other exercise types keep the lenient accent rule.
  assert.equal(gradeAnswer('Es dificil', 'Es difícil', { type: 'translate' }).points, 1);
});

test('R2: in the verb trainer and tables an accent slip is half right (hablo is not habló)', async () => {
  const { gradeAnswer } = await import('../js/check.js');
  assert.deepEqual(gradeAnswer('hablo', 'habló', { type: 'conj' }), { points: 0.5, kind: 'accent-key' });
  assert.deepEqual(gradeAnswer('trabaje', 'trabajé', { type: 'table' }), { points: 0.5, kind: 'accent-key' });
  assert.equal(gradeAnswer('habló', 'habló', { type: 'conj' }).points, 1);
  assert.equal(gradeAnswer('la mapa', 'el mapa', { type: 'gap', tags: ['article-gender'] }).points, 0.5);
});

test('R3: match exercises accept either of two identical answers (u02: agua = el, mapa = el)', async () => {
  const { matchFits } = await import('../js/check.js');
  const pairs = [['agua', 'el'], ['ciudad', 'la'], ['mapa', 'el'], ['foto', 'la'], ['sistema', 'el']];
  assert.equal(matchFits(pairs, 0, 2), true);   // agua → the "el" button that belongs to mapa
  assert.equal(matchFits(pairs, 0, 4), true);
  assert.equal(matchFits(pairs, 0, 1), false);  // agua → la
  assert.equal(matchFits(pairs, 1, 1), true);
});

test('R4: reorder exercises can list other correct orders, and validation checks each one', async () => {
  const { reorderRight } = await import('../js/check.js');
  const { checkExercise } = await import('../js/validate.js');
  const ex = { type: 'reorder', words: ['se', 'lo', 'explico', 'mañana', 'al', 'cliente'], a: 'se lo explico mañana al cliente / se lo explico al cliente mañana / mañana se lo explico al cliente', tags: ['x'] };
  assert.deepEqual(checkExercise(ex), []);
  assert.equal(reorderRight(['Mañana', 'se', 'lo', 'explico', 'al', 'cliente'], ex.a), true);
  assert.equal(reorderRight(['se', 'lo', 'explico', 'al', 'cliente', 'mañana'], ex.a), true);
  assert.equal(reorderRight(['lo', 'se', 'explico', 'al', 'cliente', 'mañana'], ex.a), false);
  assert.deepEqual(checkExercise({ ...ex, a: ex.a + ' / se lo explico mañana' }), ["words don't make the answer"]);
});

test('F04: an accent that changes the word is half right; harmless ones stay right', async () => {
  const { checkAnswer, pointsFor, gradeAnswer } = await import('../js/check.js');
  assert.equal(checkAnswer('llego', 'llegó'), 'accent-key');
  assert.equal(checkAnswer('pague', 'pagué'), 'accent-key');
  assert.equal(checkAnswer('el lo sabe', 'él lo sabe'), 'accent-key');
  assert.equal(checkAnswer('esta en casa', 'está en casa'), 'accent-key');
  assert.equal(checkAnswer('dificil', 'difícil'), 'accent');
  assert.equal(checkAnswer('arbol', 'árbol'), 'accent');
  assert.equal(pointsFor('accent-key'), 0.5);
  assert.equal(gradeAnswer('llego', 'llegó', { type: 'gap' }).points, 0.5);
});

test('F10: optional subject pronouns in translations and rewrites', async () => {
  const { gradeAnswer, checkAnswer } = await import('../js/check.js');
  assert.equal(gradeAnswer('Yo estoy cansado', 'Estoy cansado / Estoy cansada', { type: 'translate' }).points, 1);
  assert.equal(gradeAnswer('Ellos decidieron cambiar de proveedor.', 'Decidieron cambiar de proveedor.', { type: 'transform' }).points, 1);
  assert.equal(gradeAnswer('Nosotros somos de Bulgaria', 'Somos de Bulgaria', { type: 'translate' }).points, 1);
  // Articles are not pronouns: "El gobierno…" must not lose its article.
  assert.equal(gradeAnswer('Gobierno redujo el déficit', 'El gobierno redujo el déficit', { type: 'translate' }).kind, 'article');
  // Gaps don't drop pronouns.
  assert.equal(checkAnswer('yo trabajo', 'trabajo'), 'wrong');
});

test('F33: smart quotes typed on an iPhone are ignored', async () => {
  const { checkAnswer } = await import('../js/check.js');
  assert.equal(checkAnswer('“Hola”', '"Hola"'), 'right');
});
