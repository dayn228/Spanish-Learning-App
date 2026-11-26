/*
  Study session: shows one card at a time.

  Card modes:
    intro      a new word: Spanish, English, example. "Got it" or "I already know this".
    recognize  Spanish shown; tap to reveal English; rate Again / Good / Easy.
    produce    English shown; type the Spanish; checked automatically.

  A new word gets an intro, then a recognize check three cards later.
  A missed word comes back three cards later (at most twice per session).
  Words with two or more correct reviews are sometimes asked as "produce",
  which is harder and tests real recall.
*/

import { state, answer, knowIt, finishSession } from '../state.js';
import { h, icon, ICONS, toast, plural } from '../ui.js';
import { AGAIN, HARD, GOOD, EASY, previewInterval } from '../srs.js';
import { checkAnswer } from '../check.js';
import { speak, canSpeak } from '../speech.js';

let session = null;

/** Start a session from a plan { reviews, fresh, label, returnTo, mode? } and open the study screen. */
export function startSession(plan) {
  const queue = [];
  for (const id of plan.reviews) {
    const c = state.cards[id];
    const produce = plan.mode === 'produce' || (c && c.reps >= 2 && Math.random() < 0.5);
    queue.push({ id, mode: produce ? 'produce' : 'recognize' });
  }
  // Spread new words between reviews: intro now, check a few cards later.
  const fresh = plan.fresh.map((id) => ({ id, mode: 'intro' }));
  const mixed = [];
  while (queue.length || fresh.length) {
    if (fresh.length) mixed.push(fresh.shift());
    if (queue.length) mixed.push(queue.shift());
    if (queue.length) mixed.push(queue.shift());
  }
  session = {
    queue: mixed, pos: 0, answered: 0, right: 0, learned: 0, retries: {},
    label: plan.label || 'Session', returnTo: plan.returnTo || '#today', startedAt: Date.now(),
  };
  location.hash = '#study';
}

function insertLater(item, gap = 3) {
  session.queue.splice(Math.min(session.queue.length, session.pos + 1 + gap), 0, item);
}

export function studyView() {
  if (!session) return h('div', {}, h('p', {}, 'No session running.'), h('a', { href: '#today', class: 'btn btn-soft', style: { marginTop: '12px' } }, 'Go to Today'));
  const root = h('div', {});
  draw(root);
  return root;
}

function exit() {
  if (session.answered > 0 && !session.finished) finishSession();
  const back = session.returnTo;
  session = null;
  location.hash = back;
}

function header() {
  const total = session.queue.length;
  return h('div', { class: 'study-top' },
    h('button', { class: 'btn-icon', 'aria-label': 'End session', onclick: exit }, icon(ICONS.close, 20)),
    h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': session.pos },
      h('i', { style: { width: `${Math.round((session.pos / total) * 100)}%` } })),
    h('span', { class: 'small muted', style: { minWidth: '52px', textAlign: 'right' } }, `${Math.min(session.pos + 1, total)} of ${total}`));
}

function draw(root) {
  if (session.pos >= session.queue.length) return drawDone(root);
  const item = session.queue[session.pos];
  const word = state.content.byId.get(item.id);
  if (!word) { session.pos += 1; return draw(root); }   // word removed from the lists
  const next = () => { session.pos += 1; draw(root); };
  const view = item.mode === 'intro' ? introCard(word, item, next)
    : item.mode === 'produce' ? produceCard(word, item, next)
    : recognizeCard(word, item, next);
  root.replaceChildren(header(), ...view);
  root.querySelector('input')?.focus();
}

function speakButton(text) {
  if (!canSpeak()) return h('span');
  return h('button', { class: 'btn btn-soft', style: { minHeight: '44px', padding: '0 16px 0 12px' }, onclick: () => speak(text) }, icon(ICONS.speaker, 20), 'Listen');
}

function example(word) {
  if (!word.ex) return null;
  return h('div', { class: 'example' }, word.ex, h('span', { class: 'muted' }, word.exEn));
}

/* ---------- intro ---------- */
function introCard(word, item, next) {
  speak(word.es);
  return [
    h('div', { class: 'flashcard' },
      h('div', { class: 'kind' }, 'New word'),
      h('div', { class: 'big', lang: 'es' }, word.es),
      h('div', { class: 'rule' }),
      h('div', { class: 'answer' }, word.en),
      example(word)),
    h('div', { class: 'study-tools' }, speakButton(word.es),
      h('button', { class: 'btn btn-ghost', onclick: () => { knowIt(word.id); session.answered += 1; session.right += 1; toast('Marked as known'); next(); } }, 'I already know this')),
    h('div', { class: 'study-actions' },
      h('button', { class: 'btn btn-primary btn-block', onclick: () => { session.learned += 1; insertLater({ id: word.id, mode: 'recognize' }); next(); } }, 'Got it')),
  ];
}

/* ---------- recognize ---------- */
function recognizeCard(word, item, next) {
  const card = state.cards[word.id];
  let revealed = false;
  const answerBox = h('div', { style: { display: 'contents' } }, h('div', { class: 'small muted' }, 'Tap to see the English'));
  const actions = h('div', { class: 'study-actions' });

  const grade = (g) => {
    answer(word.id, g);
    session.answered += 1;
    if (g !== AGAIN) session.right += 1;
    else retry(item);
    next();
  };

  const reveal = () => {
    if (revealed) return;
    revealed = true;
    speak(word.es);
    answerBox.replaceChildren(h('div', { class: 'rule' }), h('div', { class: 'answer' }, word.en), example(word));
    const btn = (g, label, main) => h('button', { class: 'grade' + (main ? ' main' : ''), onclick: () => grade(g) },
      h('b', {}, label), h('small', {}, previewInterval(card, g)));
    actions.replaceChildren(h('div', { class: 'grades' }, btn(AGAIN, 'Again'), btn(GOOD, 'Good', true), btn(EASY, 'Easy')));
  };

  actions.append(h('button', { class: 'btn btn-primary btn-block', onclick: reveal }, 'Show answer'));
  return [
    h('button', { class: 'flashcard', onclick: reveal, 'aria-label': 'Show the answer' },
      h('div', { class: 'big', lang: 'es' }, word.es), answerBox),
    h('div', { class: 'study-tools' }, speakButton(word.es), h('span')),
    actions,
  ];
}

/* ---------- produce ---------- */
function produceCard(word, item, next) {
  const shownAt = Date.now();
  const input = h('input', { class: 'answer-field', id: 'answer', autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', lang: 'es', 'aria-label': 'Your answer in Spanish' });
  const result = h('div', {});
  const actions = h('div', { class: 'study-actions' });
  let checked = false;

  const check = () => {
    if (checked) { next(); return; }
    if (!input.value.trim()) { input.focus(); return; }
    checked = true;
    input.readOnly = true;
    const r = checkAnswer(input.value, word.es);
    const fast = Date.now() - shownAt < 5000;
    let g, box;
    if (r === 'right') {
      g = fast ? EASY : GOOD;
      box = h('div', { class: 'feedback good' }, icon(ICONS.check, 20), h('div', {}, h('b', {}, 'Correct. '), h('span', { class: 'es' }, word.es)));
    } else if (r === 'accent' || r === 'article') {
      g = HARD;
      box = h('div', { class: 'feedback close' }, h('div', {},
        h('b', {}, r === 'accent' ? 'Almost: check the accents. ' : 'Almost: check the article. '),
        'It is ', h('span', { class: 'es' }, word.es), '.'));
    } else {
      g = AGAIN;
      box = h('div', { class: 'feedback bad' }, icon(ICONS.close, 20), h('div', {}, h('b', {}, 'Not quite. '), 'It is ', h('span', { class: 'es' }, word.es), '.'));
      retry(item);
    }
    answer(word.id, g);
    session.answered += 1;
    if (g !== AGAIN) session.right += 1;
    speak(word.es);
    result.replaceChildren(box, word.ex ? h('p', { class: 'small', style: { marginTop: '12px' } }, word.ex, h('span', { class: 'muted', style: { display: 'block' } }, word.exEn)) : null);
    actions.replaceChildren(h('button', { class: 'btn btn-primary btn-block', onclick: next }, 'Next word'));
  };

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  actions.append(
    h('button', { class: 'btn btn-primary btn-block', onclick: check }, 'Check answer'),
    h('button', { class: 'btn btn-ghost', style: { width: '100%', marginTop: '6px' }, onclick: () => { if (!checked) showAnswer(); } }, "I don't know"));

  function showAnswer() {
    checked = true;
    input.readOnly = true;
    answer(word.id, AGAIN);
    session.answered += 1;
    retry(item);
    speak(word.es);
    result.replaceChildren(h('div', { class: 'feedback bad' }, h('div', {}, 'It is ', h('span', { class: 'es' }, word.es), '. It will come back soon.')));
    actions.replaceChildren(h('button', { class: 'btn btn-primary btn-block', onclick: next }, 'Next word'));
  }

  return [
    h('div', { style: { marginTop: '32px' } },
      h('div', { class: 'small muted' }, 'How do you say'),
      h('h1', { style: { marginTop: '4px', fontSize: '36px' } }, word.en)),
    h('div', { style: { marginTop: '24px' } }, input, result),
    actions,
  ];
}

function retry(item) {
  const n = session.retries[item.id] || 0;
  if (n >= 2) return;
  session.retries[item.id] = n + 1;
  insertLater({ id: item.id, mode: 'recognize' });
}

/* ---------- done ---------- */
function drawDone(root) {
  if (session.answered > 0 && !session.finished) { finishSession(); session.finished = true; }
  const mins = Math.max(1, Math.round((Date.now() - session.startedAt) / 60000));
  const pct = session.answered ? Math.round((session.right / session.answered) * 100) : 0;
  root.replaceChildren(h('div', { class: 'done' },
    h('div', { class: 'big-num' }, `${session.answered}`),
    h('p', { class: 'muted' }, `answers in ${plural(mins, 'minute', 'minutes')}`),
    h('h2', { style: { marginTop: '24px' } }, pct >= 90 ? 'Excellent work.' : pct >= 70 ? 'Good session.' : 'Hard ones will come back soon.'),
    h('p', { class: 'lead' },
      [session.learned && plural(session.learned, 'new word', 'new words'), `${pct}% right`].filter(Boolean).join(' · ')),
    h('p', { class: 'small muted', style: { marginTop: '6px' } },
      state.streak.current ? `Streak: ${plural(state.streak.current, 'day', 'days')}` : ''),
    h('div', { style: { marginTop: '32px' } },
      h('button', { class: 'btn btn-primary btn-block', onclick: exit }, 'Done'))));
}
