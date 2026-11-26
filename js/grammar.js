/*
  Grammar mastery: how far you are in each unit, and which exercises to give you next.

  Progress is proportional to accuracy:
    after each set, the unit's score (0–100) grows by 100 × accuracy² × (set size / 10).
    A perfect set of 10 masters a unit in one go; 90% takes two sets; 70% about three.
    Below 50% the score does not move, but the forms you missed get more practice.

  Each exercise has tags (for example "ser", "estar-location"). Wrong answers raise
  the weight of exercises with the same tags, so the next set leans on your mistakes.
  An exercise answered right twice in a row is "retired" and rarely shown again.

  Mastered units come back for short reviews; the gap between reviews grows
  each time you pass (7 → 18 → 45 days…).

  Answer points: 1 right, 0.5 almost (accent or article), 0 wrong.
*/

import { DAY_MS } from './dates.js';

export const MASTERED = 100;

export function newGrammarProgress() {
  return { units: {}, verbs: {} };
}

function unitProgress(progress, unitId) {
  return progress.units[unitId] || (progress.units[unitId] = { score: 0, sets: 0, forms: {}, seen: {}, mastered: false, reviewDue: 0, reviewDays: 0 });
}

/** A stable id for an exercise, from its unit and content. */
export function exerciseId(unitId, ex) {
  const text = [ex.type, ex.q, ex.verb, ex.a, (ex.words || []).join(' '), (ex.pairs || []).flat().join(' ')].join('|');
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${unitId}:${h.toString(36)}`;
}

/** Record one answer. */
export function recordAnswer(progress, unitId, ex, points) {
  const up = unitProgress(progress, unitId);
  const id = exerciseId(unitId, ex);
  const s = up.seen[id] || (up.seen[id] = { n: 0, streak: 0 });
  s.n += 1;
  s.streak = points >= 1 ? s.streak + 1 : 0;
  for (const tag of ex.tags || []) {
    const f = up.forms[tag] || (up.forms[tag] = { r: 0, w: 0 });
    if (points >= 1) f.r += 1; else f.w += 1;
  }
}

/** Finish a practice set: move the score in proportion to accuracy. Returns { accuracy, gain, mastered }. */
export function finishSet(progress, unitId, points, now = Date.now()) {
  const up = unitProgress(progress, unitId);
  const n = points.length;
  const accuracy = n ? points.reduce((a, b) => a + b, 0) / n : 0;
  const gain = accuracy >= 0.5 ? Math.round(100 * accuracy * accuracy * Math.min(1, n / 10)) : 0;
  const was = up.mastered;
  up.score = Math.min(MASTERED, up.score + gain);
  up.sets += 1;
  if (up.score >= MASTERED && !was) master(up, now);
  return { accuracy, gain, mastered: up.mastered, newlyMastered: up.mastered && !was };
}

/** Test-out: 90% or better masters the unit immediately. */
export function finishTestOut(progress, unitId, points, now = Date.now()) {
  const up = unitProgress(progress, unitId);
  const accuracy = points.reduce((a, b) => a + b, 0) / Math.max(1, points.length);
  if (accuracy >= 0.9) {
    up.score = MASTERED;
    if (!up.mastered) master(up, now);
    up.sets += 1;
    return { accuracy, passed: true };
  }
  const r = finishSet(progress, unitId, points, now);
  return { accuracy, passed: false, gain: r.gain };
}

/** Review of a mastered unit: pass → longer gap; struggle → back to practice. */
export function finishReview(progress, unitId, points, now = Date.now()) {
  const up = unitProgress(progress, unitId);
  const accuracy = points.reduce((a, b) => a + b, 0) / Math.max(1, points.length);
  if (accuracy >= 0.8) {
    up.reviewDays = Math.round(Math.max(7, up.reviewDays) * 2.5);
  } else if (accuracy >= 0.6) {
    up.reviewDays = Math.max(3, Math.round(up.reviewDays / 2));
  } else {
    up.mastered = false;
    up.score = 70;
    up.reviewDays = 0;
  }
  up.reviewDue = up.mastered ? now + up.reviewDays * DAY_MS : 0;
  return { accuracy, stillMastered: up.mastered };
}

function master(up, now) {
  up.mastered = true;
  up.reviewDays = 7;
  up.reviewDue = now + 7 * DAY_MS;
}

export function unitStatus(progress, unitId) {
  const up = progress.units[unitId];
  return up ? { score: up.score, mastered: up.mastered, sets: up.sets, reviewDue: up.reviewDue } : { score: 0, mastered: false, sets: 0, reviewDue: 0 };
}

/** Weight of an exercise: unseen and weak-tag exercises up, retired ones down. */
export function exerciseWeight(progress, unitId, ex) {
  const up = progress.units[unitId];
  if (!up) return 2;
  const s = up.seen[exerciseId(unitId, ex)];
  let w = s ? 1 : 2;
  let weak = 0;
  for (const tag of ex.tags || []) {
    const f = up.forms[tag];
    if (f) weak = Math.max(weak, f.w / (f.r + f.w + 1));
  }
  w += weak * 6;
  if (s && s.streak >= 2) w *= 0.15;
  return w;
}

/** Choose n exercises by weight, without repeats. `rng` is injectable for tests. */
export function pickExercises(progress, unit, n, rng = Math.random) {
  const pool = unit.exercises.map((ex) => ({ ex, w: exerciseWeight(progress, unit.id, ex) }));
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, p) => a + p.w, 0);
    let r = rng() * total, i = 0;
    while (i < pool.length - 1 && r >= pool[i].w) { r -= pool[i].w; i++; }
    out.push(pool.splice(i, 1)[0].ex);
  }
  return out;
}

/** Test-out: one exercise per tag first (so every form is checked), then fill up to n. */
export function pickTestOut(unit, n = 12, rng = Math.random) {
  const shuffled = [...unit.exercises].map((e) => [rng(), e]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  const out = [], tags = new Set();
  for (const ex of shuffled) {
    if (out.length >= n) break;
    if ((ex.tags || []).some((t) => !tags.has(t))) { out.push(ex); (ex.tags || []).forEach((t) => tags.add(t)); }
  }
  for (const ex of shuffled) { if (out.length >= n) break; if (!out.includes(ex)) out.push(ex); }
  return out;
}

/** The unit to work on next: the first one not mastered. */
export function recommendedUnit(units, progress) {
  return units.find((u) => !unitStatus(progress, u.id).mastered) || null;
}

export function unitsDueForReview(units, progress, now = Date.now()) {
  return units.filter((u) => { const s = unitStatus(progress, u.id); return s.mastered && s.reviewDue && s.reviewDue <= now; });
}

/* ---------- Verb trainer ---------- */

/** key: "verb|tense|person" */
export function recordVerb(progress, key, points) {
  const v = progress.verbs[key] || (progress.verbs[key] = { r: 0, w: 0, streak: 0 });
  if (points >= 1) { v.r += 1; v.streak += 1; } else { v.w += 1; v.streak = 0; }
}

/**
 * Pick verb + person items for the trainer. Common verbs (earlier in the list)
 * come first; missed forms come back more; forms right 4 times in a row retire.
 */
export function pickVerbItems(progress, verbs, tenses, n, rng = Math.random) {
  const pool = [];
  verbs.forEach((inf, rank) => {
    for (const tense of tenses) for (let p = 0; p < 6; p++) {
      const key = `${inf}|${tense}|${p}`;
      const v = progress.verbs[key];
      let w = 1 + Math.max(0, 1 - rank / 30);
      if (!v) w += 0.5;
      else {
        w += 4 * (v.w + 0.5) / (v.r + v.w + 1) - 0.5;
        if (v.streak >= 4) w *= 0.1;
      }
      pool.push({ key, inf, tense, person: p, w: Math.max(0.05, w) });
    }
  });
  const out = [];
  const usedVerb = new Set();
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, x) => a + x.w, 0);
    let r = rng() * total, i = 0;
    while (i < pool.length - 1 && r >= pool[i].w) { r -= pool[i].w; i++; }
    const item = pool.splice(i, 1)[0];
    if (usedVerb.has(item.inf) && pool.some((x) => !usedVerb.has(x.inf))) continue;   // vary the verbs
    usedVerb.add(item.inf);
    out.push(item);
  }
  return out;
}
