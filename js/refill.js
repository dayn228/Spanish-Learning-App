/*
  Refill engine: notices when a pool of content is running low and writes
  requests for the backend, which asks Gemini overnight.

  Pools and when they count as low:
    grammar unit you are working on   fewer than 15 exercises still fresh
                                      (unseen, or not yet right twice in a row)
    focus word topic                  fewer than 20 words not started
    reading                           fewer than 3 unread texts
    construction texts                one new practice text every few days
                                      while construction is a focus topic

  Each request has a key; the same key is not sent again for 3 days, so a
  pool is never asked for twice while the first answer is still on its way.
*/

import { exerciseId } from './grammar.js';
import { stage } from './srs.js';

const DAY = 864e5;
const WAIT_DAYS = 3;
const NEWS_TOPICS = ['finance', 'economics', 'politics', 'news'];

/* Focus topics that get AI practice texts, and what those texts are about. */
const TEXT_ABOUT = {
  construction: 'everyday work at a window and glazing installation company in Spain: site visits, measuring, quotes, deliveries, clients, problems on site',
  music: 'pop music fan life: a stadium concert, getting tickets, friendship bracelets, a new album release, singing along with friends (no real artists, no lyrics)',
  fashion: 'clothes and style in Spain: shopping in the sales, choosing an outfit for a wedding or a night out, second-hand fashion',
  beauty: 'make-up, skincare and hair: a morning routine, getting ready for a concert with glitter, a visit to the hairdresser',
  sport: 'staying active: a first 10k race, gym and pilates classes, padel with friends, watching a match',
  selfcare: 'self-care and wellbeing: a slow Sunday, sleep, journaling, a spa weekend, setting boundaries at work',
  trips: 'holidays and short trips in Spain and Europe: flights, hotels, beaches, old towns, sunsets, getting lost',
  books: 'reading: a book club, a romance or fantasy novel, a cosy bookshop, a sequel and its adaptation',
};

export function computeRequests({ units = [], grammar = { units: {} }, words = [], topics = [], cards = {}, focus = [], texts = [], reading = {}, pending = {}, level = 'A1', now = Date.now() }) {
  const out = [];
  const waiting = (key) => pending[key] && now - pending[key] < WAIT_DAYS * DAY;
  const add = (req) => { if (!waiting(req.key)) out.push(req); };

  // What the learner cares about: the AI sets its example sentences there.
  const interests = focus.map((id) => (topics.find((t) => t.id === id) || {}).name).filter(Boolean);

  // Grammar: units you have started and not mastered, plus the next one.
  const nextUnit = units.find((u) => !(grammar.units[u.id] && grammar.units[u.id].mastered));
  for (const u of units) {
    const up = grammar.units[u.id];
    const active = (up && up.sets > 0 && !up.mastered) || u === nextUnit;
    if (!active) continue;
    const fresh = u.exercises.filter((ex) => { const s = up && up.seen[exerciseId(u.id, ex)]; return !s || s.streak < 2; });
    if (fresh.length >= 15) continue;
    const forms = (up && up.forms) || {};
    const weakTags = Object.entries(forms).filter(([, f]) => f.w > 0).sort((a, b) => b[1].w / (b[1].r + b[1].w) - a[1].w / (a[1].r + a[1].w)).slice(0, 3).map(([t]) => t);
    const learning = words.filter((w) => stage(cards[w.id]) === 'learning').slice(0, 20).map((w) => w.es);
    add({
      key: `exercises:${u.id}`, kind: 'exercises', unitId: u.id, unitTitle: u.title, level: u.level, n: 20,
      tags: [...new Set(u.exercises.flatMap((e) => e.tags || []))], weakTags,
      summary: u.summary, vocabulary: learning, interests,
      avoid: u.exercises.slice(-40).map((e) => e.q || e.a || '').filter(Boolean),
      samples: u.exercises.filter((e) => e.type !== 'table').slice(0, 4),
    });
  }

  // Words: focus topics that are running out of new words.
  for (const id of focus) {
    const t = topics.find((x) => x.id === id);
    if (!t || t.id === 'mine') continue;
    const list = words.filter((w) => w.topic === id);
    const unseen = list.filter((w) => stage(cards[w.id]) === 'new').length;
    if (unseen >= 20) continue;
    add({ key: `words:${id}`, kind: 'words', topicId: id, topicName: t.name, level: t.level || level, n: 30, existing: list.map((w) => w.es) });
  }

  // Reading: keep at least 3 unread texts.
  const unread = texts.filter((t) => !(reading[t.id] && reading[t.id].done)).length;
  if (unread < 3) {
    const newsTopics = focus.filter((f) => NEWS_TOPICS.includes(f));
    const ownTexts = focus.some((id) => TEXT_ABOUT[id]);
    if (newsTopics.length || !ownTexts) add({ key: 'news', kind: 'news', topics: newsTopics.length ? newsTopics : ['economics'], level, n: 2 });
  }
  // One practice text per sync about a focus topic (each topic waits its turn).
  const textTopic = focus.find((id) => TEXT_ABOUT[id] && !waiting(`text:${id}`));
  if (textTopic) add({ key: `text:${textTopic}`, kind: 'text', topic: textTopic, level, about: TEXT_ABOUT[textTopic] });
  return out;
}

/** The learner's rough level from mastered grammar units. */
export function estimateLevel(units, grammar) {
  const done = (lvl) => units.filter((u) => u.level === lvl).every((u) => grammar.units[u.id] && grammar.units[u.id].mastered);
  if (!done('A1')) return 'A1';
  if (!done('A2')) return 'A2';
  return done('B1') && units.some((u) => u.level === 'B1') ? 'B2' : 'B1';
}
