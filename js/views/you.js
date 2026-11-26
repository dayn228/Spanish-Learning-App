// You: progress, streak history, focus topics, backup and install help.

import { state, saveSettings, exportBackup, importBackup } from '../state.js';
import { h, toast, plural } from '../ui.js';
import { stage } from '../srs.js';
import { displayStreak } from '../streak.js';
import { dayKey, addDays } from '../dates.js';

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
  return h('div', { class: 'card', style: { marginTop: '28px' } },
    h('h2', {}, 'Back up your progress'),
    h('p', { class: 'small muted', style: { marginTop: '6px' } },
      `Save a backup file to Files or Google Drive. Automatic Drive backup comes in phase 4. Last download: ${last}.`),
    h('div', { class: 'row', style: { marginTop: '14px', flexWrap: 'wrap' } },
      h('button', { class: 'btn btn-primary', onclick: exportIt }, 'Save backup'),
      h('button', { class: 'btn btn-secondary', onclick: () => fileInput.click() }, 'Restore from file')),
    fileInput);
}
