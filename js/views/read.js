// Read: the list of texts, with level and how many of their words you already know.

import { state } from '../state.js';
import { h, plural } from '../ui.js';
import { deckIndex, knownShare, textWords } from '../reading.js';

const TOPIC_NAMES = { construction: 'Construction', finance: 'Finance', economics: 'Economics', politics: 'Politics', news: 'News', life: 'Daily life' };

export function readView() {
  const { texts, common, words } = state.content;
  const idx = deckIndex(words);
  const rows = texts.map((t) => ({
    t,
    share: knownShare(t, common, idx, state.cards),
    minutes: Math.max(1, Math.round(textWords(t).length / 40)),
    r: state.reading[t.id],
  }));
  // Unread first, easiest (most words known) first; read ones at the end.
  rows.sort((a, b) => (a.r?.done ? 1 : 0) - (b.r?.done ? 1 : 0) || b.share - a.share);

  return h('div', {},
    h('h1', {}, 'Read'),
    h('p', { class: 'lead' }, 'Short texts on your topics. Tap any word for its meaning; press and hold a sentence for its translation.'),
    h('div', { style: { marginTop: '20px' } }, rows.map(({ t, share, minutes, r }) => h('a', { href: `#text/${t.id}`, class: 'card text-card' },
      h('div', { class: 'row between', style: { alignItems: 'flex-start' } },
        h('div', { class: 'grow' },
          h('h2', { lang: 'es' }, t.title),
          h('p', { class: 'small muted', style: { marginTop: '2px' } }, t.en)),
        h('span', { class: 'level-pill' }, t.level)),
      h('div', { class: 'bar thin', style: { marginTop: '14px' } }, h('i', { style: { width: `${Math.round(share * 100)}%` } })),
      h('div', { class: 'row between small muted', style: { marginTop: '8px' } },
        h('span', {}, `${Math.round(share * 100)}% of words known · ${TOPIC_NAMES[t.topic] || t.topic} · ${plural(minutes, 'min', 'min')}`),
        r?.done ? h('span', { class: 'state-pill' }, `Read · ${r.right}/${r.total}`) : null)))),
    h('p', { class: 'tiny muted', style: { marginTop: '16px' } },
      'News-style texts here are written for practice and are not real reports. Real articles arrive with the overnight news job in phase 4.'),
  );
}
