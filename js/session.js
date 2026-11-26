/*
  Session builder: turns "I have N minutes" into a queue of cards.

  Rough timings: a review takes ~10 seconds, a new word ~35 seconds
  (introduction plus a check later in the same session).

  Rules:
  - Due reviews come first, most urgent first.
  - If there are far more reviews due than fit, no new words today:
    the rest wait for the next session, so a break never becomes a wall.
  - New words come ~70% from your focus topics, in frequency order.
*/

import { isDue, urgency, stage } from './srs.js';

const REVIEW_SEC = 10;
const NEW_SEC = 35;
export const NEW_PER_MINUTES = { 5: 0, 15: 6, 30: 10, 60: 15 };

/**
 * @param words   all words: [{id, topic, rank, ...}]
 * @param cards   map id → srs state
 * @param opts    { minutes, focus: [topicIds], topic?: id (study one topic), now, newLimit? }
 * @returns {{ reviews: string[], fresh: string[] }}  word ids
 */
export function buildSession(words, cards, opts) {
  const { minutes = 15, focus = [], topic = null, now = Date.now(), priority = [] } = opts;
  const pool = topic ? words.filter((w) => w.topic === topic) : words;
  const budget = minutes * 60;

  const due = pool
    .filter((w) => isDue(cards[w.id], now))
    .sort((a, b) => urgency(cards[b.id], now) - urgency(cards[a.id], now));

  const maxReviews = Math.floor(budget / REVIEW_SEC);
  const reviews = due.slice(0, maxReviews).map((w) => w.id);

  let newCount = opts.newLimit ?? (topic ? 8 : (NEW_PER_MINUTES[minutes] ?? Math.round(minutes / 4)));
  // Time left after reviews decides how many new words actually fit.
  const left = budget - reviews.length * REVIEW_SEC;
  newCount = Math.max(0, Math.min(newCount, Math.floor(left / NEW_SEC)));
  if (due.length > maxReviews * 1.5 && !topic) newCount = 0;

  const unseen = pool.filter((w) => stage(cards[w.id]) === 'new');
  const fresh = pickNew(unseen, newCount, topic ? [] : focus, priority);
  return { reviews, fresh: fresh.map((w) => w.id) };
}

/** ~70% from focus topics, the rest from everything else; frequency order inside each. */
export function pickNew(unseen, count, focus, priority = []) {
  if (count <= 0) return [];
  // Words you asked for (added while reading) come first, oldest request first.
  const asked = priority.map((id) => unseen.find((w) => w.id === id)).filter(Boolean).slice(0, count);
  if (asked.length) {
    const rest = unseen.filter((w) => !asked.includes(w));
    return [...asked, ...pickNew(rest, count - asked.length, focus)];
  }
  const byRank = (a, b) => a.rank - b.rank;
  if (!focus.length) return [...unseen].sort(byRank).slice(0, count);
  const inFocus = unseen.filter((w) => focus.includes(w.topic)).sort(byRank);
  const other = unseen.filter((w) => !focus.includes(w.topic)).sort(byRank);
  let nFocus = Math.min(inFocus.length, Math.round(count * 0.7));
  let nOther = Math.min(other.length, count - nFocus);
  nFocus = Math.min(inFocus.length, count - nOther);   // top up if one side runs short
  // Interleave so a session doesn't start with all focus words.
  const a = inFocus.slice(0, nFocus), b = other.slice(0, nOther), out = [];
  while (a.length || b.length) {
    if (a.length) out.push(a.shift());
    if (a.length) out.push(a.shift());
    if (b.length) out.push(b.shift());
  }
  return out;
}

/** Counts for a topic tile: new / learning / known. */
export function topicCounts(words, cards) {
  const c = { new: 0, learning: 0, known: 0, due: 0 };
  const now = Date.now();
  for (const w of words) {
    c[stage(cards[w.id])] += 1;
    if (isDue(cards[w.id], now)) c.due += 1;
  }
  return c;
}
