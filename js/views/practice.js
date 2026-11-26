// Practice: extra drills outside the daily plan. Grammar arrives in phase 2.

import { state } from '../state.js';
import { h, plural } from '../ui.js';
import { stage } from '../srs.js';
import { startSession } from './study.js';

export function practiceView() {
  const started = state.content.words.filter((w) => stage(state.cards[w.id]) !== 'new');
  const hardest = [...started]
    .filter((w) => (state.cards[w.id].lapses || 0) > 0)
    .sort((a, b) => state.cards[b.id].lapses - state.cards[a.id].lapses)
    .slice(0, 15);
  const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

  return h('div', {},
    h('h1', {}, 'Practice'),
    h('p', { class: 'lead' }, 'Extra practice that doesn\'t wait for reviews to be due.'),

    h('div', { class: 'card', style: { marginTop: '24px' } },
      h('h2', {}, 'Type the Spanish'),
      h('p', { class: 'small muted', style: { marginTop: '6px' } },
        started.length ? `20 words you have started, shown in English. ${plural(started.length, 'word', 'words')} available.` : 'Learn a few words first, then practise them here.'),
      h('button', {
        class: 'btn btn-primary', style: { marginTop: '14px' }, disabled: started.length < 4,
        onclick: () => startSession({ reviews: shuffle(started).slice(0, 20).map((w) => w.id), fresh: [], mode: 'produce', label: 'Typing practice', returnTo: '#practice' }),
      }, 'Start typing practice')),

    h('div', { class: 'card' },
      h('h2', {}, 'Words to work on'),
      h('p', { class: 'small muted', style: { marginTop: '6px' } },
        hardest.length ? `The ${plural(hardest.length, 'word', 'words')} you have missed most.` : 'Words you miss will collect here.'),
      hardest.length ? h('button', {
        class: 'btn btn-secondary', style: { marginTop: '14px' },
        onclick: () => startSession({ reviews: hardest.map((w) => w.id), fresh: [], label: 'Words to work on', returnTo: '#practice' }),
      }, `Practise these ${hardest.length}`) : null),

    h('div', { class: 'panel', style: { marginTop: '12px' } },
      h('h3', {}, 'Coming next'),
      h('p', { class: 'small muted', style: { marginTop: '6px' } },
        'Grammar units with textbook-style exercises and the verb trainer arrive in phase 2. Listening, reading and writing follow.')),
  );
}
