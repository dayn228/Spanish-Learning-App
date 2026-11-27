/*
  Renders one exercise and checks the answer.

  Types (fields in the grammar JSON files):
    gap        q with ___, a, hint?, en?       type the missing word(s)
    choice     q, options[], a (index), why?   tap one option
    transform  instr, q, a                     rewrite the sentence
    error      q, a, why?                      write the corrected sentence
    translate  q (English), a                  write it in Spanish
    reorder    words[], a, en?                 tap the words in order
    match      instr, pairs[[left, right]]     pair them up
    table      verb, tense?                    all six forms (present unless tense is given)
    conj       verb, person, tense             one verb form (verb trainer)
    hear       say, options[], a               listen, then pick what you heard
    dictation  say, en?                        listen, then type the sentence

  `a` may list alternatives separated by " / ".
  Points: 1 right, 0 wrong. A slip in accents or articles still counts as right,
  with a note; exercises tagged article-* treat a wrong article as half right,
  verb forms (conj, table) treat an accent slip as half right (see gradeAnswer).
  Tables and matches score a share (4 of 6 right = 0.67).
*/

import { h, icon, ICONS } from './ui.js';
import { gradeAnswer, matchFits, reorderRight, wordDiff } from './check.js';
import { conjugate, PERSONS, VERBS } from './verbs.js';
import { speak, hasSpanishVoice } from './speech.js';

const INSTR = {
  gap: 'Fill the gap', choice: 'Choose the right option', transform: '', error: 'Find and correct the mistake',
  translate: 'Write it in Spanish', reorder: 'Put the words in order', match: '', table: 'Conjugate in the present', conj: 'Write the verb form',
};

const ACCENTS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'];

/** Text field with an accent bar under it. */
export function textInput(id, label) {
  const input = h('input', { class: 'answer-field', id, autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', lang: 'es', 'aria-label': label });
  const bar = h('div', { class: 'accent-bar', 'aria-label': 'Special letters' }, ACCENTS.map((c) => h('button', {
    type: 'button', class: 'accent-key', tabindex: '-1',
    onmousedown: (e) => e.preventDefault(),
    onclick: () => insertAt(input, c),
  }, c)));
  return { input, el: h('div', {}, input, bar) };
}

function insertAt(input, text) {
  const s = input.selectionStart ?? input.value.length, e = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, s) + text + input.value.slice(e);
  input.focus();
  input.setSelectionRange(s + text.length, s + text.length);
}

function grade(input, answer, ex = {}) {
  return gradeAnswer(input, answer, ex);
}

function firstAnswer(a) { return String(a).split(' / ')[0]; }

/** Inline text with **bold** and *italic* (used for Spanish). Built as nodes, never HTML. */
export function rich(text) {
  return String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).filter(Boolean).map((part) =>
    part.startsWith('**') ? h('b', {}, part.slice(2, -2))
      : part.startsWith('*') ? h('em', { lang: 'es' }, part.slice(1, -1))
      : part);
}

function feedback(points, kind, correct, extra) {
  const cls = points >= 1 ? 'good' : points > 0 ? 'close' : 'bad';
  const title = points >= 1 ? 'Correct.' : kind === 'article' ? 'Almost: check the article.' : points > 0 ? 'Partly right.' : 'Not quite.';
  const slip = points >= 1 && (kind === 'accent' || kind === 'article');
  return h('div', { class: `feedback ${cls}` },
    points >= 1 ? icon(ICONS.check, 20) : points === 0 ? icon(ICONS.close, 20) : null,
    h('div', {},
      h('b', {}, title),
      slip && correct ? h('div', { class: 'small' }, kind === 'accent' ? 'Mind the accent: ' : 'Mind the article: ', h('span', { class: 'es' }, correct)) : null,
      points < 1 && correct ? h('div', {}, 'Answer: ', h('span', { class: 'es' }, correct)) : null,
      extra.why ? h('div', { class: 'small', style: { marginTop: '4px' } }, rich(extra.why)) : null,
      extra.en ? h('div', { class: 'small muted', style: { marginTop: '4px' } }, extra.en) : null));
}

/**
 * Build the exercise screen.
 * @param ex       exercise
 * @param onResult called once with points (0..1)
 * @param onNext   called when the learner taps Next
 * @returns element
 */
export function exerciseView(ex, { onResult, onNext }) {
  const root = h('div', { class: 'exercise' });
  const result = h('div', {});
  const actions = h('div', { class: 'study-actions' });
  let done = false;

  const finish = (points, kind, correct, extra = {}) => {
    if (done) return;
    done = true;
    onResult(points);
    result.replaceChildren(feedback(points, kind, correct, { why: ex.why, en: ex.en, ...extra }));
    if (correct && /[a-záéíóúñ]/i.test(correct)) speak(correct);
    actions.replaceChildren(h('button', { class: 'btn btn-primary btn-block next-btn', onclick: onNext }, 'Next'));
  };

  const pastLabel = { preterite: 'in the preterite (hablé)', imperfect: 'in the imperfect (hablaba)' }[ex.tense];
  const instr = ex.instr || (ex.type === 'table' && pastLabel ? `Conjugate ${pastLabel}` : ex.type === 'conj' && pastLabel ? `Write the verb form ${pastLabel}` : INSTR[ex.type]) || '';
  if (instr) root.append(h('div', { class: 'small muted' }, instr));

  const checkBtn = (fn) => h('button', { class: 'btn btn-primary btn-block', onclick: fn }, 'Check answer');
  const enterToCheck = (input, fn) => input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done ? onNext() : fn(); } });

  switch (ex.type) {
    case 'choice': {
      const sentence = h('div', { class: 'ex-q es' }, ex.q);
      const opts = h('div', { class: 'options' });
      // Show the options in random order; i is always the original index.
      const order = shuffle(ex.options.map((_, i) => i));
      const buttons = {};
      order.forEach((i) => opts.append(buttons[i] = h('button', {
        class: 'option', onclick: () => {
          if (done) return;
          Object.values(buttons).forEach((b) => { b.disabled = true; });
          buttons[ex.a].classList.add('right');
          if (i !== ex.a) buttons[i].classList.add('wrong');
          finish(i === ex.a ? 1 : 0, i === ex.a ? 'right' : 'wrong', ex.q.replace('___', ex.options[ex.a]));
        },
      }, ex.options[i])));
      root.append(sentence, opts, result);
      break;
    }

    case 'gap':
    case 'transform':
    case 'error':
    case 'translate': {
      const { input, el } = textInput('answer', 'Your answer');
      let prompt;
      if (ex.type === 'gap') {
        const [before, after] = ex.q.split('___');
        prompt = h('div', { class: 'ex-q es' }, before, h('span', { class: 'blank' }, '___'), after ?? '',
          ex.hint ? h('span', { class: 'hint' }, ` (${ex.hint})`) : null);
      } else {
        prompt = h('div', { class: 'ex-q ' + (ex.type === 'translate' ? '' : 'es') }, ex.q);
      }
      const check = () => {
        if (!input.value.trim()) { input.focus(); return; }
        input.readOnly = true;
        const g = grade(input.value, ex.a, ex);
        const full = ex.type === 'gap' ? ex.q.replace('___', firstAnswer(ex.a)) : firstAnswer(ex.a);
        finish(g.points, g.kind, full);
      };
      enterToCheck(input, check);
      root.append(prompt, h('div', { style: { marginTop: '18px' } }, el), result);
      actions.append(checkBtn(check));
      break;
    }

    case 'conj': {
      const forms = conjugate(ex.verb, ex.tense);
      const { input, el } = textInput('answer', 'Verb form');
      root.append(
        h('div', { class: 'ex-q' }, h('span', { class: 'muted' }, PERSONS[ex.person] + ' · '), h('span', { class: 'es' }, ex.verb)),
        h('div', { class: 'small muted', style: { marginTop: '4px' } }, `${VERBS[ex.verb]?.en || ''} · ${({ present: 'present', preterite: 'preterite (past)', imperfect: 'imperfect (used to / was -ing)' })[ex.tense] || 'present'}`),
        h('div', { style: { marginTop: '18px' } }, el), result);
      const check = () => {
        if (!input.value.trim()) { input.focus(); return; }
        input.readOnly = true;
        const g = grade(input.value, forms[ex.person], ex);
        finish(g.points, g.kind, forms[ex.person], { table: forms });
        if (g.points < 1) result.append(formsTable(ex.verb, forms));
      };
      enterToCheck(input, check);
      actions.append(checkBtn(check));
      break;
    }

    case 'table': {
      const forms = conjugate(ex.verb, ex.tense || 'present');
      const inputs = PERSONS.map((p, i) => h('input', { class: 'table-field', autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', lang: 'es', 'aria-label': `${ex.verb}, ${p}`, 'data-i': i }));
      const rows = h('div', { class: 'conj-table' }, PERSONS.map((p, i) => h('label', { class: 'conj-row' }, h('span', { class: 'muted small' }, p), inputs[i])));
      const bar = h('div', { class: 'accent-bar' }, ACCENTS.slice(0, 7).map((c) => h('button', {
        type: 'button', class: 'accent-key', tabindex: '-1', onmousedown: (e) => e.preventDefault(),
        onclick: () => { const f = document.activeElement?.classList.contains('table-field') ? document.activeElement : inputs.find((x) => !x.value) || inputs[0]; insertAt(f, c); },
      }, c)));
      inputs.forEach((inp, i) => inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (done) onNext(); else if (i < 5) inputs[i + 1].focus(); else check(); } }));
      const check = () => {
        let total = 0;
        inputs.forEach((inp, i) => {
          const g = grade(inp.value, forms[i], ex);
          total += g.points;
          inp.readOnly = true;
          inp.classList.add(g.points >= 1 ? (g.kind === 'right' ? 'ok' : 'close') : 'no');
          if (g.points < 1 || g.kind !== 'right') inp.value = forms[i] + (g.points < 1 && inp.value.trim() ? `  ← ${inp.value.trim()}` : '');
        });
        const pts = Math.round((total / 6) * 100) / 100;
        finish(pts, pts >= 1 ? 'right' : 'partial', null, { why: pts < 1 ? 'Correct forms are filled in.' : null });
      };
      root.append(h('div', { class: 'ex-q' }, h('span', { class: 'es' }, ex.verb), h('span', { class: 'small muted' }, `  ${VERBS[ex.verb]?.en || ''}`)), rows, bar, result);
      actions.append(checkBtn(check));
      break;
    }

    case 'reorder': {
      const pool = shuffle(ex.words.map((w, i) => ({ w, i })));
      const line = h('div', { class: 'reorder-line', 'aria-label': 'Your sentence' });
      const bank = h('div', { class: 'reorder-bank' });
      const placed = [];
      const draw = () => {
        line.replaceChildren(...placed.map((p) => h('button', { class: 'word-chip on', onclick: () => { if (done) return; placed.splice(placed.indexOf(p), 1); draw(); } }, p.w)));
        if (!placed.length) line.append(h('span', { class: 'muted small' }, 'Tap the words below in order'));
        bank.replaceChildren(...pool.map((p) => h('button', { class: 'word-chip', disabled: placed.includes(p) || done, onclick: () => { placed.push(p); draw(); } }, p.w)));
      };
      draw();
      const check = () => {
        if (placed.length < ex.words.length) return;
        // `a` may list other correct orders: "Mañana voy a la obra / Voy a la obra mañana".
        const g = reorderRight(placed.map((p) => p.w), ex.a) ? 1 : 0;
        finish(g, g ? 'right' : 'wrong', String(ex.a).split(' / ')[0]);
        draw();
      };
      root.append(line, bank, result);
      actions.append(checkBtn(check));
      break;
    }

    case 'match': {
      const lefts = ex.pairs.map((p, i) => ({ text: p[0], i }));
      const rights = shuffle(ex.pairs.map((p, i) => ({ text: p[1], i })));
      let picked = null, mistakes = 0, matched = 0;
      const leftCol = h('div', { class: 'match-col' });
      const rightCol = h('div', { class: 'match-col' });
      const leftBtns = lefts.map((l) => h('button', { class: 'match-item es', onclick: () => { if (l.done) return; picked = l; leftBtns.forEach((b) => b.classList.remove('sel')); leftBtns[lefts.indexOf(l)].classList.add('sel'); } }, l.text));
      const rightBtns = rights.map((r) => h('button', {
        class: 'match-item', onclick: () => {
          if (!picked || r.done) return;
          const lb = leftBtns[lefts.indexOf(picked)], rb = rightBtns[rights.indexOf(r)];
          // Compare texts, not positions: two pairs may share an answer (agua = el, mapa = el).
          if (matchFits(ex.pairs, picked.i, r.i)) {
            r.done = picked.done = true; matched += 1;
            lb.classList.remove('sel'); lb.classList.add('paired'); rb.classList.add('paired'); lb.disabled = rb.disabled = true;
            picked = null;
            if (matched === ex.pairs.length) {
              const pts = Math.max(0, Math.round((1 - mistakes / ex.pairs.length) * 100) / 100);
              finish(pts, pts >= 1 ? 'right' : 'partial', null, { why: mistakes ? `${mistakes} wrong ${mistakes === 1 ? 'try' : 'tries'}.` : null });
            }
          } else {
            mistakes += 1;
            rb.classList.add('miss'); setTimeout(() => rb.classList.remove('miss'), 500);
          }
        },
      }, r.text));
      leftCol.append(...leftBtns); rightCol.append(...rightBtns);
      root.append(h('div', { class: 'match' }, leftCol, rightCol), result);
      break;
    }

    case 'hear': {
      const play = playButtons(ex.say);
      const opts = h('div', { class: 'options' });
      const order = shuffle(ex.options.map((_, i) => i));
      const buttons = {};
      order.forEach((i) => opts.append(buttons[i] = h('button', {
        class: 'option', lang: 'es', onclick: () => {
          if (done) return;
          Object.values(buttons).forEach((b) => { b.disabled = true; });
          buttons[ex.a].classList.add('right');
          if (i !== ex.a) buttons[i].classList.add('wrong');
          finish(i === ex.a ? 1 : 0, i === ex.a ? 'right' : 'wrong', ex.options[ex.a]);
        },
      }, ex.options[i])));
      root.append(play, opts, result);
      speak(ex.say);
      break;
    }

    case 'dictation': {
      const play = playButtons(ex.say);
      const { input, el } = textInput('answer', 'What you heard');
      const check = () => {
        if (!input.value.trim()) { input.focus(); return; }
        input.readOnly = true;
        const d = wordDiff(input.value, ex.say);
        const pts = d.points >= 0.99 ? 1 : d.points;
        finish(pts >= 1 ? 1 : pts, pts >= 1 ? 'right' : 'partial', null, { why: null });
        result.firstChild.querySelector('div').append(...[
          h('div', { class: 'dictation-marks', lang: 'es' }, d.marks.map((m) => h('span', { class: m.ok ? 'ok' : 'miss' }, m.word + ' '))),
          pts < 1 ? h('div', { class: 'small' }, `${Math.round(pts * 100)}% of the words. Missed words are underlined.`) : null].filter(Boolean));
      };
      enterToCheck(input, check);
      root.append(play, h('div', { style: { marginTop: '18px' } }, el), result);
      actions.append(checkBtn(check));
      speak(ex.say);
      break;
    }

    default:
      root.append(h('p', {}, `Unknown exercise type: ${ex.type}`));
      actions.append(h('button', { class: 'btn btn-primary btn-block', onclick: () => { onResult(0); onNext(); } }, 'Skip'));
  }

  root.append(actions);
  return root;
}

/** Play and Slower buttons for listening exercises. */
function playButtons(text) {
  const noVoice = !hasSpanishVoice();
  return h('div', {},
    h('div', { class: 'row', style: { marginTop: '18px' } },
      h('button', { class: 'btn btn-primary', onclick: () => speak(text, 0.9) }, icon(ICONS.speaker, 20), 'Play'),
      h('button', { class: 'btn btn-soft', onclick: () => speak(text, 0.6) }, 'Slower')),
    noVoice ? h('p', { class: 'tiny muted', style: { marginTop: '8px' } },
      'No Spanish voice found. On iPhone: Settings → Accessibility → Spoken Content → Voices → Spanish (Spain).') : null);
}

function formsTable(verb, forms) {
  return h('div', { class: 'card', style: { marginTop: '12px', padding: '12px 16px' } },
    PERSONS.map((p, i) => h('div', { class: 'list-row', style: { padding: '6px 0' } }, h('span', { class: 'small muted' }, p), h('span', { class: 'es' }, forms[i]))));
}

function shuffle(a) {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  // Never show a reorder already in the right order.
  if (out.length > 1 && out.every((x, i) => x === a[i])) [out[0], out[1]] = [out[1], out[0]];
  return out;
}
