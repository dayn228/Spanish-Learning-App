/*
  Streak: days in a row with at least one finished session.

  Forgiving rules:
  - Any session counts, even 5 minutes.
  - Every 7 days in a row earns a freeze (you can hold up to 2).
  - A missed day uses a freeze automatically, so the streak survives.
  - Your best streak is always kept.
*/

import { daysBetween } from './dates.js';

const FREEZE_EVERY = 7;
const MAX_FREEZES = 2;

export function newStreak() {
  return { current: 0, best: 0, lastDay: null, freezes: 0, sinceFreeze: 0, frozenDays: [] };
}

/** Call when a session finishes on day `today`. Returns the new streak state. */
export function recordSession(streak, today) {
  const s = { ...(streak || newStreak()), frozenDays: [...((streak && streak.frozenDays) || [])] };
  if (s.lastDay === today) return s;

  if (s.lastDay === null) {
    s.current = 1;
  } else {
    const gap = daysBetween(s.lastDay, today);
    const missed = gap - 1;
    if (gap <= 0) return s;                       // clock went backwards; ignore
    if (missed === 0) {
      s.current += 1;
    } else if (missed <= s.freezes) {
      s.freezes -= missed;
      for (let i = 1; i <= missed; i++) s.frozenDays.push(shift(s.lastDay, i));
      s.current += 1;
    } else {
      s.current = 1;
      s.sinceFreeze = 0;
    }
  }

  s.sinceFreeze += 1;
  if (s.sinceFreeze >= FREEZE_EVERY) {
    s.sinceFreeze = 0;
    s.freezes = Math.min(MAX_FREEZES, s.freezes + 1);
  }
  s.best = Math.max(s.best, s.current);
  s.frozenDays = s.frozenDays.slice(-30);
  s.lastDay = today;
  return s;
}

/**
 * The streak to show today, before today's session. It stays alive while the
 * missed days can still be covered by freezes.
 */
export function displayStreak(streak, today) {
  if (!streak || streak.lastDay === null) return 0;
  const missed = daysBetween(streak.lastDay, today) - 1;
  if (missed <= 0) return streak.current;
  return missed <= streak.freezes ? streak.current : 0;
}

function shift(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
