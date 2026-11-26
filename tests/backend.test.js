// Tests the backend's pure helpers by loading backend/src/Pure.gs into a sandbox.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../backend/src/Pure.gs', import.meta.url), 'utf8'), ctx);

test('parses RSS with CDATA and entities', () => {
  const xml = `<rss><channel><item><title><![CDATA[El BCE sube los tipos]]></title><link>https://ejemplo.es/a</link>
    <description>&lt;p&gt;La inflaci&oacute;n sigue alta&lt;/p&gt;</description></item>
    <item><title>Sin enlace</title></item></channel></rss>`;
  const items = ctx.parseFeed(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'El BCE sube los tipos');
  assert.equal(items[0].link, 'https://ejemplo.es/a');
  assert.equal(items[0].description, 'La inflación sigue alta');
});

test('parses Atom links', () => {
  const items = ctx.parseFeed('<feed><entry><title>Hola</title><link href="https://x.es/b"/><summary>Resumen</summary></entry></feed>');
  assert.equal(items[0].link, 'https://x.es/b');
});

test('extracts article paragraphs and skips boilerplate', () => {
  const long = 'El Gobierno aprobó ayer un plan para construir cien mil viviendas públicas en los próximos cinco años.';
  const html = `<html><nav><p>${long} menú</p></nav><script>var x='<p>no</p>'</script>
    <p>Corto.</p><p>${long}</p><p>Acepta las cookies para seguir leyendo este artículo en nuestra web hoy mismo.</p><p><b>Según</b> el ministerio, las obras empezarán en primavera en varias comunidades autónomas.</p></html>`;
  const p = ctx.extractParagraphs(html);
  assert.equal(p.length, 2);
  assert.equal(p[1], 'Según el ministerio, las obras empezarán en primavera en varias comunidades autónomas.');
});

test('splits sentences and trims to a word budget at sentence ends', () => {
  const s = ctx.splitSentences('Hola, ¿qué tal? Bien. El BCE sube los tipos. «Es necesario», dijo.');
  assert.equal(s.length, 4);
  const t = ctx.trimToWords(['Uno dos tres. Cuatro cinco seis.', 'Siete ocho nueve.'], 5);
  assert.equal(JSON.stringify(t), JSON.stringify(['Uno dos tres.']));
});

test('parses fenced JSON', () => {
  assert.equal(JSON.stringify(ctx.parseJsonLoose('```json\n{"a":1}\n```')), '{"a":1}');
});

test('cleans generated exercises and words', () => {
  const ex = ctx.cleanExercises([
    { type: 'gap', q: 'Yo ___ aquí', a: 'estoy', tags: ['estar-forms', 'made-up'] },
    { type: 'gap', q: 'no gap', a: 'x', tags: ['estar-forms'] },
    { type: 'table', verb: 'ser', tags: ['x'] },
  ], ['estar-forms']);
  assert.equal(ex.length, 1);
  assert.equal(JSON.stringify(ex[0].tags), '["estar-forms"]');
  const w = ctx.cleanWords([['el andamio', 'scaffolding', 'a', 'b'], ['La obra', 'site', 'a', 'b'], ['el andamio', 'dup', 'a', 'b']], ['la obra']);
  assert.equal(w.length, 1);
});

test('prompts carry the request details', () => {
  const p = ctx.exercisePrompt({ unitTitle: 'ser and estar', level: 'A1', n: 20, tags: ['ser', 'estar'], weakTags: ['estar'], vocabulary: ['la obra'], samples: [], avoid: [] });
  assert.match(p, /ser and estar/);
  assert.match(p, /keeps making mistakes.*estar/);
  assert.match(p, /Castilian/);
  assert.match(ctx.newsPrompt({ title: 'T', paragraphs: ['P1'] }, { level: 'A2' }), /EXACTLY as written/);
});
