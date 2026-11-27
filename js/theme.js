/*
  Themes: Ivory (default), Daylight, Charcoal, Midnight, Swiftie, or Auto
  (Ivory by day, Charcoal when the phone is in dark mode).
  Colours live in css/themes.css. The choice is also kept in localStorage so
  index.html can apply it before the app loads (no white flash at night).
*/

export const THEMES = [
  { id: 'auto', name: 'Auto', note: 'Follows your phone', swatch: ['#FAF9F5', '#1C1B1A', '#D97757'] },
  { id: 'ivory', name: 'Ivory', note: 'Warm and light', swatch: ['#FAF9F5', '#141413', '#D97757'] },
  { id: 'daylight', name: 'Daylight', note: 'Bright and crisp', swatch: ['#F7F7F5', '#15171A', '#2F6FDE'] },
  { id: 'charcoal', name: 'Charcoal', note: 'Warm dark', swatch: ['#1C1B1A', '#F0EEE6', '#E3916F'] },
  { id: 'midnight', name: 'Midnight', note: 'Deep blue', swatch: ['#0E1525', '#EDF1F9', '#F2B65A'] },
  { id: 'swiftie', name: 'Swiftie', note: 'Lavender night, with sparkle', swatch: ['#1B1530', '#F7F0FF', '#F29CCB'] },
];

const BG = { ivory: '#FAF9F5', daylight: '#F7F7F5', charcoal: '#1C1B1A', midnight: '#0E1525', swiftie: '#1B1530' };
const dark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

export function resolve(id) {
  if (!id || id === 'auto') return dark() ? 'charcoal' : 'ivory';
  return BG[id] ? id : 'ivory';
}

export function applyTheme(id) {
  const t = resolve(id);
  if (t === 'ivory') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[t]);
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', ['ivory', 'daylight'].includes(t) ? 'default' : 'black');
  try { localStorage.setItem('mi-espanol-theme', id || 'auto'); } catch { /* private mode */ }
}

/** Re-apply when the phone switches between light and dark (for Auto). */
export function watchSystemTheme(getChoice) {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if ((getChoice() || 'auto') === 'auto') applyTheme('auto');
  });
}
