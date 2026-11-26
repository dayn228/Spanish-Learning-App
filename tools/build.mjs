/*
  Build step. Run with: npm run build

  1. Checks every word list in data/ (shape, duplicates, empty fields).
  2. Writes data/index.json (the list of topic files the app loads).
  3. Writes the offline file list and a new VERSION into sw.js, so phones
     pick up the update.

  Exits with an error if a word list has a problem, so a broken list is
  never published.
*/

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { parseTopic } from '../js/content.js';

const root = new URL('..', import.meta.url).pathname;
const problems = [];

// ---- 1. Check word lists ----
const order = ['basics', 'verbs', 'connectors', 'people', 'time', 'food', 'home', 'travel', 'work', 'describing', 'shopping', 'health',
  'construction', 'finance', 'economics', 'politics', 'news'];
const topicFiles = [...readdirSync(join(root, 'data/core')).map((f) => 'core/' + f), ...readdirSync(join(root, 'data/packs')).map((f) => 'packs/' + f)]
  .filter((f) => f.endsWith('.json'));

const topics = [];
const allIds = new Set();
let wordCount = 0;
for (const f of topicFiles) {
  let file;
  try { file = JSON.parse(readFileSync(join(root, 'data', f), 'utf8')); } catch (e) { problems.push(`${f}: not valid JSON (${e.message})`); continue; }
  for (const key of ['id', 'name', 'kind', 'words']) if (!file[key]) problems.push(`${f}: missing "${key}"`);
  if (!['core', 'pack'].includes(file.kind)) problems.push(`${f}: kind must be "core" or "pack"`);
  file.words.forEach((w, i) => {
    if (!Array.isArray(w) || w.length < 2) problems.push(`${f} word ${i + 1}: needs at least [spanish, english]`);
    else if (!w[0].trim() || !w[1].trim()) problems.push(`${f} word ${i + 1}: empty Spanish or English`);
    else if (w[2] && !w[3]) problems.push(`${f} "${w[0]}": example has no translation`);
  });
  for (const word of parseTopic(file)) {
    if (allIds.has(word.id)) problems.push(`${f}: duplicate word "${word.es}"`);
    allIds.add(word.id);
  }
  wordCount += file.words.length;
  topics.push({ file: f, id: file.id });
}
topics.sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));

if (problems.length) {
  console.error('Word list problems:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// ---- 2. data/index.json ----
writeFileSync(join(root, 'data/index.json'), JSON.stringify({ topics: topics.map((t) => t.file) }, null, 2) + '\n');

// ---- 3. Offline file list + version in sw.js ----
const include = ['index.html', 'manifest.webmanifest', 'css', 'js', 'fonts', 'icons', 'data'];
const files = [];
const walk = (p) => {
  if (statSync(p).isDirectory()) readdirSync(p).forEach((c) => walk(join(p, c)));
  else if (!/LICENSE|\.md$/.test(p)) files.push(relative(root, p));
};
include.forEach((p) => walk(join(root, p)));
files.sort();

const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(root, f)));
const version = hash.digest('hex').slice(0, 10);

const swPath = join(root, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
sw = sw.replace(/const VERSION = .*;/, `const VERSION = '${version}';`);
sw = sw.replace(/const FILES = [\s\S]*?\];/, `const FILES = ${JSON.stringify(['./', ...files.map((f) => './' + f)], null, 2)};`);
writeFileSync(swPath, sw);

console.log(`OK: ${topics.length} topics, ${wordCount} words, ${files.length} offline files, version ${version}`);
