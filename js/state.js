/*
  App state in memory, saved to the phone after every change.
  Screens read `state` and call the functions here to change it.
*/

import * as db from './db.js';
import { review, markKnown } from './srs.js';
import { recordSession, newStreak } from './streak.js';
import { dayKey } from './dates.js';
import { newGrammarProgress } from './grammar.js';
import { applyCustom, slug } from './content.js';

export const state = {
  content: null,              // { topics, words, byId }
  cards: {},                  // word id → srs state
  streak: newStreak(),
  settings: { focus: ['construction'], minutes: 15 },
  log: {},                    // day key → answers that day
  grammar: newGrammarProgress(), // unit scores, weak forms, verb trainer stats
  custom: [],                 // words added while reading: { es, en, ex, exEn }
  reading: {},                // text id → { done, right, total, at }
};

const BACKUP_VERSION = 1;

export async function loadState() {
  state.cards = await db.get('cards', {});
  state.streak = await db.get('streak', newStreak());
  state.settings = { ...state.settings, ...(await db.get('settings', {})) };
  state.log = await db.get('log', {});
  state.grammar = { ...newGrammarProgress(), ...(await db.get('grammar', {})) };
  state.custom = await db.get('custom', []);
  state.reading = await db.get('reading', {});
}

export function answer(wordId, grade) {
  state.cards[wordId] = review(state.cards[wordId], grade);
  const today = dayKey();
  state.log[today] = (state.log[today] || 0) + 1;
  db.set('cards', state.cards);
  db.set('log', state.log);
}

export function knowIt(wordId) {
  state.cards[wordId] = markKnown(state.cards[wordId]);
  db.set('cards', state.cards);
}

/** Save grammar progress and count the answer for today's activity. */
export function saveGrammar(countAnswer = true) {
  if (countAnswer) {
    const today = dayKey();
    state.log[today] = (state.log[today] || 0) + 1;
    db.set('log', state.log);
  }
  db.set('grammar', state.grammar);
}

/** Call once when a session ends (any length). */
export function finishSession() {
  state.streak = recordSession(state.streak, dayKey());
  db.set('streak', state.streak);
}

export function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  db.set('settings', state.settings);
}

/* ---------- Words from reading ---------- */

/** Add a word to "My words" (or reuse a deck word) and put it first in line for learning. Returns its id. */
export function addWordToLearn({ es, en, ex, exEn, wordId }) {
  let id = wordId;
  if (!id) {
    if (!state.custom.some((c) => c.es.toLowerCase() === es.toLowerCase())) state.custom.push({ es, en, ex, exEn });
    db.set('custom', state.custom);
    applyCustom(state.content, state.custom);
    id = `mine:${slug(es)}`;
  }
  const next = (state.settings.next || []).filter((x) => x !== id);
  saveSettings({ next: [...next, id].slice(-100) });
  return id;
}

export function saveReading(textId, result) {
  state.reading[textId] = { ...(state.reading[textId] || {}), ...result, at: Date.now() };
  db.set('reading', state.reading);
}

/* ---------- Backup ---------- */

export function exportBackup() {
  return JSON.stringify({
    app: 'mi-espanol',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    cards: state.cards,
    streak: state.streak,
    settings: state.settings,
    log: state.log,
    grammar: state.grammar,
    custom: state.custom,
    reading: state.reading,
  });
}

/** Replaces all progress with the backup. Throws a readable error if the file is wrong. */
export async function importBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not a Mi Español backup.'); }
  if (data.app !== 'mi-espanol' || typeof data.cards !== 'object') throw new Error('This file is not a Mi Español backup.');
  state.cards = data.cards || {};
  state.streak = data.streak || newStreak();
  state.settings = { ...state.settings, ...(data.settings || {}) };
  state.log = data.log || {};
  state.grammar = { ...newGrammarProgress(), ...(data.grammar || {}) };
  state.custom = data.custom || [];
  state.reading = data.reading || {};
  if (state.content) applyCustom(state.content, state.custom);
  await Promise.all([
    db.set('cards', state.cards), db.set('streak', state.streak),
    db.set('settings', state.settings), db.set('log', state.log), db.set('grammar', state.grammar),
    db.set('custom', state.custom), db.set('reading', state.reading),
  ]);
}
