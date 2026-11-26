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
  return { topics, words, byId: new Map(words.map((w) => [w.id, w])) };
}
