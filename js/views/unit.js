// One grammar unit: mastery, practice and test buttons, and the explanation.

import { state } from '../state.js';
import { h, icon, ICONS } from '../ui.js';
import { rich } from '../exercise.js';
import { unitStatus, pickMistakes } from '../grammar.js';
import { startDrill } from './drill.js';
import { speak } from '../speech.js';

export function unitView(id) {
  const unit = state.content.units.find((u) => u.id === id);
  if (!unit) return h('div', {}, h('a', { href: '#practice', class: 'btn btn-soft' }, 'Back to Practice'));
  const s = unitStatus(state.grammar, id);
  const reviewDue = s.mastered && s.reviewDue && s.reviewDue <= Date.now();

  const status = s.mastered
    ? (reviewDue ? 'Mastered · a short review is due' : `Mastered · next review ${new Date(s.reviewDue).toLocaleDateString()}`)
    : s.sets ? `${s.score} of 100 · ${s.sets} ${s.sets === 1 ? 'set' : 'sets'} done` : 'Not started';

  return h('div', {},
    h('a', { href: '#practice', class: 'btn btn-ghost', style: { marginLeft: '-8px' } }, icon(ICONS.back, 18), 'Practice'),
    h('div', { class: 'small muted', style: { marginTop: '4px' } }, `Unit ${unit.n} · ${unit.level}`),
    h('h1', { style: { marginTop: '2px' } }, unit.title),
    h('p', { class: 'lead' }, unit.summary),

    h('div', { style: { marginTop: '18px' } },
      h('div', { class: 'bar' }, h('i', { style: { width: `${s.score}%` } })),
      h('p', { class: 'small muted', style: { marginTop: '8px' } }, status)),

    h('div', { class: 'row', style: { marginTop: '16px', flexWrap: 'wrap' } },
      reviewDue
        ? h('button', { class: 'btn btn-primary', onclick: () => startDrill({ kind: 'review', unitId: id }) }, 'Review (5)')
        : h('button', { class: 'btn btn-primary', onclick: () => startDrill({ kind: 'practice', unitId: id }) }, s.mastered ? 'Practise again' : 'Practise (10)'),
      s.mastered ? null : h('button', { class: 'btn btn-secondary', onclick: () => startDrill({ kind: 'testout', unitId: id }) }, 'I know this: test me')),
    (() => {
      const n = pickMistakes(state.grammar, [unit], Infinity).length;
      return n ? h('p', { class: 'small', style: { marginTop: '12px' } }, `${n} ${n === 1 ? 'exercise' : 'exercises'} here you got wrong last time. Your next set includes them.`) : null;
    })(),
    h('p', { class: 'tiny muted', style: { marginTop: '10px' } },
      'Mastery grows with accuracy: a perfect set completes the unit, mistakes bring more practice on those forms. The test needs 90%.'),

    h('div', { class: 'card explain', style: { marginTop: '24px' } }, unit.explain.map(block)),
    h('p', { class: 'tiny muted', style: { marginTop: '12px' } }, `${unit.exercises.length} exercises in this unit.`),
  );
}

function block(b) {
  if (b.h) return h('h3', {}, b.h);
  if (b.p) return h('p', {}, rich(b.p));
  if (b.tip) return h('div', { class: 'tip' }, rich(b.tip));
  if (b.ex) return h('button', { class: 'ex-line', onclick: () => speak(b.ex[0]), 'aria-label': `${b.ex[0]}. Tap to hear it.` },
    h('span', { class: 'es', lang: 'es' }, b.ex[0]), h('span', { class: 'muted small' }, b.ex[1]));
  if (b.table) {
    const rows = b.head ? b.table.slice(1) : b.table;
    return h('div', { class: 'table-wrap' }, h('table', { class: 'gtable' },
      b.head ? h('thead', {}, h('tr', {}, b.table[0].map((c) => h('th', {}, c)))) : null,
      h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c, i) => h('td', { class: b.head ? (i === 0 ? 'lbl' : 'es') : (i === 0 ? 'es' : 'en') }, rich(c))))))));
  }
  return null;
}
