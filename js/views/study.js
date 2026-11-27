/*
  Study session: shows one card at a time.

  Card modes:
    intro      a new word: Spanish, English, example. "Got it" or "I already know this".
    choose-en  Spanish shown; pick the English from four options.
    choose-es  English shown; pick the Spanish from four options (once a word is familiar).
    produce    English shown; type the Spanish (for words you know well, and typing practice).

  A new word gets an intro, then a choose-en check three cards later.
  A missed word comes back three cards later (at most twice per session).
  Grading is automatic: right → Good (Easy if quick on a well-known word), wrong → Again.
*/

import { state, answer, knowIt, finishSession } from '../state.js';
import { h, icon, ICONS, toast, plural } from '../ui.js';
import { AGAIN, HARD, GOOD, EASY } from '../srs.js';
import { checkAnswer } from '../check.js';
import { speak, canSpeak } from '../speech.js';
import { startDrill } from './drill.js';
import { aiNote } from './report.js';

let session = null;

// Enter moves on after an answer (laptop keyboards).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !session || e.target.tagName === 'INPUT') return;
  const next = document.querySelector('#app .next-btn');
  if (next) { e.preventDefault(); next.click(); }
});

/** Start a session from a plan { reviews, fresh, label, returnTo, mode? } and open the study screen. */
export function startSession(plan) {
  if (!plan.reviews.length && !plan.fresh.length && plan.then) { startDrill(plan.then); return; }
  const queue = [];
  for (const id of plan.reviews) {
    const c = state.cards[id] || {};
    let mode = 'choose-en';
    if (plan.mode === 'produce' || (c.reps >= 3 && Math.random() < 0.35)) mode = 'produce';
    else if (c.reps >= 1 && Math.random() < 0.5) mode = 'choose-es';
    queue.push({ id, mode });
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
    label: plan.label || 'Session', returnTo: plan.returnTo || '#today', startedAt: Date.now(), then: plan.then || null,
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
    : choiceCard(word, item, next, item.mode === 'choose-es' ? 'es' : 'en');
  const note = word.aiMade ? aiNote('word', word, null, next) : null;
  root.replaceChildren(...[header(), ...view, note].filter(Boolean));
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
      h('button', { class: 'btn btn-primary btn-block', onclick: () => { session.learned += 1; insertLater({ id: word.id, mode: 'choose-en' }); next(); } }, 'Got it')),
  ];
}

/* ---------- multiple choice ---------- */

/** Three wrong options: same topic and part of speech first, then anything similar. */
function distractors(word, field) {
  const all = state.content.words;
  const norm = (x) => x.toLowerCase().replace(/[¿?¡!.]/g, '').trim();
  const taken = new Set([norm(word[field])]);
  const pick = (list) => {
    const out = [];
    for (const w of list.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((p) => p[1])) {
      if (out.length >= 3) break;
      const v = norm(w[field]);
      if (w.id === word.id || taken.has(v)) continue;
      taken.add(v);
      out.push(w[field]);
    }
    return out;
  };
  let out = pick(all.filter((w) => w.topic === word.topic && w.pos === word.pos));
  if (out.length < 3) out = out.concat(pick(all.filter((w) => w.topic === word.topic)).slice(0, 3 - out.length));
  if (out.length < 3) out = out.concat(pick(all.filter((w) => w.pos === word.pos)).slice(0, 3 - out.length));
  return out;
}

function choiceCard(word, item, next, answerIn) {
  const card = state.cards[word.id];
  const prompt = answerIn === 'en' ? word.es : word.en;
  const correct = answerIn === 'en' ? word.en : word.es;
  const options = [correct, ...distractors(word, answerIn)].map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  const shownAt = Date.now();
  const result = h('div', {});
  const actions = h('div', { class: 'study-actions' });
  const buttons = [];
  let done = false;
  if (answerIn === 'en') speak(word.es);

  const choose = (i) => {
    if (done) return;
    done = true;
    const right = options[i] === correct;
    buttons.forEach((b, j) => { b.disabled = true; if (options[j] === correct) b.classList.add('right'); });
    if (!right && i >= 0) buttons[i].classList.add('wrong');
    const quick = Date.now() - shownAt < 2500 && card && card.reps >= 2;
    const g = right ? (quick ? EASY : GOOD) : AGAIN;
    answer(word.id, g);
    session.answered += 1;
    if (right) session.right += 1; else retry(item);
    speak(word.es);
    result.replaceChildren(...[
      right ? null : h('div', { class: 'feedback bad' }, icon(ICONS.close, 20), h('div', {}, h('span', { class: 'es' }, word.es), ' = ', word.en, h('div', { class: 'small' }, 'It will come back soon.'))),
      word.ex ? h('p', { class: 'small', style: { marginTop: '14px' } }, word.ex, h('span', { class: 'muted', style: { display: 'block' } }, word.exEn)) : null].filter(Boolean));
    actions.replaceChildren(h('button', { class: 'btn btn-primary btn-block next-btn', onclick: next }, 'Next'));
  };

  const list = h('div', { class: 'options' }, options.map((o, i) => (buttons[i] = h('button', {
    class: 'option' + (answerIn === 'en' ? ' en' : ''), lang: answerIn, onclick: () => choose(i),
  }, o))));
  actions.append(h('button', { class: 'btn btn-ghost', style: { width: '100%' }, onclick: () => choose(-1) }, "I don't know"));

  return [
    h('div', { class: 'flashcard compact' },
      h('div', { class: 'kind' }, answerIn === 'en' ? 'What does it mean?' : 'How do you say it in Spanish?'),
      h('div', { class: answerIn === 'en' ? 'big' : 'big en-big', lang: answerIn === 'en' ? 'es' : 'en' }, prompt)),
    h('div', { class: 'study-tools' }, answerIn === 'en' ? speakButton(word.es) : h('span'), h('span')),
    list, result, actions,
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
    } else if (r === 'accent') {
      g = GOOD;
      box = h('div', { class: 'feedback good' }, icon(ICONS.check, 20), h('div', {},
        h('b', {}, 'Correct. '), 'Mind the accent: ', h('span', { class: 'es' }, word.es)));
    } else if (r === 'article' || r === 'accent-key') {
      // The article carries the gender, and some accents change the word: close, but not yet known.
      g = HARD;
      box = h('div', { class: 'feedback close' }, h('div', {},
        h('b', {}, r === 'article' ? 'Almost: check the article. ' : 'Almost: the accent changes the word. '), h('span', { class: 'es' }, word.es)));
    } else {
      g = AGAIN;
      box = h('div', { class: 'feedback bad' }, icon(ICONS.close, 20), h('div', {}, h('b', {}, 'Not quite. '), 'It is ', h('span', { class: 'es' }, word.es), '.'));
      retry(item);
    }
    answer(word.id, g);
    session.answered += 1;
    if (g !== AGAIN && g !== HARD) session.right += 1;
    speak(word.es);
    result.replaceChildren(...[box, word.ex ? h('p', { class: 'small', style: { marginTop: '12px' } }, word.ex, h('span', { class: 'muted', style: { display: 'block' } }, word.exEn)) : null].filter(Boolean));
    actions.replaceChildren(h('button', { class: 'btn btn-primary btn-block next-btn', onclick: next }, 'Next word'));
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
    actions.replaceChildren(h('button', { class: 'btn btn-primary btn-block next-btn', onclick: next }, 'Next word'));
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
  insertLater({ id: item.id, mode: 'choose-en' });
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
    session.then
      ? h('div', { style: { marginTop: '32px' } },
          h('button', { class: 'btn btn-primary btn-block', onclick: () => { const t = session.then; session = null; startDrill(t); } }, session.then.label || 'Continue to grammar'),
          h('button', { class: 'btn btn-ghost', style: { width: '100%', marginTop: '8px' }, onclick: exit }, 'Finish here'))
      : h('div', { style: { marginTop: '32px' } },
          h('button', { class: 'btn btn-primary btn-block', onclick: exit }, 'Done'))));
}
