// "Made by AI · Report a problem": shown under AI-made words, exercises and texts.

import { h, toast } from '../ui.js';
import { reportItem } from '../sync.js';

const REASONS = ['Wrong answer', 'Bad Spanish', 'Wrong translation', 'Other problem'];

/**
 * @param kind     'exercise' | 'word' | 'text'
 * @param item     the exercise, word or text
 * @param unitId   for exercises
 * @param onHidden called after reporting (e.g. move to the next card)
 */
export function aiNote(kind, item, unitId, onHidden) {
  const box = h('div', {});
  const note = h('div', { class: 'ai-note' },
    h('span', {}, 'Made by AI'),
    h('button', {
      class: 'link', onclick: () => {
        box.replaceChildren(h('div', { class: 'report-box' },
          h('div', { class: 'small', style: { marginBottom: '8px' } }, 'What is wrong? It will be removed and reported.'),
          h('div', { class: 'chips' }, REASONS.map((r) => h('button', {
            class: 'chip', onclick: () => {
              reportItem(kind, item, r, unitId);
              toast('Thanks. Removed and reported.');
              if (onHidden) onHidden();
            },
          }, r)),
          h('button', { class: 'chip', onclick: () => box.replaceChildren() }, 'Cancel'))));
      },
    }, 'Report a problem'));
  return h('div', {}, note, box);
}
