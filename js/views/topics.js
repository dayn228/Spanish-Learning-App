// Topics: every word topic as a tile with one dot per word.

import { state } from '../state.js';
import { h, dots } from '../ui.js';
import { topicCounts } from '../session.js';
import { stage } from '../srs.js';

let filter = 'all';
const FILTERS = [['all', 'All'], ['focus', 'Focus'], ['progress', 'In progress'], ['new', 'New']];

export function topicsView() {
  const { topics, words } = state.content;
  const focus = state.settings.focus;

  const rows = topics.map((t) => {
    const list = words.filter((w) => w.topic === t.id);
    return { t, list, c: topicCounts(list, state.cards) };
  }).filter(({ t, list, c }) => {
    if (filter === 'focus') return focus.includes(t.id);
    if (filter === 'progress') return c.learning + c.known > 0 && c.known < list.length;
    if (filter === 'new') return c.learning + c.known === 0;
    return true;
  });

  const root = h('div', {},
    h('h1', {}, 'Topics'),
    h('div', { class: 'chips', style: { marginTop: '16px' }, role: 'group', 'aria-label': 'Filter' },
      FILTERS.map(([id, label]) => h('button', {
        class: 'chip', 'aria-pressed': String(filter === id),
        onclick: () => { filter = id; root.replaceWith(topicsView()); },
      }, label))),
  );

  const grid = h('div', { class: 'topic-grid' });
  for (const { t, list, c } of rows) {
    const started = c.learning + c.known;
    grid.append(h('a', { class: 'topic-tile', href: `#topic/${t.id}`, style: { textDecoration: 'none' } },
      focus.includes(t.id) ? h('span', { class: 'focus-mark' }, 'Focus') : null,
      h('span', { class: 'name' }, t.name),
      dots(list.map((w) => stage(state.cards[w.id])), list.length > 40 ? 10 : 8),
      h('span', { class: 'meta' },
        h('span', {}, started ? `${c.known} of ${list.length} known` : `${list.length} new words`),
        c.due ? h('span', {}, `${c.due} due`) : null)));
  }
  if (!rows.length) grid.append(h('p', { class: 'muted', style: { gridColumn: '1 / -1' } }, 'No topics here yet.'));
  root.append(grid);
  return root;
}
