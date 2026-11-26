// Practice: grammar units, verb trainer and extra word drills.

import { state } from '../state.js';
import { h, plural } from '../ui.js';
import { stage } from '../srs.js';
import { unitStatus, recommendedUnit, unitsDueForReview, countMistakes } from '../grammar.js';
import { startSession } from './study.js';
import { startDrill } from './drill.js';

export function practiceView() {
  const { units, words } = state.content;
  const next = recommendedUnit(units, state.grammar);
  const reviews = unitsDueForReview(units, state.grammar);
  const started = words.filter((w) => stage(state.cards[w.id]) !== 'new');
  // Words you have got wrong: still-failing ones first, then by number of mistakes.
  const missed = started.filter((w) => (state.cards[w.id].wrong || state.cards[w.id].lapses || 0) > 0);
  const failing = (w) => (state.cards[w.id].reps === 0 ? 1 : 0);
  const hardest = missed
    .sort((a, b) => failing(b) - failing(a) || (state.cards[b.id].wrong || 0) - (state.cards[a.id].wrong || 0) || (state.cards[b.id].lastWrong || 0) - (state.cards[a.id].lastWrong || 0))
    .slice(0, 15);
  const grammarMistakes = countMistakes(state.grammar, units);
  const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

  const root = h('div', {},
    h('h1', {}, 'Practice'),
    h('p', { class: 'lead' }, 'Grammar, verbs and extra word drills, whenever you like.'));

  if (hardest.length || grammarMistakes) {
    root.append(h('div', { class: 'card', style: { marginTop: '24px' } },
      h('h2', {}, 'Your mistakes'),
      h('p', { class: 'small muted', style: { marginTop: '6px' } },
        [hardest.length && plural(missed.length, 'word', 'words') + ' you got wrong',
         grammarMistakes && plural(grammarMistakes, 'grammar exercise', 'grammar exercises') + ' to redo'].filter(Boolean).join(' · ')),
      h('div', { class: 'row', style: { marginTop: '14px', flexWrap: 'wrap' } },
        hardest.length ? h('button', { class: 'btn btn-primary', onclick: () => startSession({ reviews: hardest.map((w) => w.id), fresh: [], label: 'Words to work on', returnTo: '#practice' }) }, `Words (${hardest.length})`) : null,
        grammarMistakes ? h('button', { class: hardest.length ? 'btn btn-secondary' : 'btn btn-primary', onclick: () => startDrill({ kind: 'mistakes', returnTo: '#practice' }) }, `Grammar (${Math.min(10, grammarMistakes)})`) : null),
      hardest.length ? h('div', { style: { marginTop: '14px' } }, hardest.slice(0, 5).map((w) => h('div', { class: 'list-row', style: { padding: '8px 0' } },
        h('span', { class: 'es' }, w.es), h('span', { class: 'right' }, h('span', { class: 'en' }, w.en), h('span', { class: 'state-pill' }, plural(state.cards[w.id].wrong || state.cards[w.id].lapses, 'miss', 'misses')))))) : null));
  }

  if (reviews.length) {
    const u = reviews[0];
    root.append(h('div', { class: 'card', style: { marginTop: '12px' } },
      h('div', { class: 'small muted' }, 'Review due'),
      h('h2', { style: { marginTop: '4px' } }, `${u.n}. ${u.title}`),
      h('button', { class: 'btn btn-primary', style: { marginTop: '14px' }, onclick: () => startDrill({ kind: 'review', unitId: u.id, returnTo: '#practice' }) }, 'Review (5)')));
  }

  if (next) {
    const s = unitStatus(state.grammar, next.id);
    root.append(h('div', { class: 'card', style: { marginTop: (reviews.length || hardest.length || grammarMistakes) ? '12px' : '24px' } },
      h('div', { class: 'small muted' }, s.sets ? 'Continue grammar' : 'Next grammar unit'),
      h('h2', { style: { marginTop: '4px' } }, `${next.n}. ${next.title}`),
      h('p', { class: 'small muted', style: { marginTop: '4px' } }, next.summary),
      h('div', { class: 'bar', style: { marginTop: '14px' } }, h('i', { style: { width: `${s.score}%` } })),
      h('div', { class: 'row', style: { marginTop: '14px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-primary', onclick: () => startDrill({ kind: 'practice', unitId: next.id, returnTo: '#practice' }) }, 'Practise (10)'),
        h('a', { class: 'btn btn-secondary', href: `#grammar/${next.id}` }, s.sets ? 'Explanation' : 'Read it first'))));
  }

  root.append(h('div', { class: 'card' },
    h('h2', {}, 'Verb trainer'),
    h('p', { class: 'small muted', style: { marginTop: '6px' } }, 'Ten verb forms in the present tense. Forms you miss come back more; forms you know retire.'),
    h('button', { class: 'btn btn-primary', style: { marginTop: '14px' }, onclick: () => startDrill({ kind: 'verbs', returnTo: '#practice' }) }, 'Start verb trainer')));

  root.append(h('h2', { class: 'section-title' }, 'Grammar units'),
    h('div', {}, units.map((u) => {
      const s = unitStatus(state.grammar, u.id);
      return h('a', { href: `#grammar/${u.id}`, class: 'unit-row' },
        h('span', { class: 'unit-n' }, String(u.n)),
        h('span', { class: 'grow' },
          h('span', { class: 'unit-title' }, u.title),
          h('span', { class: 'bar thin' }, h('i', { style: { width: `${s.score}%` } }))),
        h('span', { class: 'small muted', style: { minWidth: '64px', textAlign: 'right' } }, s.mastered ? 'Mastered' : s.sets ? `${s.score}%` : u.level));
    })));

  root.append(h('h2', { class: 'section-title' }, 'Words'),
    h('div', { class: 'card' },
      h('h3', {}, 'Type the Spanish'),
      h('p', { class: 'small muted', style: { marginTop: '6px' } },
        started.length >= 4 ? `20 words you have started, shown in English. ${plural(started.length, 'word', 'words')} available.` : 'Learn a few words first, then practise them here.'),
      h('button', {
        class: 'btn btn-secondary', style: { marginTop: '14px' }, disabled: started.length < 4,
        onclick: () => startSession({ reviews: shuffle(started).slice(0, 20).map((w) => w.id), fresh: [], mode: 'produce', label: 'Typing practice', returnTo: '#practice' }),
      }, 'Start typing practice')));

  return root;
}
