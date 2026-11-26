// You: progress, streak history, focus topics, backup and install help.

import { state, saveSettings, exportBackup, importBackup } from '../state.js';
import { h, toast, plural } from '../ui.js';
import { stage } from '../srs.js';
import { displayStreak } from '../streak.js';
import { dayKey, addDays } from '../dates.js';
import { isConnected, testConnection, syncNow, restoreFromDrive, getContentNow } from '../sync.js';

export function youView() {
  const { words, topics } = state.content;
  const today = dayKey();
  const started = words.filter((w) => stage(state.cards[w.id]) !== 'new').length;
  const known = words.filter((w) => stage(state.cards[w.id]) === 'known').length;
  const streak = displayStreak(state.streak, today);

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const max = Math.max(1, ...days.map((d) => state.log[d] || 0));

  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;

  return h('div', {},
    h('h1', {}, 'You'),

    h('div', { class: 'stats' },
      stat(streak, 'day streak'),
      stat(started, 'words started'),
      stat(known, 'words known')),
    h('p', { class: 'tiny muted', style: { marginTop: '8px' } },
      `Best streak ${plural(state.streak.best || 0, 'day', 'days')} · ${plural(state.streak.freezes || 0, 'freeze', 'freezes')} saved (one earned every 7 days in a row)`),

    h('h2', { class: 'section-title' }, 'Last 14 days'),
    h('div', { class: 'history', role: 'img', 'aria-label': 'Answers per day over the last 14 days' },
      days.map((d) => {
        const n = state.log[d] || 0;
        return h('i', { class: d === today ? 'today' : n ? 'on' : '', style: { height: `${Math.max(6, Math.round((n / max) * 56))}px` }, title: `${d}: ${n}` });
      })),

    h('h2', { class: 'section-title' }, 'Focus topics'),
    h('p', { class: 'small muted' }, 'About 70% of new words come from these.'),
    h('div', {}, topics.filter((t) => t.kind === 'pack').map((t) => {
      const id = `f-${t.id}`;
      return h('div', { class: 'toggle-row' },
        h('label', { for: id }, t.name),
        h('input', {
          id, type: 'checkbox', class: 'switch', checked: state.settings.focus.includes(t.id),
          onchange: (e) => saveSettings({ focus: e.target.checked ? [...state.settings.focus, t.id] : state.settings.focus.filter((f) => f !== t.id) }),
        }));
    })),

    cloudCard(),
    backupCard(),

    isStandalone ? null : h('div', { class: 'panel', style: { marginTop: '12px' } },
      h('h3', {}, 'Install on your iPhone'),
      h('p', { class: 'small', style: { marginTop: '6px' } }, 'In Safari, tap Share, then "Add to Home Screen". The app then opens full screen and works offline.')),
  );
}

function stat(n, label) {
  return h('div', {}, h('b', {}, String(n)), h('span', { class: 'small muted' }, label));
}

function backupCard() {
  const fileInput = h('input', {
    type: 'file', accept: 'application/json,.json', style: { display: 'none' },
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await importBackup(await file.text());
        toast('Backup restored');
        import('../main.js').then((m) => m.render());
      } catch (err) {
        toast(err.message);
      }
    },
  });

  const exportIt = async () => {
    const name = `mi-espanol-backup-${dayKey()}.json`;
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    // On iPhone the share sheet lets you save to Files or Google Drive.
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Mi Español backup' }); saveSettings({ lastExport: new Date().toISOString() }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    saveSettings({ lastExport: new Date().toISOString() });
  };

  const last = state.settings.lastExport ? new Date(state.settings.lastExport).toLocaleDateString() : 'never';
  return h('div', { class: 'card' },
    h('h2', {}, 'Backup file'),
    h('p', { class: 'small muted', style: { marginTop: '6px' } },
      `Save a backup file to Files, or restore one. Last saved: ${last}.`),
    h('div', { class: 'row', style: { marginTop: '14px', flexWrap: 'wrap' } },
      h('button', { class: 'btn btn-primary', onclick: exportIt }, 'Save backup'),
      h('button', { class: 'btn btn-secondary', onclick: () => fileInput.click() }, 'Restore from file')),
    fileInput);
}

/* ---------- Google Drive and AI ---------- */

const SETUP_GUIDE = 'https://github.com/dayn228/Spanish-Learning-App/blob/main/docs/SETUP-BACKEND.md';

function when(ms) {
  if (!ms) return 'never';
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return new Date(ms).toLocaleDateString();
}

function cloudCard() {
  const card = h('div', { class: 'card', style: { marginTop: '28px' } }, h('h2', {}, 'Google Drive and AI'));

  if (!isConnected()) {
    const url = h('input', { class: 'text-field', id: 'be-url', type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', autocomplete: 'off', autocapitalize: 'none' });
    const token = h('input', { class: 'text-field', id: 'be-token', type: 'text', placeholder: 'Token from setup()', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
    const msg = h('p', { class: 'small', role: 'status' });
    const connect = async () => {
      if (!url.value.trim() || !token.value.trim()) { msg.textContent = 'Paste both the web app URL and the token.'; return; }
      msg.textContent = 'Connecting…';
      try {
        const r = await testConnection(url.value, token.value);
        saveSettings({ backend: { url: url.value.trim(), token: token.value.trim() } });
        msg.textContent = r.ai ? 'Connected. AI content is on.' : 'Connected. Add GEMINI_API_KEY in Script Properties to turn on AI content.';
        await syncNow({ forceBackup: true });
        import('../main.js').then((m) => m.render());
      } catch (e) {
        msg.textContent = `Could not connect: ${e.message} Check the URL ends in /exec and the token is complete.`;
      }
    };
    card.append(
      h('p', { class: 'small muted', style: { marginTop: '6px' } }, 'Connect your own Apps Script backend to back up progress to Google Drive automatically and get new words, exercises and real news texts made overnight.'),
      h('label', { for: 'be-url', class: 'field-label' }, 'Web app URL'), url,
      h('label', { for: 'be-token', class: 'field-label' }, 'Token'), token,
      h('div', { class: 'row', style: { marginTop: '14px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-primary', onclick: connect }, 'Connect'),
        h('a', { class: 'btn btn-ghost', href: SETUP_GUIDE, target: '_blank', rel: 'noopener' }, 'Setup guide')),
      msg);
    return card;
  }

  const s = state.sync;
  const aiCount = Object.values(state.extra.words || {}).reduce((a, l) => a + l.length, 0)
    + Object.values(state.extra.exercises || {}).reduce((a, l) => a + l.length, 0) + (state.extra.texts || []).length;
  const msg = h('p', { class: 'small', role: 'status' }, s.lastError ? `Last sync failed: ${s.lastError}` : '');
  const busy = (label, fn) => async (e) => {
    const b = e.currentTarget; const old = b.textContent;
    b.disabled = true; b.textContent = label;
    try { await fn(); } catch (err) { msg.textContent = err.message; }
    finally { b.disabled = false; b.textContent = old; }
  };

  card.append(
    h('div', { class: 'status-list' },
      h('div', {}, h('span', { class: 'muted' }, 'Backup to Drive'), h('span', {}, when(s.lastBackup))),
      h('div', {}, h('span', { class: 'muted' }, 'Last sync'), h('span', {}, when(s.lastSync))),
      h('div', {}, h('span', { class: 'muted' }, 'AI-made items'), h('span', {}, String(aiCount))),
      h('div', {}, h('span', { class: 'muted' }, 'Waiting to be made'), h('span', {}, String(Object.keys(s.pending || {}).filter((k) => Date.now() - s.pending[k] < 3 * 864e5).length)))),
    msg,
    h('div', { class: 'row', style: { marginTop: '14px', flexWrap: 'wrap' } },
      h('button', { class: 'btn btn-primary', onclick: busy('Syncing…', async () => { const r = await syncNow({ forceBackup: true }); msg.textContent = r ? `Synced. ${r.added} new items.` : 'Offline: try again when online.'; }) }, 'Sync now'),
      h('button', { class: 'btn btn-secondary', onclick: busy('Making content…', async () => { msg.textContent = 'This takes a few minutes. You can keep studying.'; const r = await getContentNow(); msg.textContent = `Done: ${r.made || 0} new items made.`; }) }, 'Get new content now')),
    h('div', { class: 'row', style: { marginTop: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn btn-ghost', onclick: busy('Restoring…', async () => { const at = await restoreFromDrive(); toast(`Restored the backup from ${new Date(at).toLocaleString()}`); import('../main.js').then((m) => m.render()); }) }, 'Restore from Drive'),
      h('button', { class: 'btn btn-ghost', onclick: () => { saveSettings({ backend: null }); import('../main.js').then((m) => m.render()); } }, 'Disconnect')),
    h('p', { class: 'tiny muted', style: { marginTop: '10px' } }, 'On the free Gemini tier, Google may use what is sent to improve its products. Only learning content is sent, never your progress.'));
  return card;
}
