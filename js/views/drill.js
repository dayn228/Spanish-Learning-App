/*
  Drill: a run of grammar exercises or verb-trainer items, full screen.

  Kinds:
    practice  10 exercises from one unit, weighted to your mistakes
    testout   12 exercises covering every form; 90% masters the unit
    review    5 exercises from a mastered unit
    verbs     10 verb forms from the verb trainer
*/

import { state, saveGrammar, finishSession } from '../state.js';
import { h, icon, ICONS } from '../ui.js';
import { exerciseView } from '../exercise.js';
import { recordAnswer, finishSet, finishTestOut, finishReview, pickExercises, pickTestOut, recordVerb, pickVerbItems, unitStatus } from '../grammar.js';
import { VERBS } from '../verbs.js';

let drill = null;

// Enter moves on after an answer, also for tap-only exercises (laptop keyboards).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !drill || e.target.tagName === 'INPUT') return;
  const next = document.querySelector('.next-btn');
  if (next) { e.preventDefault(); next.click(); }
});

export const UNLOCKED_TENSES = ['present'];

/** Build and open a drill. spec: { kind, unitId?, count?, returnTo?, fromSession? } */
export function startDrill(spec) {
  const unit = spec.unitId ? state.content.units.find((u) => u.id === spec.unitId) : null;
  let items;
  if (spec.kind === 'verbs') {
    items = pickVerbItems(state.grammar, Object.keys(VERBS), UNLOCKED_TENSES, spec.count || 10)
      .map((v) => ({ ex: { type: 'conj', verb: v.inf, person: v.person, tense: v.tense }, key: v.key }));
  } else if (spec.kind === 'testout') {
    items = pickTestOut(unit, spec.count || 12).map((ex) => ({ ex }));
  } else {
    items = pickExercises(state.grammar, unit, spec.count || (spec.kind === 'review' ? 5 : 10)).map((ex) => ({ ex }));
  }
  drill = { ...spec, unit, items, pos: 0, points: [], startScore: unit ? unitStatus(state.grammar, unit.id).score : 0 };
  location.hash = '#drill';
}

export function drillView() {
  if (!drill) return h('div', {}, h('p', {}, 'No exercises running.'), h('a', { href: '#practice', class: 'btn btn-soft', style: { marginTop: '12px' } }, 'Go to Practice'));
  const root = h('div', {});
  draw(root);
  return root;
}

function title() {
  if (drill.kind === 'verbs') return 'Verb trainer';
  const u = drill.unit;
  return `${u.n}. ${u.title}` + (drill.kind === 'testout' ? ' · test' : drill.kind === 'review' ? ' · review' : '');
}

function exit() {
  const back = drill.returnTo || (drill.unit ? `#grammar/${drill.unit.id}` : '#practice');
  if (drill.points.length && !drill.finished) finishSession();
  drill = null;
  location.hash = back;
}

function draw(root) {
  if (drill.pos >= drill.items.length) return drawDone(root);
  const item = drill.items[drill.pos];
  const total = drill.items.length;
  const top = h('div', {},
    h('div', { class: 'study-top' },
      h('button', { class: 'btn-icon', 'aria-label': 'Stop', onclick: exit }, icon(ICONS.close, 20)),
      h('div', { class: 'bar' }, h('i', { style: { width: `${Math.round((drill.pos / total) * 100)}%` } })),
      h('span', { class: 'small muted', style: { minWidth: '52px', textAlign: 'right' } }, `${drill.pos + 1} of ${total}`)),
    h('div', { class: 'small muted', style: { marginTop: '14px' } }, title()));

  const view = exerciseView(item.ex, {
    onResult: (points) => {
      drill.points.push(points);
      if (drill.kind === 'verbs') recordVerb(state.grammar, item.key, points);
      else recordAnswer(state.grammar, drill.unit.id, item.ex, points);
      saveGrammar();
    },
    onNext: () => { drill.pos += 1; draw(root); window.scrollTo(0, 0); },
  });
  root.replaceChildren(top, h('div', { style: { marginTop: '18px' } }, view));
  root.querySelector('input:not([readonly])')?.focus();
}

function drawDone(root) {
  const pts = drill.points;
  const accuracy = pts.reduce((a, b) => a + b, 0) / Math.max(1, pts.length);
  let headline = '', detail = '';

  if (!drill.finished) {
    drill.finished = true;
    if (drill.kind === 'practice') {
      const r = finishSet(state.grammar, drill.unit.id, pts);
      headline = r.newlyMastered ? 'Unit mastered.' : r.gain ? `+${r.gain} mastery` : 'Keep practising this one.';
      detail = r.gain ? '' : 'Under 50% right does not add mastery, but the next set focuses on what you missed.';
    } else if (drill.kind === 'testout') {
      const r = finishTestOut(state.grammar, drill.unit.id, pts);
      headline = r.passed ? 'Test passed. Unit mastered.' : 'Not quite 90% yet.';
      detail = r.passed ? 'It will come back for a short review in a week.' : r.gain ? `It still counted: +${r.gain} mastery.` : '';
    } else if (drill.kind === 'review') {
      const r = finishReview(state.grammar, drill.unit.id, pts);
      headline = r.stillMastered ? 'Review passed.' : 'This unit needs more practice.';
      detail = r.stillMastered ? 'The next review is further away.' : 'It is back on your practice list.';
    } else {
      headline = accuracy >= 0.9 ? 'Excellent.' : accuracy >= 0.7 ? 'Good work.' : 'The forms you missed come back more often.';
    }
    saveGrammar(false);
    finishSession();
    drill.summary = { headline, detail };
  }
  ({ headline, detail } = drill.summary);
  const score = drill.unit ? unitStatus(state.grammar, drill.unit.id).score : null;

  root.replaceChildren(h('div', { class: 'done' },
    h('div', { class: 'big-num' }, `${Math.round(accuracy * 100)}%`),
    h('p', { class: 'muted' }, `right, over ${pts.length} exercises`),
    h('h2', { style: { marginTop: '24px' } }, headline),
    detail ? h('p', { class: 'lead' }, detail) : null,
    score !== null ? h('div', { style: { marginTop: '20px', textAlign: 'left' } },
      h('div', { class: 'row between small' }, h('span', {}, `${drill.unit.n}. ${drill.unit.title}`), h('span', { class: 'muted' }, `${score} / 100`)),
      h('div', { class: 'bar', style: { marginTop: '8px' } }, h('i', { style: { width: `${score}%` } }))) : null,
    h('div', { style: { marginTop: '32px' } },
      h('button', { class: 'btn btn-primary btn-block', onclick: exit }, 'Done'))));
}
