// Regression tests for the fixes made in the review of 2026-11-27 (docs/reviews/REVIEW-2026-11-27.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkText } from '../js/validate.js';

const emptyContent = () => {
  const base = { topics: [], words: [], units: [], texts: [] };
  return { ...base, byId: new Map(), common: {}, base };
};

test('R1: a malformed AI text is dropped by validation instead of throwing', () => {
  assert.deepEqual(checkText({ id: 'x', title: 'x', level: 'A1', paragraphs: 'not a list', questions: [] }), ['no paragraphs']);
  assert.deepEqual(checkText({ id: 'x', title: 'x', level: 'A1', paragraphs: [[['Hola.', 'Hi.']]], questions: 'none' }), ['questions must be a list']);
});

test('R1: one broken content batch does not block sync and backups for ever', async () => {
  const { state } = await import('../js/state.js');
  const { syncNow } = await import('../js/sync.js');
  state.content = emptyContent();
  state.settings = { focus: [], minutes: 15, backend: { url: 'https://fake/exec', token: 't' } };
  state.sync = { lastSeq: 0, pending: {}, reports: [], user: 'owner', name: 'X' };
  const good = { title: 'Bien', level: 'A1', paragraphs: [[['Hola.', 'Hello.']]], questions: [] };
  const batches = [
    { seq: 1, kind: 'texts', meta: {}, items: [null, { title: 'x', level: 'A1', paragraphs: 'not a list', questions: [] }] },
    { seq: 2, kind: 'texts', meta: {}, items: [good] },
  ];
  const actions = [];
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    actions.push(body.action);
    const reply = body.action === 'content.since' ? { ok: true, batches: batches.filter((b) => b.seq > body.after), last: 2 }
      : body.action === 'backup.save' ? { ok: true, savedAt: 'now' } : { ok: true };
    return { ok: true, json: async () => reply };
  };
  const r = await syncNow({ forceBackup: true });
  assert.equal(state.sync.lastError, null);
  assert.equal(state.sync.lastSeq, 2);
  assert.equal(r.added, 1);
  assert.ok(actions.includes('backup.save'), 'the backup still runs');
  delete globalThis.fetch;
});
