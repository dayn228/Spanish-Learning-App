/*
  Reader: one text.
  - Tap a word: meaning in this sentence, dictionary form, listen, add to my words.
  - Press and hold a sentence: its translation.
  - "Translation" shows the English under every paragraph.
  - "Listen" reads the whole text aloud, highlighting each sentence.
  - Questions at the end; finishing them counts as a session for the streak.
*/

import { state, addWordToLearn, saveReading, finishSession, saveGrammar } from '../state.js';
import { h, icon, ICONS, toast } from '../ui.js';
import { tokenize, lookup, deckIndex } from '../reading.js';
import { stage } from '../srs.js';
import { speak, speakSequence, stopSpeaking } from '../speech.js';
import { aiNote } from './report.js';

let showTranslation = false;
let stopReading = null;

export function textView(id) {
  const text = state.content.texts.find((t) => t.id === id);
  if (!text) return h('div', {}, h('a', { href: '#read', class: 'btn btn-soft' }, 'Back to Read'));
  const idx = deckIndex(state.content.words);
  const { common } = state.content;
  const sentences = [];          // flat list for listening
  const sentEls = [];

  const root = h('div', { class: 'reader' });
  const sheet = h('div', { class: 'sheet-wrap', hidden: true, onclick: (e) => { if (e.target === sheet) closeSheet(); } });

  function closeSheet() { sheet.hidden = true; sheet.replaceChildren(); }

  function openWord(token, es, en) {
    const r = lookup(token, text, common, idx);
    const st = r && r.wordId ? stage(state.cards[r.wordId]) : null;
    const queued = r && r.wordId && (state.settings.next || []).includes(r.wordId);
    const label = st === 'known' ? 'Known' : st === 'learning' ? 'Learning' : null;
    const addBtn = !r ? null
      : st === 'known' || st === 'learning' ? h('span', { class: 'state-pill' }, `In your words · ${label}`)
      : queued ? h('span', { class: 'state-pill' }, 'Coming up in your next session')
      : h('button', {
        class: 'btn btn-primary', onclick: () => {
          const base = /[+/]/.test(r.base) ? token.toLowerCase() : (r.deckEs || r.base);
          addWordToLearn({ es: base, en: r.en, ex: es, exEn: en, wordId: r.wordId });
          toast('Added. It comes first in your next session.');
          closeSheet();
          redrawWords();
        },
      }, r.wordId ? 'Learn this word next' : 'Add to my words');

    sheet.replaceChildren(h('div', { class: 'sheet', role: 'dialog', 'aria-label': `Meaning of ${token}` },
      h('div', { class: 'row between' },
        h('span', { class: 'es sheet-word', lang: 'es' }, token),
        h('button', { class: 'btn-icon', 'aria-label': 'Close', onclick: closeSheet }, icon(ICONS.close, 18))),
      r ? h('div', {},
        r.base.toLowerCase() !== token.toLowerCase() ? h('div', { class: 'small muted' }, 'from ', h('span', { class: 'es' }, r.base)) : null,
        h('div', { class: 'sheet-meaning' }, r.en),
        r.note ? h('div', { class: 'small muted' }, r.note) : null)
        : h('div', { class: 'sheet-meaning muted' }, 'No meaning saved for this word. The sentence translation is below.'),
      h('div', { class: 'row', style: { marginTop: '14px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-soft', onclick: () => speak(token) }, icon(ICONS.speaker, 18), 'Listen'),
        addBtn),
      h('div', { class: 'sheet-sentence' }, h('div', { lang: 'es' }, es), h('div', { class: 'muted small' }, en))));
    sheet.hidden = false;
  }

  function openSentence(es, en) {
    sheet.replaceChildren(h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Sentence translation' },
      h('div', { class: 'row between' }, h('span', { class: 'small muted' }, 'Sentence'),
        h('button', { class: 'btn-icon', 'aria-label': 'Close', onclick: closeSheet }, icon(ICONS.close, 18))),
      h('div', { class: 'sheet-sentence big', lang: 'es' }, es),
      h('div', { class: 'sheet-meaning' }, en),
      h('button', { class: 'btn btn-soft', style: { marginTop: '12px' }, onclick: () => speak(es) }, icon(ICONS.speaker, 18), 'Listen')));
    sheet.hidden = false;
  }

  function wordClass(token) {
    const r = lookup(token, text, common, idx);
    if (common[token.toLowerCase()]) return 'w';
    if (!r || !r.wordId) return 'w';
    const st = stage(state.cards[r.wordId]);
    return 'w ' + (st === 'new' ? 'new' : st === 'learning' ? 'learning' : '');
  }
  const wordButtons = [];
  function redrawWords() { for (const b of wordButtons) b.className = wordClass(b.textContent); }

  // Long press on a sentence (not on a quick tap) opens its translation.
  function longPress(el, fn) {
    let timer = null, fired = false;
    el.addEventListener('pointerdown', () => { fired = false; timer = setTimeout(() => { fired = true; fn(); }, 500); });
    ['pointerup', 'pointerleave', 'pointercancel', 'pointermove'].forEach((ev) => el.addEventListener(ev, (e) => {
      if (ev === 'pointermove' && Math.abs(e.movementX) + Math.abs(e.movementY) < 4) return;
      clearTimeout(timer);
    }));
    el.addEventListener('click', (e) => { if (fired) { e.stopPropagation(); e.preventDefault(); } }, true);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  const body = h('div', { class: 'reader-body' });
  for (const para of text.paragraphs) {
    const p = h('p', { class: 'reader-p', lang: 'es' });
    for (const [es, en] of para) {
      const sent = h('span', { class: 'sent' });
      for (const t of tokenize(es)) {
        if (!t.word) { sent.append(t.text); continue; }
        const b = h('button', { class: wordClass(t.text), onclick: () => openWord(t.text, es, en) }, t.text);
        wordButtons.push(b);
        sent.append(b);
      }
      longPress(sent, () => openSentence(es, en));
      sentences.push(es);
      sentEls.push(sent);
      p.append(sent, ' ');
    }
    body.append(p);
    if (showTranslation) body.append(h('p', { class: 'reader-en' }, para.map(([, en]) => en).join(' ')));
  }

  const listenBtn = h('button', { class: 'btn btn-soft', onclick: toggleListen }, icon(ICONS.speaker, 18), 'Listen');
  function toggleListen() {
    if (stopReading) { stopReading(); stopReading = null; return; }
    listenBtn.lastChild.textContent = 'Stop';
    stopReading = speakSequence(sentences, 0.85, (i) => {
      sentEls.forEach((el, j) => el.classList.toggle('speaking', j === i));
      if (i === -1) { stopReading = null; listenBtn.lastChild.textContent = 'Listen'; }
    });
  }

  root.append(...[
    h('a', { href: '#read', class: 'btn btn-ghost', style: { marginLeft: '-8px' }, onclick: () => { stopSpeaking(); stopReading = null; } }, icon(ICONS.back, 18), 'Read'),
    h('div', { class: 'small muted', style: { marginTop: '4px' } }, `${text.level} · ${text.en}`),
    h('h1', { lang: 'es', style: { marginTop: '2px' } }, text.title),
    h('div', { class: 'row', style: { marginTop: '16px', flexWrap: 'wrap' } },
      listenBtn,
      h('button', { class: 'chip', 'aria-pressed': String(showTranslation), onclick: () => { showTranslation = !showTranslation; rerender(); } }, 'Translation')),
    h('div', { class: 'legend tiny muted' },
      h('span', {}, h('span', { class: 'w learning' }, 'learning')), h('span', {}, h('span', { class: 'w new' }, 'new')), h('span', {}, 'plain = known or everyday')),
    body,
    text.source && /^https:\/\//.test(text.source.url || '') ? h('p', { class: 'small muted' }, `From ${text.source.name || 'the original article'}. `, h('a', { href: text.source.url, target: '_blank', rel: 'noopener' }, 'Read the original')) : null,
    text.practice ? h('p', { class: 'tiny muted' }, 'Written for practice; not a real news report.') : null,
    text.aiMade ? aiNote('text', text, null, () => { location.hash = '#read'; }) : null,
    questions(text),
    sheet,
  ].filter(Boolean));
  return root;
}

function questions(text) {
  const box = h('div', { class: 'card', style: { marginTop: '24px' } }, h('h2', {}, 'Did you understand?'));
  const answers = new Array(text.questions.length).fill(null);
  const done = state.reading[text.id]?.done;
  text.questions.forEach((q, qi) => {
    const opts = h('div', { class: 'options' });
    const btns = q.options.map((o, oi) => h('button', {
      class: 'option small-option', lang: 'es', onclick: () => {
        if (answers[qi] !== null) return;
        answers[qi] = oi === q.a;
        btns.forEach((b, j) => { b.disabled = true; if (j === q.a) b.classList.add('right'); });
        if (oi !== q.a) btns[oi].classList.add('wrong');
        if (answers.every((a) => a !== null)) finish();
      },
    }, o));
    opts.append(...btns);
    box.append(h('p', { class: 'es', lang: 'es', style: { marginTop: '18px', fontSize: '19px' } }, `${qi + 1}. ${q.q}`), opts);
  });
  const result = h('div', {});
  box.append(result);
  if (done) box.append(h('p', { class: 'tiny muted', style: { marginTop: '12px' } }, `Last time: ${state.reading[text.id].right} of ${state.reading[text.id].total} right.`));

  function finish() {
    const right = answers.filter(Boolean).length;
    saveReading(text.id, { done: true, right, total: answers.length });
    saveGrammar(true);   // counts towards today's activity
    finishSession();
    result.replaceChildren(h('div', { class: `feedback ${right === answers.length ? 'good' : 'close'}` },
      h('div', {}, h('b', {}, `${right} of ${answers.length} right.`),
        h('div', { class: 'small' }, right === answers.length ? 'Well read.' : 'Tap the words you were unsure of and add them to your words.'))));
  }
  return box;
}

function rerender() { import('../main.js').then((m) => m.render()); }
