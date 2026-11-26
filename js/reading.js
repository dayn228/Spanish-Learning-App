/*
  Reading helpers: split text into words and look each one up.

  Lookup order for a word in a text:
    1. the text's own glossary (meaning in this context, e.g. "subió" → subir, "rose")
    2. data/reading/common.json (everyday words shared by all texts)
    3. your word lists (exact form, without the article: "obra" → "la obra")

  Every result: { base, en, wordId? } — wordId links to a deck word, which
  decides highlighting (known / learning / new) and the "Add to my words" button.
*/

import { stage } from './srs.js';

const ARTICLE = /^(el|la|los|las|un|una|unos|unas)\s+/;

export function tokenize(sentence) {
  // Words (letters incl. accents) and everything else, kept in order.
  return sentence.split(/([\p{L}]+)/u).filter((p) => p !== '').map((p) => ({ text: p, word: /^\p{L}+$/u.test(p) }));
}

/** Index of deck words by their bare form: "la obra" → "obra". */
export function deckIndex(words) {
  const idx = new Map();
  for (const w of words) {
    const bare = w.es.toLowerCase().replace(ARTICLE, '').replace(/[¿?¡!…]/g, '').trim();
    if (!idx.has(bare)) idx.set(bare, w);
  }
  return idx;
}

export function lookup(token, text, common, idx) {
  const t = token.toLowerCase();
  const g = text.glossary && text.glossary[t];
  const c = common[t];
  const entry = g || c;
  // Link to a deck word through the dictionary form, or the word itself.
  const base = entry ? entry[0] : t;
  const deck = idx.get(base.toLowerCase().replace(ARTICLE, '')) || idx.get(t);
  if (entry) return { base: entry[0], en: entry[1], note: entry[2] || '', wordId: deck ? deck.id : null, deckEs: deck ? deck.es : null };
  if (deck) return { base: deck.es, en: deck.en, note: '', wordId: deck.id, deckEs: deck.es };
  return null;
}

/** All distinct words in a text (lower case). */
export function textWords(text) {
  const out = new Set();
  for (const p of text.paragraphs) for (const [es] of p) for (const t of tokenize(es)) if (t.word) out.add(t.text.toLowerCase());
  return [...out];
}

/** Share of the text's content words (deck-linked) that you know or are learning. */
export function knownShare(text, common, idx, cards) {
  let total = 0, known = 0;
  for (const w of textWords(text)) {
    if (common[w]) continue;                       // everyday function words don't count
    const r = lookup(w, text, common, idx);
    total += 1;
    if (r && r.wordId && stage(cards[r.wordId]) !== 'new') known += 1;
  }
  return total ? known / total : 0;
}
