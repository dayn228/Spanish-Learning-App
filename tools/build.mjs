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
import { conjugate } from '../js/verbs.js';
import { normalise } from '../js/check.js';
import { exerciseId } from '../js/grammar.js';
import { deckIndex, lookup, textWords } from '../js/reading.js';
import { checkWord, checkExercise, checkText } from '../js/validate.js';

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
  file.words.forEach((w, i) => { for (const msg of checkWord(w)) problems.push(`${f} word ${i + 1}: ${msg}`); });
  for (const word of parseTopic(file)) {
    if (allIds.has(word.id)) problems.push(`${f}: duplicate word "${word.es}"`);
    allIds.add(word.id);
  }
  wordCount += file.words.length;
  topics.push({ file: f, id: file.id });
}
topics.sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));

// ---- 1b. Check grammar units ----
const unitFiles = readdirSync(join(root, 'data/grammar')).filter((f) => /^u\d+\.json$/.test(f)).sort();
let exerciseCount = 0;
for (const f of unitFiles) {
  let u;
  try { u = JSON.parse(readFileSync(join(root, 'data/grammar', f), 'utf8')); } catch (e) { problems.push(`grammar/${f}: not valid JSON (${e.message})`); continue; }
  for (const key of ['id', 'n', 'title', 'explain', 'exercises']) if (u[key] === undefined) problems.push(`grammar/${f}: missing "${key}"`);
  const ids = new Set();
  (u.exercises || []).forEach((ex, i) => {
    const where = `grammar/${f} exercise ${i + 1} (${ex.type})`;
    for (const msg of checkExercise(ex)) problems.push(`${where}: ${msg}`);
    const id = exerciseId(u.id, ex);
    if (ids.has(id)) problems.push(`${where}: duplicate exercise`);
    ids.add(id);
  });
  exerciseCount += (u.exercises || []).length;
}

// ---- 1c. Check reading texts: every word needs a meaning ----
const allWords = [];
for (const t of topics) allWords.push(...parseTopic(JSON.parse(readFileSync(join(root, 'data', t.file), 'utf8'))));
const idxAll = deckIndex(allWords);
const common = JSON.parse(readFileSync(join(root, 'data/reading/common.json'), 'utf8')).words;
const textFiles = readdirSync(join(root, 'data/reading')).filter((f) => /^t\d+\.json$/.test(f)).sort();
for (const f of textFiles) {
  let t;
  try { t = JSON.parse(readFileSync(join(root, 'data/reading', f), 'utf8')); } catch (e) { problems.push(`reading/${f}: not valid JSON (${e.message})`); continue; }
  for (const msg of checkText(t, (x) => textWords(x).filter((w) => !lookup(w, x, common, idxAll)))) problems.push(`reading/${f}: ${msg}`);
}

if (problems.length) {
  console.error('Content problems:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// ---- 2. data/index.json ----
writeFileSync(join(root, 'data/index.json'), JSON.stringify({ topics: topics.map((t) => t.file) }, null, 2) + '\n');
writeFileSync(join(root, 'data/grammar/index.json'), JSON.stringify({ units: unitFiles }, null, 2) + '\n');
writeFileSync(join(root, 'data/reading/index.json'), JSON.stringify({ texts: textFiles }, null, 2) + '\n');

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

console.log(`OK: ${topics.length} topics, ${wordCount} words, ${unitFiles.length} grammar units, ${exerciseCount} exercises, ${textFiles.length} texts, ${files.length} offline files, version ${version}`);
