/*
  Content checks, shared by the build script (for the lists in data/) and the
  app (for AI-made content arriving from the backend). Anything that fails is
  dropped, so a bad generated item never reaches a study session.

  Each function returns a list of problems; an empty list means it is fine.
*/

import { conjugate } from './verbs.js';
import { normalise } from './check.js';

export const EXERCISE_TYPES = ['gap', 'choice', 'transform', 'error', 'translate', 'reorder', 'match', 'table'];

const str = (x) => typeof x === 'string' && x.trim().length > 0;

export function checkWord(w) {
  const p = [];
  if (!Array.isArray(w) || w.length < 2) return ['needs at least [spanish, english]'];
  if (!str(w[0]) || !str(w[1])) p.push('empty Spanish or English');
  if (w[2] && !str(w[3])) p.push(`"${w[0]}": example has no translation`);
  if (str(w[0]) && w[0].length > 60) p.push(`"${w[0].slice(0, 20)}…": too long for a word`);
  return p;
}

export function checkExercise(ex) {
  const p = [];
  if (!ex || !EXERCISE_TYPES.includes(ex.type)) return [`unknown type ${ex && ex.type}`];
  if (!Array.isArray(ex.tags) || !ex.tags.length) p.push('needs at least one tag');
  if (['gap', 'transform', 'error', 'translate', 'reorder'].includes(ex.type) && !str(ex.a)) p.push('missing answer "a"');
  if (['gap', 'choice', 'transform', 'error', 'translate'].includes(ex.type) && !str(ex.q)) p.push('missing question "q"');
  if (ex.type === 'gap' && str(ex.q) && (ex.q.match(/___/g) || []).length !== 1) p.push('gap sentence needs exactly one ___');
  if (ex.type === 'choice') {
    if (!Array.isArray(ex.options) || ex.options.length < 2 || !ex.options.every(str)) p.push('needs at least 2 options');
    else if (!(Number.isInteger(ex.a) && ex.a >= 0 && ex.a < ex.options.length)) p.push('answer index out of range');
    else if (new Set(ex.options.map(normalise)).size !== ex.options.length) p.push('duplicate options');
  }
  if (ex.type === 'error' && str(ex.q) && str(ex.a) && normalise(ex.q) === normalise(ex.a)) p.push('the "mistake" sentence is already correct');
  if (ex.type === 'reorder') {
    if (!Array.isArray(ex.words) || ex.words.length < 3) p.push('needs at least 3 words');
    else if (str(ex.a)) {
      const sorted = (s) => normalise(s).split(' ').sort().join(' ');
      if (sorted(ex.words.join(' ')) !== sorted(ex.a)) p.push("words don't make the answer");
    }
  }
  if (ex.type === 'match' && !(Array.isArray(ex.pairs) && ex.pairs.length >= 3 && ex.pairs.every((x) => Array.isArray(x) && str(x[0]) && str(x[1])))) p.push('needs at least 3 pairs');
  if (ex.type === 'table' && !conjugate(ex.verb, ex.tense || 'present')) p.push(`verb "${ex.verb}" can't be conjugated`);
  if (ex.tense && !['present', 'preterite', 'imperfect'].includes(ex.tense)) p.push(`unknown tense ${ex.tense}`);
  return p;
}

export function checkText(t, lookupMissing) {
  const p = [];
  for (const key of ['id', 'title', 'level', 'paragraphs', 'questions']) if (!t || !t[key]) p.push(`missing "${key}"`);
  if (p.length) return p;
  // Shape first: a malformed AI text must be dropped, not crash the caller (sync would retry it forever).
  if (!Array.isArray(t.paragraphs) || !t.paragraphs.length) return ['no paragraphs'];
  if (!Array.isArray(t.questions)) return ['questions must be a list'];
  t.paragraphs.forEach((para, i) => {
    if (!Array.isArray(para)) { p.push(`paragraph ${i + 1} is not a list`); return; }
    para.forEach((s, j) => { if (!Array.isArray(s) || !str(s[0]) || !str(s[1])) p.push(`paragraph ${i + 1} sentence ${j + 1}: needs [spanish, english]`); });
  });
  (t.questions || []).forEach((q, i) => {
    if (!q || !Array.isArray(q.options) || !(Number.isInteger(q.a) && q.a >= 0 && q.a < q.options.length)) p.push(`question ${i + 1}: answer index out of range`);
  });
  if (lookupMissing) {
    const missing = lookupMissing(t);
    if (missing.length) p.push(`no meaning for: ${missing.join(', ')}`);
  }
  return p;
}
