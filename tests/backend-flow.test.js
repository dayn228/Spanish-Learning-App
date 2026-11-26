// Runs the whole backend in Node against fake Google services (Drive, properties,
// UrlFetch with a canned Gemini), to check the request flow end to end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

function makeBackend(geminiReplies, fetchPages = {}) {
  const props = new Map();
  const files = new Map();   // "folderId/name" → text
  let folderSeq = 0;
  const folder = (id, name) => ({
    getId: () => id, getUrl: () => 'https://drive/' + id,
    getFoldersByName: (n) => { const key = id + '/' + n + '/'; const exists = [...files.keys()].some((k) => k === key + '.dir'); return iter(exists ? [folder(id + '-' + n, n)] : []); },
    createFolder: (n) => { files.set(id + '/' + n + '/.dir', ''); return folder(id + '-' + n, n); },
    getFilesByName: (n) => iter(files.has(id + '/' + n) ? [file(id, n)] : []),
    getFiles: () => iter([...files.keys()].filter((k) => k.startsWith(id + '/') && !k.endsWith('.dir') && k.split('/').length === 2).map((k) => file(id, k.split('/')[1]))),
    createFile: (n, text) => { files.set(id + '/' + n, text); return file(id, n); },
  });
  const file = (fid, n) => ({
    getName: () => n, setContent: (t) => files.set(fid + '/' + n, t), setTrashed: () => files.delete(fid + '/' + n),
    getBlob: () => ({ getDataAsString: () => files.get(fid + '/' + n) }), getLastUpdated: () => new Date(0),
  });
  const iter = (list) => { let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; };
  const calls = [];
  const ctx = {
    console: { log() {}, error() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => props.set(k, v) }) },
    DriveApp: { getFolderById: (id) => folder(id), createFolder: () => { folderSeq++; return folder('root' + folderSeq); } },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => ({ text: t }) }) },
    Utilities: { getUuid: () => 'aaaa-bbbb' },
    UrlFetchApp: {
      fetch: (url, opts) => {
        calls.push(url);
        if (url.includes('generativelanguage')) {
          const reply = geminiReplies.shift();
          if (reply === 429) return { getResponseCode: () => 429, getContentText: () => '' };
          return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }) };
        }
        const page = fetchPages[url];
        return { getResponseCode: () => (page ? 200 : 404), getContentText: () => page || '' };
      },
    },
  };
  vm.createContext(ctx);
  const dir = new URL('../backend/src/', import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.gs'))) vm.runInContext(readFileSync(new URL(f, dir), 'utf8'), ctx, { filename: f });
  props.set('APP_TOKEN', 'secret');
  props.set('GEMINI_API_KEY', 'k');
  const post = (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text);
  return { post, props, calls, ctx };
}

test('token is required', () => {
  const b = makeBackend([]);
  assert.equal(b.post({ action: 'ping' }).ok, false);
  assert.equal(b.post({ token: 'secret', action: 'ping' }).ok, true);
});

test('backup round trip', () => {
  const b = makeBackend([]);
  assert.equal(b.post({ token: 'secret', action: 'backup.save', data: { nope: 1 } }).ok, false);
  const s = b.post({ token: 'secret', action: 'backup.save', data: { app: 'mi-espanol', cards: { a: 1 } } });
  assert.ok(s.savedAt);
  const l = b.post({ token: 'secret', action: 'backup.load' });
  assert.deepEqual(l.data.cards, { a: 1 });
});

test('queue → nightly → content.since', () => {
  const exercises = { exercises: [
    { type: 'gap', q: 'Yo ___ en casa.', a: 'estoy', tags: ['estar-forms'] },
    { type: 'choice', q: 'Él ___ médico.', options: ['es', 'está'], a: 0, tags: ['ser-job'] },
    { type: 'gap', q: 'Sin hueco', a: 'x', tags: ['estar-forms'] },
  ] };
  const verdicts = { verdicts: [{ i: 0, ok: true }, { i: 1, ok: false, reason: 'ambiguous' }] };
  const words = { words: [['el andamio', 'scaffolding', 'El andamio está montado.', 'The scaffolding is up.', 'n'], ['la obra', 'site', 'a', 'b', 'n']] };
  const wordVerdicts = { verdicts: [{ i: 0, ok: true }] };
  const b = makeBackend([exercises, verdicts, words, wordVerdicts]);
  const q = b.post({ token: 'secret', action: 'queue.add', requests: [
    { key: 'exercises:u01', kind: 'exercises', unitId: 'u01', unitTitle: 'ser and estar', level: 'A1', n: 20, tags: ['estar-forms', 'ser-job'] },
    { key: 'words:construction', kind: 'words', topicId: 'construction', topicName: 'Construction', level: 'A2', n: 30, existing: ['la obra'] },
    { key: 'words:construction', kind: 'words' },
  ] });
  assert.equal(q.queued, 2, 'duplicate key ignored');
  const run = b.post({ token: 'secret', action: 'nightly.run' });
  assert.equal(run.made, 2, JSON.stringify(run));
  const c = b.post({ token: 'secret', action: 'content.since', after: 0 });
  assert.equal(c.last, 2);
  assert.equal(c.batches[0].kind, 'exercises');
  assert.equal(c.batches[0].items.length, 1, 'only the reviewed exercise');
  assert.equal(c.batches[1].items[0][0], 'el andamio');
  assert.equal(b.post({ token: 'secret', action: 'content.since', after: 2 }).batches.length, 0);
  assert.equal(b.post({ token: 'secret', action: 'status' }).queue, 0);
});

test('free-tier limit stops the run and keeps the queue', () => {
  const b = makeBackend([429]);
  b.post({ token: 'secret', action: 'queue.add', requests: [{ key: 'exercises:u02', kind: 'exercises', unitTitle: 'x', tags: ['a'] }] });
  const run = b.post({ token: 'secret', action: 'nightly.run' });
  assert.equal(run.made, 0);
  assert.match(run.log.join(' '), /limit/);
  assert.equal(b.post({ token: 'secret', action: 'status' }).queue, 1);
});

test('news: feed → article → prepared text', () => {
  const feed = '<rss><item><title>El BCE mantiene los tipos</title><link>https://elpais.com/a1</link><description>Resumen corto.</description></item></rss>';
  const article = '<p>El Banco Central Europeo ha decidido mantener los tipos de interés sin cambios en su reunión de este jueves.</p><p>La presidenta explicó que la inflación sigue bajando, aunque más despacio de lo previsto por los analistas.</p>';
  const prepared = { title: 'El BCE mantiene los tipos', en: 'The ECB holds rates', level: 'B1', paragraphs: [[['El Banco Central Europeo ha decidido mantener los tipos.', 'The ECB has decided to hold rates.']]], glossary: {}, questions: [{ q: '¿Qué hace el BCE?', options: ['Mantiene los tipos', 'Sube los tipos'], a: 0 }] };
  const b = makeBackend([prepared], { 'https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.elpais.com/portada': feed, 'https://elpais.com/a1': article });
  b.post({ token: 'secret', action: 'queue.add', requests: [{ key: 'news', kind: 'news', topics: ['finance'], level: 'A2', n: 1 }] });
  const run = b.post({ token: 'secret', action: 'nightly.run' });
  assert.equal(run.made, 1, run.log.join(' | '));
  const c = b.post({ token: 'secret', action: 'content.since', after: 0 });
  assert.equal(c.batches[0].items[0].source.url, 'https://elpais.com/a1');
});
