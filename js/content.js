/*
  Loads the word lists from data/.

  data/index.json lists every topic file. Each topic file looks like:
    { "id": "food", "name": "Food and restaurant", "kind": "core" | "pack",
      "level": "A1", "words": [ ["el agua", "water", "Un vaso de agua, por favor.", "A glass of water, please.", "n"], ... ] }

  Word entry fields, in order: Spanish, English, example, example in English,
  part of speech (optional: n, v, adj, adv, phr, …). Order in the file =
  priority: the most useful words come first.

  A word's id is "<topic>:<slug of the Spanish>", so progress survives
  reordering the file. Changing a word's Spanish spelling resets its progress.
*/

import { exerciseId } from './grammar.js';

export function slug(s) {
  // Questions get a "q-" prefix so "¿cuándo?" and "cuando" stay different words.
  return (s.trim().startsWith('¿') ? 'q-' : '') + s.toLowerCase()
    .replace(/ñ/g, 'ny')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Turn a topic file into word objects. Pure, so the build script and tests use it too. */
export function parseTopic(file) {
  return file.words.map((w, i) => {
    const [es, en, ex = '', exEn = '', pos = ''] = w;
    return {
      id: `${file.id}:${slug(es)}`,
      topic: file.id,
      rank: i,
      es, en, ex, exEn, pos,
      level: file.level || 'A1',
    };
  });
}

export async function loadContent(base = 'data/') {
  const index = await (await fetch(base + 'index.json')).json();
  const topics = [];
  const words = [];
  const files = await Promise.all(index.topics.map((name) => fetch(base + name).then((r) => r.json())));
  for (const file of files) {
    const list = parseTopic(file);
    topics.push({ id: file.id, name: file.name, kind: file.kind, level: file.level, blurb: file.blurb || '', count: list.length });
    words.push(...list);
  }
  let units = [];
  try {
    const gIndex = await (await fetch(base + 'grammar/index.json')).json();
    units = await Promise.all(gIndex.units.map((name) => fetch(base + 'grammar/' + name).then((r) => r.json())));
  } catch { /* grammar not available: words still work */ }
  let texts = [], common = {};
  try {
    const rIndex = await (await fetch(base + 'reading/index.json')).json();
    common = (await (await fetch(base + 'reading/common.json')).json()).words;
    texts = await Promise.all(rIndex.texts.map((name) => fetch(base + 'reading/' + name).then((r) => r.json())));
  } catch { /* reading not available */ }
  const content = { topics, words, byId: new Map(words.map((w) => [w.id, w])), units, texts, common };
  content.base = { topics: [...topics], words: [...words], units, texts: [...texts] };
  return content;
}

export function emptyExtra() {
  return { words: {}, topicNames: {}, exercises: {}, texts: [], hidden: [], seqs: [] };
}

/**
  Build the live content from three layers:
    1. the built-in lists (content.base, never changed),
    2. AI-made additions from the backend (extra: words, exercises, texts),
    3. the learner's own words ("My words").
  Items the learner reported as wrong (extra.hidden) are left out.
  Safe to call again whenever a layer changes.
*/
export function rebuild(content, custom = [], extra = emptyExtra()) {
  const b = content.base;
  const hidden = new Set(extra.hidden || []);
  const topics = b.topics.map((t) => ({ ...t }));
  const words = [...b.words];
  const units = b.units.map((u) => ({ ...u, exercises: [...u.exercises] }));
  const texts = [...b.texts];

  for (const [topicId, list] of Object.entries(extra.words || {})) {
    let t = topics.find((x) => x.id === topicId);
    if (!t) {
      t = { id: topicId, name: (extra.topicNames || {})[topicId] || topicId, kind: 'pack', level: 'A2', blurb: 'Words added by AI as you learn.', count: 0 };
      topics.push(t);
    }
    const have = new Set(words.filter((w) => w.topic === topicId).map((w) => w.id));
    const start = have.size;
    parseTopic({ id: topicId, level: t.level, words: list }).forEach((w, i) => {
      if (have.has(w.id) || hidden.has(w.id)) return;
      have.add(w.id);
      words.push({ ...w, rank: start + i, aiMade: true });
    });
    t.count = have.size;
  }
  for (const [unitId, list] of Object.entries(extra.exercises || {})) {
    const u = units.find((x) => x.id === unitId);
    if (!u) continue;
    for (const ex of list) if (!hidden.has(exerciseId(unitId, ex))) u.exercises.push(ex);
  }
  for (const t of extra.texts || []) if (!hidden.has(t.id)) texts.push(t);

  if (custom.length) {
    const list = parseTopic({ id: 'mine', level: 'A1', words: custom.map((c) => [c.es, c.en, c.ex || '', c.exEn || '', c.pos || '']) });
    topics.push({ id: 'mine', name: 'My words', kind: 'mine', level: 'A1', blurb: 'Words you added while reading.', count: list.length });
    words.push(...list);
  }
  Object.assign(content, { topics, words, units, texts, byId: new Map(words.map((w) => [w.id, w])) });
}
