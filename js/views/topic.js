// One topic: progress, study button, focus switch and the full word list.

import { state, saveSettings } from '../state.js';
import { h, icon, ICONS, dots } from '../ui.js';
import { buildSession, topicCounts } from '../session.js';
import { stage } from '../srs.js';
import { speak } from '../speech.js';
import { startSession } from './study.js';

const LABEL = { new: 'New', learning: 'Learning', known: 'Known' };

export function topicView(id) {
  const topic = state.content.topics.find((t) => t.id === id);
  if (!topic) return h('div', {}, h('a', { href: '#topics', class: 'btn btn-soft' }, 'Back to topics'));
  const list = state.content.words.filter((w) => w.topic === id);
  const c = topicCounts(list, state.cards);
  const plan = buildSession(state.content.words, state.cards, { topic: id, minutes: 15 });
  const isFocus = state.settings.focus.includes(id);

  const toggleFocus = (e) => {
    const focus = e.target.checked ? [...state.settings.focus, id] : state.settings.focus.filter((f) => f !== id);
    saveSettings({ focus });
  };

  const studyLabel = plan.reviews.length && plan.fresh.length ? `Review ${plan.reviews.length}, learn ${plan.fresh.length}`
    : plan.reviews.length ? `Review ${plan.reviews.length}`
    : plan.fresh.length ? `Learn ${plan.fresh.length} new` : 'All caught up';

  return h('div', {},
    h('a', { href: '#topics', class: 'btn btn-ghost', style: { marginLeft: '-8px' } }, icon(ICONS.back, 18), 'Topics'),
    h('h1', { style: { marginTop: '4px' } }, topic.name),
    topic.blurb ? h('p', { class: 'lead' }, topic.blurb) : null,
    h('p', { class: 'small muted', style: { marginTop: '8px' } },
      `${c.known} known · ${c.learning} learning · ${c.new} new`),
    h('div', { style: { marginTop: '14px' } }, dots(list.map((w) => stage(state.cards[w.id])), 15)),

    h('button', {
      class: 'btn btn-primary btn-block', style: { marginTop: '20px' },
      disabled: !(plan.reviews.length || plan.fresh.length),
      onclick: () => startSession({ ...plan, label: topic.name, returnTo: `#topic/${id}` }),
    }, studyLabel),

    h('div', { class: 'toggle-row', style: { marginTop: '8px' } },
      h('label', { for: 'focus-switch' },
        h('div', {}, 'Focus topic'),
        h('div', { class: 'tiny muted' }, 'More new words come from focus topics')),
      h('input', { id: 'focus-switch', type: 'checkbox', class: 'switch', checked: isFocus, onchange: toggleFocus })),

    h('h2', { class: 'section-title' }, `All ${list.length} words`),
    h('div', {}, list.map((w) => {
      const s = stage(state.cards[w.id]);
      return h('button', {
        class: 'list-row', style: { width: '100%', background: 'none', border: 0, borderBottom: '0.5px solid var(--line)', textAlign: 'left', color: 'inherit' },
        onclick: () => speak(w.es), 'aria-label': `${w.es}, ${w.en}. Tap to hear it.`,
      },
        h('span', { class: 'es' }, w.es),
        h('span', { class: 'right' },
          h('span', { class: 'en' }, w.en),
          s !== 'new' ? h('span', { class: 'state-pill' }, LABEL[s]) : null));
    })),
  );
}
