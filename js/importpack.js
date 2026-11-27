/*
  Content packs made outside the app (ChatGPT etc., prompt in docs/prompts/chatgpt-content.md).
  checkPack() reads pasted text, keeps the items that pass the same checks as AI content,
  and explains what was dropped. The kept pack is sent to the backend (action content.add),
  which stores it as normal content batches, so it syncs to the phone(s) and survives resets.
*/
import { checkExercise, checkWord, checkText } from './validate.js';

/** Text pasted from a chat: strip ```json fences and anything before the first { or after the last }. */
export function parsePasted(text) {
  let s = String(text || '').replace(/^﻿/, '').trim();
  s = s.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('No JSON found. Paste the whole answer, starting with {.');
  try { return JSON.parse(s.slice(a, b + 1)); }
  catch (e) { throw new Error(`The JSON is broken (${e.message}). Ask ChatGPT to "fix the JSON and send it again".`); }
}

/**
 * @param pack parsed JSON
 * @param units the app's grammar units (ids that exercises may use)
 * @returns { pack, counts: {exercises, words, texts}, problems: [string] }
 */
export function checkPack(pack, units) {
  const problems = [];
  if (!pack || typeof pack !== 'object') throw new Error('That is not a content pack.');
  if (!/^mi-espanol-content/.test(String(pack.format || ''))) problems.push('No "format": "mi-espanol-content-1" line; reading it anyway.');
  const unitIds = new Set(units.map((u) => u.id));

  const exercises = [];
  (pack.exercises || []).forEach((ex, i) => {
    const where = `Exercise ${i + 1}`;
    if (!ex || !unitIds.has(ex.unit)) { problems.push(`${where}: unknown unit "${ex && ex.unit}"`); return; }
    if (!Array.isArray(ex.tags) || !ex.tags.length) ex.tags = ['imported'];
    const p = checkExercise(ex);
    if (p.length) problems.push(`${where} (${ex.unit}): ${p[0]}`);
    else exercises.push(ex);
  });

  const words = [];
  (pack.words || []).forEach((g, i) => {
    if (!g || !g.topic || !Array.isArray(g.words)) { problems.push(`Word group ${i + 1}: needs "topic" and "words"`); return; }
    const ok = g.words.filter((w, j) => {
      const p = checkWord(w);
      if (p.length) problems.push(`${g.topic} word ${j + 1}: ${p[0]}`);
      return !p.length;
    });
    if (ok.length) words.push({ topic: String(g.topic).toLowerCase(), name: g.name || g.topic, words: ok });
  });

  const texts = [];
  (pack.texts || []).forEach((t, i) => {
    const p = checkText({ id: 'check', questions: [], ...t });
    if (p.length) problems.push(`Text ${i + 1} (${(t && t.title) || 'no title'}): ${p[0]}`);
    else texts.push({ questions: [], glossary: {}, ...t });
  });

  return {
    pack: { format: 'mi-espanol-content-1', exercises, words, texts },
    counts: { exercises: exercises.length, words: words.reduce((n, g) => n + g.words.length, 0), texts: texts.length },
    problems,
  };
}
