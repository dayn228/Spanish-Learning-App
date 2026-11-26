// Unit tests for the pure logic. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { review, markKnown, stage, newState, previewInterval, AGAIN, HARD, GOOD, EASY } from '../js/srs.js';
import { recordSession, displayStreak, newStreak } from '../js/streak.js';
import { checkAnswer } from '../js/check.js';
import { buildSession, pickNew } from '../js/session.js';
import { daysBetween, addDays } from '../js/dates.js';
import { slug } from '../js/content.js';

const DAY = 864e5;
const T0 = Date.UTC(2026, 10, 26, 9);

test('intervals grow with correct answers and grow faster when easy', () => {
  let s = newState(), t = T0;
  const good = [];
  for (let i = 0; i < 5; i++) { s = review(s, GOOD, t); good.push(s.interval); t = s.due; }
  assert.deepEqual(good.slice(0, 2), [1, 2.5]);
  assert.ok(good[4] > 30, `5 good answers should pass a month, got ${good[4]}`);

  let e = newState(); t = T0;
  for (let i = 0; i < 5; i++) { e = review(e, EASY, t); t = e.due; }
  assert.ok(e.interval > good[4] * 2, 'easy answers race ahead');
});

test('a miss brings the word back in minutes and counts a lapse', () => {
  let s = review(review(newState(), GOOD, T0), GOOD, T0 + DAY);
  s = review(s, AGAIN, T0 + 5 * DAY);
  assert.equal(s.reps, 0);
  assert.equal(s.lapses, 1);
  assert.equal(s.due, T0 + 5 * DAY + 10 * 60000);
  assert.ok(s.ease < 2.5);
  assert.equal(review(s, GOOD, s.due).interval, 1);
});

test('hard grows slowly, never below a day', () => {
  let s = review(newState(), GOOD, T0);
  s = review(s, HARD, s.due);
  assert.equal(s.interval, 1.2);
});

test('stages and "I know this"', () => {
  assert.equal(stage(undefined), 'new');
  assert.equal(stage(review(newState(), GOOD, T0)), 'learning');
  const k = markKnown(undefined, T0);
  assert.equal(stage(k), 'known');
  assert.equal(k.due, T0 + 21 * DAY);
});

test('interval preview text', () => {
  const s = review(newState(), GOOD, T0);
  assert.equal(previewInterval(s, AGAIN, s.due), '10 min');
  assert.equal(previewInterval(newState(), GOOD, T0), '1 day');
});

test('streak counts consecutive days and resets after an uncovered gap', () => {
  let s = newStreak();
  s = recordSession(s, '2026-11-01');
  s = recordSession(s, '2026-11-01');
  s = recordSession(s, '2026-11-02');
  assert.equal(s.current, 2);
  s = recordSession(s, '2026-11-05');
  assert.equal(s.current, 1);
  assert.equal(s.best, 2);
});

test('a freeze is earned every 7 days and covers a missed day', () => {
  let s = newStreak();
  for (let i = 0; i < 7; i++) s = recordSession(s, addDays('2026-11-01', i));
  assert.equal(s.current, 7);
  assert.equal(s.freezes, 1);
  assert.equal(displayStreak(s, '2026-11-09'), 7, 'one missed day is covered');
  assert.equal(displayStreak(s, '2026-11-10'), 0, 'two missed days are not');
  s = recordSession(s, '2026-11-09');
  assert.equal(s.current, 8);
  assert.equal(s.freezes, 0);
  assert.deepEqual(s.frozenDays, ['2026-11-08']);
});

test('date helpers handle month ends', () => {
  assert.equal(daysBetween('2026-10-31', '2026-11-01'), 1);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('answer checking: exact, accents, articles, alternatives', () => {
  assert.equal(checkAnswer('La cuenta', 'la cuenta'), 'right');
  assert.equal(checkAnswer('  la   cuenta. ', 'la cuenta'), 'right');
  assert.equal(checkAnswer('el menu', 'el menú'), 'accent');
  assert.equal(checkAnswer('cuenta', 'la cuenta'), 'article');
  assert.equal(checkAnswer('el cuenta', 'la cuenta'), 'article');
  assert.equal(checkAnswer('el teléfono', 'el móvil / el teléfono'), 'right');
  assert.equal(checkAnswer('ano', 'año'), 'wrong', 'ñ is a different letter');
  assert.equal(checkAnswer('', 'hola'), 'wrong');
  assert.equal(checkAnswer('¿Cómo estás?', 'cómo estás'), 'right');
});

const words = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `food:w${i}`, topic: 'food', rank: i })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: `construction:w${i}`, topic: 'construction', rank: i })),
];

test('new words come ~70% from focus topics, in frequency order', () => {
  const picked = pickNew(words, 10, ['construction']);
  assert.equal(picked.filter((w) => w.topic === 'construction').length, 7);
  assert.equal(picked[0].id, 'construction:w0');
});

test('session: reviews first; new words dropped when reviews pile up', () => {
  const cards = {};
  for (const w of words.slice(0, 5)) cards[w.id] = { ...review(newState(), GOOD, T0 - 3 * DAY) };
  const s = buildSession(words, cards, { minutes: 15, focus: [], now: T0 });
  assert.equal(s.reviews.length, 5);
  assert.equal(s.fresh.length, 6);

  const many = Array.from({ length: 300 }, (_, i) => ({ id: `x:${i}`, topic: 'x', rank: i }));
  const due = Object.fromEntries(many.map((w) => [w.id, review(newState(), GOOD, T0 - 5 * DAY)]));
  const s2 = buildSession(many, due, { minutes: 5, now: T0 });
  assert.equal(s2.reviews.length, 30);
  assert.equal(s2.fresh.length, 0);
});

test('five-minute sessions have no new words; topic sessions stay in the topic', () => {
  assert.equal(buildSession(words, {}, { minutes: 5, now: T0 }).fresh.length, 0);
  const t = buildSession(words, {}, { minutes: 15, topic: 'food', now: T0 });
  assert.ok(t.fresh.every((id) => id.startsWith('food:')));
});

test('slugs are stable ids', () => {
  assert.equal(slug('el año'), 'el-anyo');
  assert.equal(slug('¿Cómo estás?'), 'q-como-estas');
  assert.notEqual(slug('¿cuándo?'), slug('cuando'));
});

test('every wrong answer is counted, also on new words', async () => {
  const s = review(newState(), AGAIN, T0);
  assert.equal(s.wrong, 1);
  assert.equal(s.lapses, 0, 'a lapse needs a word you already knew');
  assert.equal(s.lastWrong, T0);
});

test('lenient points: accents and articles count as right', async () => {
  const { pointsFor } = await import('../js/check.js');
  assert.equal(pointsFor(checkAnswer('el menu', 'el menú')), 1);
  assert.equal(pointsFor(checkAnswer('cuenta', 'la cuenta')), 1);
  assert.equal(pointsFor(checkAnswer('cuenta', 'la cuenta'), { strictArticles: true }), 0.5);
  assert.equal(pointsFor(checkAnswer('pan', 'la cuenta')), 0);
});
