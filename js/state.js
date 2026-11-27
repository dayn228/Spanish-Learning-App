/*
  App state in memory, saved to the phone after every change.
  Screens read `state` and call the functions here to change it.
*/

import * as db from './db.js';
import { review, markKnown } from './srs.js';
import { recordSession, newStreak } from './streak.js';
import { dayKey } from './dates.js';
import { newGrammarProgress } from './grammar.js';
import { rebuild, slug, emptyExtra } from './content.js';

export const state = {
  content: null,              // { topics, words, byId }
  cards: {},                  // word id → srs state
  streak: newStreak(),
  settings: { focus: ['construction'], minutes: 15 },
  log: {},                    // day key → answers that day
  grammar: newGrammarProgress(), // unit scores, weak forms, verb trainer stats
  custom: [],                 // words added while reading: { es, en, ex, exEn }
  reading: {},                // text id → { done, right, total, at }
  extra: emptyExtra(),        // AI-made words, exercises and texts from the backend
  sync: { lastSeq: 0, pending: {}, reports: [] },   // backend status (see sync.js)
};

/** Rebuild the live content after words, AI content or reports change. */
export function refreshContent() {
  if (state.content) rebuild(state.content, state.custom, state.extra);
}

const BACKUP_VERSION = 1;

export async function loadState() {
  state.cards = await db.get('cards', {});
  state.streak = await db.get('streak', newStreak());
  state.settings = { ...state.settings, ...(await db.get('settings', {})) };
  state.log = await db.get('log', {});
  state.grammar = { ...newGrammarProgress(), ...(await db.get('grammar', {})) };
  state.custom = await db.get('custom', []);
  state.reading = await db.get('reading', {});
  state.extra = { ...emptyExtra(), ...(await db.get('extra', {})) };
  state.sync = { lastSeq: 0, pending: {}, reports: [], ...(await db.get('sync', {})) };
}

export function saveExtra() { db.set('extra', state.extra); }
export function saveSync() { db.set('sync', state.sync); }

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

/** Things other modules want to run after a session (sync registers here, to avoid an import loop). */
export const hooks = { afterSession: null };

/** Call once when a session ends (any length). */
export function finishSession() {
  state.streak = recordSession(state.streak, dayKey());
  db.set('streak', state.streak);
  if (hooks.afterSession) hooks.afterSession();
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
    refreshContent();
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
    settings: withoutSecrets(state.settings),
    log: state.log,
    grammar: state.grammar,
    custom: state.custom,
    reading: state.reading,
  });
}

/** The backend URL and token never go into backups, so a shared backup file can't leak them. */
function withoutSecrets(settings) {
  const { backend, ...rest } = settings;
  return rest;
}

/** Replaces all progress with the backup. Throws a readable error if the file is wrong. */
export async function importBackup(text) {
  let data;
  const raw = String(text).replace(/^\uFEFF/, '').trim();
  try { data = JSON.parse(raw); } catch {
    throw new Error(`This file is not a Mi Español backup: it is not JSON (starts with "${raw.slice(0, 40)}").`);
  }
  // Drive backups wrap the progress: { savedAt, data: { app: 'mi-espanol', … } }.
  if (data && data.app !== 'mi-espanol' && data.data && data.data.app === 'mi-espanol') data = data.data;
  if (!data || data.app !== 'mi-espanol' || typeof data.cards !== 'object') {
    throw new Error(`This file is not a Mi Español backup (it has: ${Object.keys(data || {}).slice(0, 6).join(', ') || 'nothing'}).`);
  }
  state.cards = data.cards || {};
  state.streak = data.streak || newStreak();
  // Keep this phone's own backend connection; never take one from a file.
  state.settings = { ...state.settings, ...withoutSecrets(data.settings || {}), backend: state.settings.backend };
  state.log = data.log || {};
  state.grammar = { ...newGrammarProgress(), ...(data.grammar || {}) };
  state.custom = data.custom || [];
  state.reading = data.reading || {};
  refreshContent();
  await Promise.all([
    db.set('cards', state.cards), db.set('streak', state.streak),
    db.set('settings', state.settings), db.set('log', state.log), db.set('grammar', state.grammar),
    db.set('custom', state.custom), db.set('reading', state.reading),
  ]);
}
