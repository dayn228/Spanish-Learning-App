import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newGrammarProgress, recordAnswer, finishSet, finishTestOut, finishReview, pickExercises,
  pickTestOut, exerciseWeight, recommendedUnit, unitsDueForReview, recordVerb, pickVerbItems, exerciseId,
} from '../js/grammar.js';

const DAY = 864e5;
const unit = {
  id: 'u01',
  exercises: Array.from({ length: 20 }, (_, i) => ({ type: 'gap', q: `q${i}`, a: `a${i}`, tags: [i < 10 ? 'ser' : 'estar'] })),
};
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('a perfect set of 10 masters the unit; 90% needs two sets; under 50% gains nothing', () => {
  const p1 = newGrammarProgress();
  assert.equal(finishSet(p1, 'u01', Array(10).fill(1)).mastered, true);

  const p2 = newGrammarProgress();
  const nine = [...Array(9).fill(1), 0];
  assert.equal(finishSet(p2, 'u01', nine).gain, 81);
  assert.equal(finishSet(p2, 'u01', nine).mastered, true);

  const p3 = newGrammarProgress();
  assert.equal(finishSet(p3, 'u01', [1, 1, 1, 1, 0, 0, 0, 0, 0, 0]).gain, 0);
});

test('almost-right answers count half', () => {
  const p = newGrammarProgress();
  const r = finishSet(p, 'u01', Array(10).fill(0.5));
  assert.equal(r.gain, 25);
});

test('wrong answers raise the weight of exercises with the same tag', () => {
  const p = newGrammarProgress();
  for (let i = 0; i < 3; i++) recordAnswer(p, 'u01', unit.exercises[0], 0);
  recordAnswer(p, 'u01', unit.exercises[10], 1);
  const serW = exerciseWeight(p, 'u01', unit.exercises[1]);
  const estarW = exerciseWeight(p, 'u01', unit.exercises[11]);
  assert.ok(serW > estarW * 2, `${serW} vs ${estarW}`);
});

test('an exercise right twice in a row is retired', () => {
  const p = newGrammarProgress();
  const ex = unit.exercises[3];
  recordAnswer(p, 'u01', ex, 1); recordAnswer(p, 'u01', ex, 1);
  assert.ok(exerciseWeight(p, 'u01', ex) < 0.5);
});

test('picking gives n distinct exercises', () => {
  const set = pickExercises(newGrammarProgress(), unit, 10, seq([0.1, 0.9, 0.5, 0.3]));
  assert.equal(new Set(set).size, 10);
});

test('test-out covers every tag; 90% passes', () => {
  const t = pickTestOut(unit, 12, seq([0.2, 0.7, 0.4]));
  assert.deepEqual(new Set(t.flatMap((e) => e.tags)), new Set(['ser', 'estar']));
  const p = newGrammarProgress();
  assert.equal(finishTestOut(p, 'u01', [...Array(11).fill(1), 0]).passed, true);
  assert.equal(recommendedUnit([{ id: 'u01' }, { id: 'u02' }], p).id, 'u02');
});

test('reviews stretch when passed and unmaster when failed', () => {
  const p = newGrammarProgress(), t0 = 0;
  finishSet(p, 'u01', Array(10).fill(1), t0);
  assert.equal(unitsDueForReview([{ id: 'u01' }], p, t0 + 6 * DAY).length, 0);
  assert.equal(unitsDueForReview([{ id: 'u01' }], p, t0 + 7 * DAY).length, 1);
  finishReview(p, 'u01', [1, 1, 1, 1, 1], t0 + 7 * DAY);
  assert.equal(p.units.u01.reviewDays, 18);
  finishReview(p, 'u01', [0, 0, 1, 0, 0], t0 + 30 * DAY);
  assert.equal(p.units.u01.mastered, false);
});

test('exercise ids are stable and distinct', () => {
  assert.equal(exerciseId('u01', unit.exercises[0]), exerciseId('u01', { ...unit.exercises[0] }));
  assert.notEqual(exerciseId('u01', unit.exercises[0]), exerciseId('u01', unit.exercises[1]));
});

test('verb trainer leans on missed forms and varies verbs', () => {
  const p = newGrammarProgress();
  for (let i = 0; i < 5; i++) recordVerb(p, 'tener|present|0', 0);
  const counts = {};
  for (let k = 0; k < 200; k++) {
    for (const it of pickVerbItems(p, ['ser', 'tener', 'hablar', 'comer'], ['present'], 4)) counts[it.key] = (counts[it.key] || 0) + 1;
  }
  assert.ok(counts['tener|present|0'] > counts['tener|present|1'] * 1.5);
  const one = pickVerbItems(p, ['ser', 'tener', 'hablar', 'comer'], ['present'], 4);
  assert.equal(new Set(one.map((i) => i.inf)).size, 4);
});

test('mistakes are listed until put right', async () => {
  const { pickMistakes } = await import('../js/grammar.js');
  const p = newGrammarProgress();
  recordAnswer(p, 'u01', unit.exercises[0], 0, 100);
  recordAnswer(p, 'u01', unit.exercises[1], 0, 200);
  recordAnswer(p, 'u01', unit.exercises[2], 1, 300);
  let m = pickMistakes(p, [unit]);
  assert.deepEqual(m.map((x) => x.ex.q), ['q1', 'q0'], 'newest first');
  recordAnswer(p, 'u01', unit.exercises[1], 1, 400);
  m = pickMistakes(p, [unit]);
  assert.deepEqual(m.map((x) => x.ex.q), ['q0']);
});
