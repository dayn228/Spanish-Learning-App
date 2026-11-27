/*
  Themes: Ivory (default), Daylight, Blush, Charcoal, Midnight, Sparkle, or Auto
  (Ivory by day, Charcoal when the phone is in dark mode).
  Colours live in css/themes.css. The choice is also kept in localStorage so
  index.html can apply it before the app loads (no white flash at night).
*/

export const THEMES = [
  { id: 'auto', name: 'Auto', note: 'Follows your phone', swatch: ['#FAF9F5', '#1C1B1A', '#D97757'] },
  { id: 'ivory', name: 'Ivory', note: 'Warm and light', swatch: ['#FAF9F5', '#141413', '#D97757'] },
  { id: 'daylight', name: 'Daylight', note: 'Bright and crisp', swatch: ['#F7F7F5', '#15171A', '#2F6FDE'] },
  { id: 'blush', name: 'Blush', note: 'Soft pink and rose', swatch: ['#FBF1F2', '#2A1A22', '#C2416B'] },
  { id: 'charcoal', name: 'Charcoal', note: 'Warm dark', swatch: ['#1C1B1A', '#F0EEE6', '#E3916F'] },
  { id: 'midnight', name: 'Midnight', note: 'Deep blue', swatch: ['#0E1525', '#EDF1F9', '#F2B65A'] },
  { id: 'swiftie', name: 'Sparkle', note: 'Lavender night, glitter, pink', swatch: ['#1B1530', '#F7F0FF', '#F29CCB'] },
];

const BG = { ivory: '#FAF9F5', daylight: '#F7F7F5', blush: '#FBF1F2', charcoal: '#1C1B1A', midnight: '#0E1525', swiftie: '#1B1530' };
const dark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

export function resolve(id) {
  if (!id || id === 'auto') return dark() ? 'charcoal' : 'ivory';
  return BG[id] ? id : 'ivory';
}

const FADE_MS = 900;

export function applyTheme(id, { animate = false } = {}) {
  const t = resolve(id);
  const root = document.documentElement;
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (animate && !calm) {
    root.classList.add('theme-fade');
    clearTimeout(applyTheme.timer);
    applyTheme.timer = setTimeout(() => root.classList.remove('theme-fade'), FADE_MS + 100);
  }
  if (t === 'ivory') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[t]);
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', ['ivory', 'daylight', 'blush'].includes(t) ? 'default' : 'black');
  try { localStorage.setItem('mi-espanol-theme', id || 'auto'); } catch { /* private mode */ }
}

/** Re-apply when the phone switches between light and dark (for Auto). */
export function watchSystemTheme(getChoice) {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if ((getChoice() || 'auto') === 'auto') applyTheme('auto');
  });
}
