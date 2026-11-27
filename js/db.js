/*
  Storage on the phone (IndexedDB), as a tiny key-value store.

  Keys used by the app (see docs/ARCHITECTURE.md for what each holds):
    cards, streak, settings, log, grammar, custom, reading, extra, sync

  If IndexedDB is unavailable (some private modes), it falls back to memory so the app
  still works for that visit. Any failure to save is recorded and announced with a
  'storage-problem' event, so the app can show a banner instead of losing progress quietly.
*/

const DB_NAME = 'mi-espanol';
const STORE = 'kv';
let dbPromise = null;
const memory = new Map();
let problem = null;

/** Why progress is not being saved on this phone, or null when all is well. */
export const storageProblem = () => problem;
function report(message) {
  if (problem) return;
  problem = message;
  try { window.dispatchEvent(new CustomEvent('storage-problem', { detail: message })); } catch { /* not in a browser */ }
}

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function get(key, fallback = null) {
  const db = await open();
  if (!db) return memory.has(key) ? memory.get(key) : fallback;
  return new Promise((resolve) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result === undefined ? fallback : req.result);
    req.onerror = () => resolve(fallback);
  });
}

export async function set(key, value) {
  const db = await open();
  if (!db) {
    memory.set(key, value);
    report('This phone can\'t store progress right now (private browsing or storage turned off). Progress lasts only until the app closes.');
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => { report(`Progress could not be saved on this phone (${(tx.error && tx.error.name) || 'storage error'}). Free some space, then keep studying; a Drive backup protects you.`); resolve(); };
    } catch (e) {
      report(`Progress could not be saved on this phone (${e.name || 'storage error'}).`);
      resolve();
    }
  });
}

/** Ask the browser to keep our data even when the phone is low on space. */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch { /* not supported */ }
  return false;
}
