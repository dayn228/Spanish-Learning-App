/*
  Builds listening sets from the words you have started.

  Item types:
    hear       the app says a word; pick it from four written options
    dictation  the app says an example sentence; type what you hear
    pair       a minimal pair (pero / perro): which one did you hear?

  Only words you have already met are used, so listening practises
  recognising known words by sound rather than guessing new ones.
*/

import { stage } from './srs.js';

/* Pairs that differ by one sound Spanish learners often mix up. */
export const MINIMAL_PAIRS = [
  ['pero', 'perro', 'but', 'dog'],
  ['caro', 'carro', 'expensive', 'cart'],
  ['cero', 'cerro', 'zero', 'hill'],
  ['para', 'parra', 'for', 'grapevine'],
  ['coro', 'corro', 'choir', 'I run'],
  ['moro', 'morro', 'Moor', 'snout'],
  ['casa', 'caza', 'house', 'hunting'],
  ['peso', 'beso', 'weight', 'kiss'],
  ['pala', 'bala', 'shovel', 'bullet'],
  ['año', 'ano', 'year', 'anus'],
  ['llama', 'lama', 'flame / calls', 'lama'],
  ['hielo', 'cielo', 'ice', 'sky'],
];

const shuffle = (a, rng) => a.map((x) => [rng(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

/** Words fit for listening: started ones first; if none yet, the first core words. */
export function listeningPool(words, cards) {
  const started = words.filter((w) => stage(cards[w.id]) !== 'new');
  return started.length >= 6 ? started : words.filter((w) => w.topic === 'basics' || w.topic === 'verbs').slice(0, 40);
}

export function buildListening(words, cards, n = 10, rng = Math.random) {
  const pool = shuffle(listeningPool(words, cards), rng);
  const items = [];
  const nPairs = n >= 8 ? 1 : 0;
  const nDict = Math.round((n - nPairs) * 0.4);
  const sentences = pool.filter((w) => w.ex && w.ex.split(/\s+/).length <= 9);

  for (const w of sentences.slice(0, nDict)) items.push({ type: 'dictation', say: w.ex, en: w.exEn, wordId: w.id, tags: ['dictation'] });
  const usedHear = new Set();
  for (const w of pool) {
    if (items.length >= n - nPairs) break;
    if (usedHear.has(w.es)) continue;
    const others = shuffle(pool.concat(words).filter((o) => o.es !== w.es && o.topic === w.topic), rng);
    const opts = [w.es];
    for (const o of others) { if (opts.length >= 4) break; if (!opts.includes(o.es)) opts.push(o.es); }
    if (opts.length < 3) continue;
    usedHear.add(w.es);
    items.push({ type: 'hear', say: w.es, options: opts, a: 0, en: w.en, wordId: w.id, tags: ['hear'] });
  }
  for (let i = 0; i < nPairs; i++) {
    const p = MINIMAL_PAIRS[Math.floor(rng() * MINIMAL_PAIRS.length)];
    const which = rng() < 0.5 ? 0 : 1;
    items.push({ type: 'hear', say: p[which], options: [p[0], p[1]], a: which, en: `${p[0]} = ${p[2]}, ${p[1]} = ${p[3]}`, tags: ['pairs'] });
  }
  return shuffle(items, rng);
}
