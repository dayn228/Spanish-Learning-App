/*
  App start and navigation.

  Screens are chosen by the part of the address after '#':
    #today  #topics  #topic/<id>  #study  #practice  #grammar/<id>  #drill  #read  #text/<id>  #you
  Each screen is a function in js/views/ that returns an element.
*/

import { state, loadState } from './state.js';
import { loadContent, applyCustom } from './content.js';
import { requestPersistence } from './db.js';
import { h, icon, ICONS } from './ui.js';
import { todayView } from './views/today.js';
import { topicsView } from './views/topics.js';
import { topicView } from './views/topic.js';
import { studyView } from './views/study.js';
import { practiceView } from './views/practice.js';
import { youView } from './views/you.js';
import { drillView } from './views/drill.js';
import { unitView } from './views/unit.js';
import { readView } from './views/read.js';
import { textView } from './views/text.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');

const TABS = [
  ['today', 'Today'], ['topics', 'Topics'], ['practice', 'Practice'], ['read', 'Read'], ['you', 'You'],
];

function renderNav(current, hidden) {
  nav.hidden = hidden;
  nav.replaceChildren(h('div', { class: 'nav-inner' },
    TABS.map(([id, label]) => h('a', { href: '#' + id, 'aria-current': current === id ? 'page' : null }, icon(ICONS[id]), label))));
}

export function render() {
  const [route, arg] = (location.hash.slice(1) || 'today').split('/');
  let view, tab = route, fullScreen = false;
  switch (route) {
    case 'topics': view = topicsView(); break;
    case 'topic': view = topicView(decodeURIComponent(arg || '')); tab = 'topics'; break;
    case 'study': view = studyView(); fullScreen = true; break;
    case 'practice': view = practiceView(); break;
    case 'grammar': view = unitView(decodeURIComponent(arg || '')); tab = 'practice'; break;
    case 'drill': view = drillView(); fullScreen = true; break;
    case 'you': view = youView(); break;
    case 'read': view = readView(); break;
    case 'text': view = textView(decodeURIComponent(arg || '')); tab = 'read'; break;
    default: view = todayView(); tab = 'today';
  }
  app.classList.toggle('no-nav', fullScreen);
  app.replaceChildren(view);
  renderNav(tab, fullScreen);
  window.scrollTo(0, 0);
}

export function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

async function start() {
  app.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
  try {
    const [content] = await Promise.all([loadContent(), loadState()]);
    state.content = content;
    applyCustom(content, state.custom);
  } catch (e) {
    app.replaceChildren(h('div', { class: 'card' },
      h('h2', {}, 'The word lists did not load'),
      h('p', { class: 'lead' }, 'Open the app once while online so it can save everything for offline use.'),
      h('p', { class: 'tiny muted', style: { marginTop: '12px' } }, String(e))));
    return;
  }
  window.addEventListener('hashchange', render);
  render();
  requestPersistence();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
  }
}

start();
