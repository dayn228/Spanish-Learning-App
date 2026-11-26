// Today: greeting, streak week, session length, start button, continue a topic.

import { state, saveSettings } from '../state.js';
import { h, dots, plural } from '../ui.js';
import { buildSession, topicCounts } from '../session.js';
import { displayStreak } from '../streak.js';
import { dayKey, addDays } from '../dates.js';
import { stage } from '../srs.js';
import { startSession } from './study.js';

const MINUTES = [5, 15, 30, 60];

function greeting() {
  const hr = new Date().getHours();
  if (hr < 13) return 'Buenos días';
  if (hr < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

export function todayView() {
  const { words, topics } = state.content;
  const minutes = state.settings.minutes || 15;
  const plan = buildSession(words, state.cards, { minutes, focus: state.settings.focus });
  const today = dayKey();
  const doneToday = state.streak.lastDay === today;
  const streakNow = displayStreak(state.streak, today);

  const summary = plan.reviews.length || plan.fresh.length
    ? [plan.reviews.length && plural(plan.reviews.length, 'word to review', 'words to review'),
       plan.fresh.length && plural(plan.fresh.length, 'new word', 'new words')].filter(Boolean).join(' and ') + '.'
    : 'Nothing due. Pick a topic to learn new words.';

  const root = h('div', {},
    h('h1', {}, greeting()),
    h('p', { class: 'lead' }, doneToday ? 'Today counts. Anything more is a bonus.' : summary),

    h('div', { class: 'chips seg', style: { marginTop: '20px' }, role: 'group', 'aria-label': 'Session length' },
      MINUTES.map((m) => h('button', {
        class: 'chip', 'aria-pressed': String(m === minutes),
        onclick: () => { saveSettings({ minutes: m }); rerender(); },
      }, `${m} min`))),

    h('button', {
      class: 'btn btn-primary btn-block', style: { marginTop: '14px' },
      disabled: !(plan.reviews.length || plan.fresh.length),
      onclick: () => startSession({ ...plan, label: `${minutes}-minute session` }),
    }, plan.reviews.length ? 'Start review' : 'Start learning'),
  );

  // Continue a focus topic that isn't finished yet.
  const focusTopic = state.settings.focus
    .map((id) => topics.find((t) => t.id === id)).filter(Boolean)
    .map((t) => ({ t, list: words.filter((w) => w.topic === t.id) }))
    .find(({ list }) => list.some((w) => stage(state.cards[w.id]) !== 'known'));
  if (focusTopic) {
    const c = topicCounts(focusTopic.list, state.cards);
    root.append(h('div', { class: 'card', style: { marginTop: '24px' } },
      h('div', { class: 'row between', style: { alignItems: 'flex-start' } },
        h('div', { class: 'grow' },
          h('div', { class: 'small muted' }, 'Continue learning'),
          h('h2', { style: { marginTop: '4px' } }, focusTopic.t.name)),
        h('div', { style: { width: '96px', flex: 'none', paddingTop: '4px' } },
          dots(focusTopic.list.slice(0, 15).map((w) => stage(state.cards[w.id])), 5))),
      h('div', { class: 'row between', style: { marginTop: '16px' } },
        h('span', { class: 'small muted' }, `${c.known} of ${focusTopic.list.length} known`),
        h('a', { class: 'btn btn-secondary', href: `#topic/${focusTopic.t.id}` }, 'Continue'))));
  }

  root.append(weekPanel(today, streakNow));
  return root;
}

function weekPanel(today, streakNow) {
  // Monday-to-Sunday row with Spanish day initials.
  const letters = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const weekday = (new Date().getDay() + 6) % 7;      // 0 = Monday
  const monday = addDays(today, -weekday);
  const studied = new Set(Object.keys(state.log).filter((d) => state.log[d] > 0));
  const frozen = new Set(state.streak.frozenDays || []);
  const best = state.streak.best || 0;

  return h('div', { class: 'panel', style: { marginTop: '12px' } },
    h('div', { class: 'row between' },
      h('span', { style: { fontWeight: 600, fontSize: '16px' } }, 'This week'),
      h('span', { class: 'small muted' },
        streakNow ? `${plural(streakNow, 'day', 'days')} in a row` : 'Start a streak today',
        state.streak.freezes ? ` · ${plural(state.streak.freezes, 'freeze', 'freezes')}` : '')),
    h('div', { class: 'week' }, letters.map((l, i) => {
      const d = addDays(monday, i);
      const cls = ['day', studied.has(d) && 'studied', frozen.has(d) && 'freeze', d === today && 'today'].filter(Boolean).join(' ');
      return h('div', { class: cls, 'aria-label': `${d}${studied.has(d) ? ', studied' : ''}` }, h('span', {}), h('span', {}, l));
    })),
    best > streakNow ? h('p', { class: 'tiny muted', style: { marginTop: '12px' } }, `Best streak: ${plural(best, 'day', 'days')}`) : null,
  );
}

function rerender() {
  import('../main.js').then((m) => m.render());
}

