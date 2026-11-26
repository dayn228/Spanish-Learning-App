/*
  Spaced repetition: decides when you see each word again.

  Every word you have started has a state:
    reps      correct answers in a row
    interval  days until the next review
    ease      how fast the interval grows (starts at 2.5, rises when you find a
              word easy, falls when you miss it)
    due       timestamp when it is next due
    lapses    how many times you have forgotten a word you already knew
    wrong     every wrong answer, including while still learning it
    lastWrong when you last got it wrong
    seen      total answers

  Grades:
    0 again  wrong, or "show me again"
    1 hard   right, but slow or with a small mistake (an accent)
    2 good   right
    3 easy   right and instant

  Progress is proportional to accuracy: each correct answer multiplies the
  interval by `ease`, and `ease` itself grows when you keep getting it right,
  so words you know race ahead (1 → 3 → 8 → 20 → 50 days) while missed words
  come back within minutes.
*/

import { DAY_MS } from './dates.js';

export const AGAIN = 0, HARD = 1, GOOD = 2, EASY = 3;

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const RELEARN_MS = 10 * 60 * 1000;   // a missed word returns in 10 minutes
const KNOWN_DAYS = 21;               // "I know this" / counts as known

export function newState() {
  return { reps: 0, interval: 0, ease: 2.5, due: 0, lapses: 0, seen: 0, wrong: 0, lastWrong: 0 };
}

/** Returns the new state after an answer. Does not change the input. */
export function review(state, grade, now = Date.now()) {
  const s = { ...(state || newState()) };
  s.seen += 1;

  if (grade === AGAIN) {
    if (s.reps > 0) s.lapses += 1;
    s.wrong = (s.wrong || 0) + 1;
    s.lastWrong = now;
    s.reps = 0;
    s.ease = Math.max(MIN_EASE, s.ease - 0.2);
    s.interval = 0;
    s.due = now + RELEARN_MS;
    return s;
  }

  if (s.reps === 0) {
    // First correct answer (new word, or relearning after a miss).
    s.interval = grade === EASY ? 4 : grade === GOOD ? 1 : 0.5;
    if (s.lapses > 0 && grade !== EASY) s.interval = 1;
  } else if (grade === HARD) {
    s.interval = Math.max(1, s.interval * 1.2);
    s.ease = Math.max(MIN_EASE, s.ease - 0.15);
  } else if (grade === GOOD) {
    s.interval = Math.max(s.interval + 1, s.interval * s.ease);
  } else {
    s.interval = Math.max(s.interval + 2, s.interval * s.ease * 1.3);
    s.ease = Math.min(MAX_EASE, s.ease + 0.15);
  }

  s.reps += 1;
  s.interval = Math.round(s.interval * 10) / 10;
  s.due = now + s.interval * DAY_MS;
  return s;
}

/** "I already know this word": skip straight to a long interval. */
export function markKnown(state, now = Date.now()) {
  const s = { ...(state || newState()) };
  s.reps = Math.max(s.reps, 3);
  s.interval = Math.max(s.interval, KNOWN_DAYS);
  s.ease = Math.max(s.ease, 2.7);
  s.due = now + s.interval * DAY_MS;
  s.seen += 1;
  return s;
}

/** 'new' | 'learning' | 'known' — drives the dots and counts. */
export function stage(state) {
  if (!state || state.seen === 0) return 'new';
  return state.interval >= KNOWN_DAYS ? 'known' : 'learning';
}

export function isDue(state, now = Date.now()) {
  return !!state && state.seen > 0 && state.due <= now;
}

/**
 * How urgent a due word is. Words long overdue relative to their interval,
 * and words you have forgotten before, come first.
 */
export function urgency(state, now = Date.now()) {
  const overdueDays = (now - state.due) / DAY_MS;
  return overdueDays / Math.max(1, state.interval) + state.lapses * 0.5;
}

/** Text shown under a grade button, e.g. "10 min", "1 day", "8 days". */
export function previewInterval(state, grade, now = Date.now()) {
  const next = review(state, grade, now);
  const ms = next.due - now;
  if (ms < DAY_MS / 2 + 1) {
    const min = Math.round(ms / 60000);
    return min < 60 ? `${min} min` : `${Math.round(min / 60)} h`;
  }
  const days = Math.round(ms / DAY_MS);
  if (days < 31) return days === 1 ? '1 day' : `${days} days`;
  const months = Math.round(days / 30);
  return months === 1 ? '1 month' : `${months} months`;
}
