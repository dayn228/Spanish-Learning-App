/*
  Storage on the phone (IndexedDB), as a tiny key-value store.

  Keys used by the app:
    cards     map word id → spaced-repetition state
    streak    streak state
    settings  { focus: [topicIds], minutes, voice }
    log       map day key → number of answers that day

  If IndexedDB is unavailable (some private modes), it falls back to memory
  so the app still works for that visit.
*/

const DB_NAME = 'mi-espanol';
const STORE = 'kv';
let dbPromise = null;
const memory = new Map();

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
  if (!db) { memory.set(key, value); return; }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Ask the browser to keep our data even when the phone is low on space. */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch { /* not supported */ }
  return false;
}
