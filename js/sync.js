/*
  Talks to your Apps Script backend when the phone is online.

  One sync:
    1. sends refill requests for pools running low (js/refill.js) and any reports
    2. downloads new AI content and checks every item (js/validate.js) before
       adding it; broken items are dropped
    3. backs up your progress to Drive (at most every 2 hours, or after studying)

  Runs when the app opens, a few seconds after each finished session, and
  when the phone comes back online. Never blocks studying: offline, it simply
  waits for next time.
*/

import { state, saveExtra, saveSync, refreshContent, exportBackup, importBackup } from './state.js';
import { computeRequests, estimateLevel } from './refill.js';
import { checkExercise, checkWord, checkText } from './validate.js';
import { exerciseId } from './grammar.js';

const BACKUP_EVERY_MS = 2 * 60 * 60 * 1000;
let running = null;
let listeners = [];

export const isConnected = () => !!(state.settings.backend && state.settings.backend.url && state.settings.backend.token);
export function onSyncChange(fn) { listeners.push(fn); }
const notify = () => listeners.forEach((fn) => { try { fn(); } catch { /* screen gone */ } });

/* Most calls answer in seconds; the nightly job can take minutes. */
const TIMEOUT_MS = { 'nightly.run': 6 * 60 * 1000, default: 30 * 1000 };

export async function call(action, payload = {}, backend = state.settings.backend) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl && setTimeout(() => ctrl.abort(), TIMEOUT_MS[action] || TIMEOUT_MS.default);
  let res;
  try {
    res = await fetch(backend.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // "simple" request: no CORS preflight
      body: JSON.stringify({ token: backend.token, action, ...payload }),
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined,
    });
  } catch (e) {
    throw new Error(e && e.name === 'AbortError'
      ? 'The backend took too long to answer. It will try again later.'
      : 'Could not reach the backend (offline or blocked). It will try again later.');
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`The backend answered with an error (${res.status}). Check the URL ends in /exec.`);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error('The backend answered with a web page instead of data. Check the deployment is set to "Anyone" and the URL ends in /exec.');
  }
  if (!data.ok) throw new Error(data.error || 'The backend refused the request.');
  return data;
}

/** Check a URL and token before saving them. */
export async function testConnection(url, token) {
  return call('ping', {}, { url: url.trim(), token: token.trim() });
}

export function syncSoon(delay = 4000) {
  clearTimeout(syncSoon.t);
  syncSoon.t = setTimeout(() => syncNow().catch(() => {}), delay);
}

export async function syncNow({ forceBackup = false, overwrite = false } = {}) {
  if (!isConnected() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return null;
  if (running) return running;
  running = (async () => {
    const s = state.sync;
    const report = { sent: 0, added: 0, backedUp: false };
    const errors = [];
    const step = async (fn) => { try { await fn(); } catch (e) { errors.push(String(e.message || e)); } };
    try {
      // 0. Who am I on the backend (you, or someone added with addUser)?
      if (!s.user || !s.name) { const r = await call('ping'); s.user = r.user || 'owner'; s.name = r.name || ''; }

      // 1. Backup first: nothing else (a broken batch, a slow job) may stand in its way.
      await step(async () => {
        const studiedSince = Object.values(state.log).reduce((a, b) => a + b, 0) !== s.answersAtBackup;
        if (forceBackup || !s.lastBackup || (studiedSince && Date.now() - s.lastBackup > 60 * 1000) || Date.now() - s.lastBackup > BACKUP_EVERY_MS) {
          const r = await call('backup.save', { data: JSON.parse(exportBackup()), force: overwrite });
          if (r.held) {
            // Drive has much more progress than this phone: don't overwrite it, ask instead (You screen).
            s.held = { driveSavedAt: r.driveSavedAt, driveProgress: r.driveProgress, phoneProgress: r.phoneProgress };
          } else {
            s.held = null;
            s.lastBackup = Date.now();
            s.answersAtBackup = Object.values(state.log).reduce((a, b) => a + b, 0);
            report.backedUp = true;
          }
        }
      });

      // 2. Requests and reports.
      await step(async () => {
        const { content } = state;
        const level = estimateLevel(content.units, state.grammar);
        const requests = computeRequests({
          units: content.units, grammar: state.grammar, words: content.words, topics: content.topics, cards: state.cards,
          focus: state.settings.focus, texts: content.texts, reading: state.reading, pending: s.pending, level,
        });
        if (requests.length) {
          await call('queue.add', { requests });
          const now = Date.now();
          requests.forEach((r) => { s.pending[r.key] = now; });
          report.sent = requests.length;
        }
        while (s.reports.length) {
          await call('report', s.reports[0]);
          s.reports.shift();
        }
      });

      // 3. New content, page by page until we have caught up (a restored phone may need many).
      await step(async () => {
        for (let page = 0; page < 20; page++) {
          const r = await call('content.since', { after: s.lastSeq });
          for (const batch of r.batches) {
            // One broken batch must not block every later sync: skip it.
            try { report.added += mergeBatch(batch); } catch (e) { console.warn('Skipped a broken content batch', batch && batch.seq, e); }
            s.lastSeq = Math.max(s.lastSeq, Number(batch && batch.seq) || 0);
          }
          if (!r.batches.length || s.lastSeq >= r.last) break;
        }
      });
      if (report.added) { saveExtra(); refreshContent(); }

      s.lastSync = Date.now();
      s.lastError = errors.length ? errors[0] : null;
      s.lastAdded = report.added || s.lastAdded || 0;
    } catch (e) {
      s.lastError = String(e.message || e);
    } finally {
      saveSync();
      running = null;
      notify();
    }
    return report;
  })();
  return running;
}

/**
  Check a batch item by item and add what passes to state.extra.
  Returns how many items were added.
*/
export function mergeBatch(batch) {
  const extra = state.extra;
  if ((extra.seqs || []).includes(batch.seq)) return 0;
  let added = 0;
  // Exercises and texts were made for one learner's interests: skip the other learner's.
  const forOther = batch.meta && batch.meta.user && batch.meta.user !== 'inbox' && state.sync.user && batch.meta.user !== state.sync.user;
  if (forOther && (batch.kind === 'exercises' || batch.kind === 'texts')) { (extra.seqs || (extra.seqs = [])).push(batch.seq); return 0; }
  if (batch.kind === 'exercises') {
    const unitId = batch.meta && batch.meta.unitId;
    if (!state.content.units.some((u) => u.id === unitId)) return 0;
    const list = extra.exercises[unitId] || (extra.exercises[unitId] = []);
    for (const ex of batch.items || []) {
      if (checkExercise(ex).length) continue;
      list.push({ ...ex, aiMade: true, seq: batch.seq });
      added++;
    }
  } else if (batch.kind === 'words') {
    const topicId = batch.meta && batch.meta.topicId;
    if (!topicId) return 0;
    // Words for a topic only you or the other learner has: only the person who asked gets them.
    const known = state.content.base.topics.some((t) => t.id === topicId);
    if (!known && batch.meta.user && state.sync.user && batch.meta.user !== state.sync.user) return 0;
    if (batch.meta.topicName) extra.topicNames[topicId] = batch.meta.topicName;
    const list = extra.words[topicId] || (extra.words[topicId] = []);
    for (const w of batch.items || []) {
      if (checkWord(w).length) continue;
      list.push(w.slice(0, 5));
      added++;
    }
  } else if (batch.kind === 'texts') {
    (batch.items || []).forEach((t, i) => {
      if (!t || typeof t !== 'object') return;
      const text = { ...t, id: `ai${batch.seq}-${i}`, aiMade: true, topic: t.topic || (batch.meta && batch.meta.topic) || 'news', glossary: lowerKeys(t.glossary), questions: t.questions || [] };
      if (checkText(text).length) return;
      extra.texts.push(text);
      added++;
    });
  }
  extra.seqs = [...(extra.seqs || []), batch.seq].slice(-500);
  return added;
}

function lowerKeys(g) {
  const out = {};
  for (const [k, v] of Object.entries(g || {})) if (Array.isArray(v) && v[0] && v[1]) out[k.toLowerCase()] = v;
  return out;
}

/* ---------- Reports ("This looks wrong") ---------- */

/** Hide an AI item at once and send the report at the next sync. kind: 'exercise' | 'word' | 'text'. */
export function reportItem(kind, item, reason, unitId) {
  const id = kind === 'exercise' ? exerciseId(unitId, item) : item.id;
  state.extra.hidden = [...new Set([...(state.extra.hidden || []), id])];
  saveExtra();
  state.sync.reports.push({ item: { kind, id, unitId: unitId || null, content: kind === 'text' ? { title: item.title, source: item.source || null } : item }, reason });
  saveSync();
  refreshContent();
  syncSoon(1000);
}

/* ---------- Restore and on-demand content ---------- */

/** Restore the newest Drive backup, or a daily copy by file name (backup-2026-11-26.json). */
export async function restoreFromDrive(name) {
  const r = await call('backup.load', name ? { name } : {});
  if (!r.data) throw new Error('There is no backup in Drive yet.');
  await importBackup(JSON.stringify(r.data));
  state.sync.held = null;
  saveSync();
  return r.savedAt;
}

/** The backups in Drive, newest first: [{ name, savedAt, label }]. */
export async function listDriveBackups() {
  const r = await call('backup.list');
  return (r.backups || [])
    .filter((b) => b.name === 'latest.json' || /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(b.name))
    .map((b) => ({ ...b, label: b.name === 'latest.json' ? 'Newest' : new Date(b.name.slice(7, 17) + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) }));
}

/** Same measure as the backend: cards seen plus answers logged. */
export function progressOf(data) {
  if (!data) return 0;
  return Object.keys(data.cards || {}).length + Object.values(data.log || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

/** Overwrite Drive with this phone's progress (after the learner confirmed it). */
export async function keepPhoneProgress() {
  await syncNow({ forceBackup: true, overwrite: true });
}

/** Ask the backend to run the nightly job now, then download the result. */
export async function getContentNow() {
  await syncNow();                   // send the latest requests first
  const r = await call('nightly.run');
  await syncNow();
  return r;
}
