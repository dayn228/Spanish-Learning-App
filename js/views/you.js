// You: progress, streak history, focus topics, backup and install help.

import { state, saveSettings, exportBackup, importBackup } from '../state.js';
import { h, toast, plural } from '../ui.js';
import { stage } from '../srs.js';
import { displayStreak } from '../streak.js';
import { dayKey, addDays } from '../dates.js';
import { THEMES, applyTheme } from '../theme.js';
import { loadPhoto, savePhoto, photoFromFile } from '../backdrop.js';
import { parsePasted, checkPack } from '../importpack.js';
import { isConnected, testConnection, syncNow, restoreFromDrive, getContentNow, listDriveBackups, progressOf, keepPhoneProgress, call } from '../sync.js';

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

    appearance(),
    cloudCard(),
    isConnected() ? importCard() : null,
    backupCard(),

    isStandalone ? null : h('div', { class: 'panel', style: { marginTop: '12px' } },
      h('h3', {}, 'Install on your iPhone'),
      h('p', { class: 'small', style: { marginTop: '6px' } }, 'In Safari, tap Share, then "Add to Home Screen". The app then opens full screen and works offline.')),
  );
}

function confirmKeep() {
  return window.confirm('Replace the Drive backup with this phone\'s progress? The daily copies in Drive stay, so you can still go back to an older day.');
}

function stat(n, label) {
  return h('div', {}, h('b', {}, String(n)), h('span', { class: 'small muted' }, label));
}

/* Paste exercises, words or texts made in ChatGPT (prompt: docs/prompts/chatgpt-content.md). */
function importCard() {
  const box = h('textarea', { class: 'paste-box', rows: '5', placeholder: 'Paste ChatGPT\'s answer here (the JSON)', 'aria-label': 'Content pack' });
  const everyone = h('input', { type: 'checkbox', class: 'switch', id: 'imp-all' });
  const out = h('div', { role: 'status' });
  let checked = null;
  const check = () => {
    checked = null;
    try {
      const r = checkPack(parsePasted(box.value), state.content.units);
      const total = r.counts.exercises + r.counts.words + r.counts.texts;
      out.replaceChildren(
        h('p', { class: 'small' }, `Ready: ${r.counts.exercises} exercises, ${r.counts.words} words, ${r.counts.texts} texts.`),
        r.problems.length ? h('details', { class: 'small muted' }, h('summary', {}, `${r.problems.length} left out`), h('ul', {}, r.problems.slice(0, 30).map((x) => h('li', {}, x)))) : null,
        total ? h('button', { class: 'btn btn-primary', onclick: add }, 'Add to the app') : null);
      checked = total ? r.pack : null;
    } catch (e) { out.replaceChildren(h('p', { class: 'small' }, e.message)); }
  };
  const add = async (e) => {
    if (!checked) return;
    const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Adding…';
    try {
      const r = await call('content.add', { pack: checked, forEveryone: everyone.checked });
      const note = `Added ${r.added.exercises} exercises, ${r.added.words} words, ${r.added.texts} texts`;
      box.value = ''; checked = null;
      out.replaceChildren(h('p', { class: 'small' }, `${note}. They are in Practice, Topics and Read now.`));
      toast(note);            // the sync below redraws this screen
      await syncNow();
    } catch (err) { btn.disabled = false; btn.textContent = 'Add to the app'; out.append(h('p', { class: 'small' }, err.message)); }
  };
  return h('div', { class: 'card', style: { marginTop: '14px' } },
    h('h3', {}, 'Add content from ChatGPT'),
    h('p', { class: 'small muted' }, 'Paste a content pack made with the prompt in the app\'s docs. Everything is checked first; anything broken is left out.'),
    box,
    h('label', { class: 'row-between', for: 'imp-all' }, h('span', {}, 'Also for the other learner'), everyone),
    h('button', { class: 'btn btn-ghost', onclick: check }, 'Check'),
    out);
}

function backupCard() {
  const status = h('p', { class: 'small', role: 'status', style: { marginTop: '10px' } });
  const version = h('p', { class: 'tiny muted', style: { marginTop: '10px' } });
  // The app version is the name of the offline cache (see sw.js); handy when checking an update arrived.
  caches?.keys?.().then((keys) => { const k = keys.find((x) => x.startsWith('mi-espanol-')); if (k) version.textContent = `App version ${k.slice(11, 18)}`; }).catch(() => {});
  const fileInput = h('input', {
    type: 'file', accept: '.json,application/json,text/plain', style: { display: 'none' },
    onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';           // so picking the same file again still works
      if (!file) return;
      status.textContent = `Reading ${file.name}…`;
      try {
        await importBackup(await file.text());
        toast('Backup restored');
        import('../main.js').then((m) => m.render());
      } catch (err) {
        status.textContent = err.message;   // stays on screen, unlike a toast
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
    fileInput, status, version);
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
        state.sync.user = r.user || 'owner'; state.sync.name = r.name || '';
        msg.textContent = r.ai ? 'Connected. AI content is on.' : 'Connected. Add GEMINI_API_KEY in Script Properties to turn on AI content.';
        // A fresh or reset phone: bring the progress back from Drive before anything is uploaded.
        const mine = progressOf(JSON.parse(exportBackup()));
        const drive = await call('backup.load').catch(() => ({}));
        if (drive.data && progressOf(drive.data) > mine && mine < 20) {
          await restoreFromDrive();
          toast('Your progress was restored from Drive');
        }
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

  const rerender = () => import('../main.js').then((m) => m.render());
  const held = s.held ? h('div', { class: 'notice' },
    h('b', {}, 'Drive has more progress than this phone'),
    h('p', { class: 'small' }, `The backup in Drive (${when(Date.parse(s.held.driveSavedAt))}) has ${s.held.driveProgress} answers and cards; this phone has ${s.held.phoneProgress}. Backups are paused so nothing is lost.`),
    h('div', { class: 'row-gap' },
      h('button', { class: 'btn btn-primary', onclick: busy('Restoring…', async () => { await restoreFromDrive(); toast('Progress restored from Drive'); rerender(); }) }, 'Restore from Drive'),
      h('button', { class: 'btn btn-ghost', onclick: busy('Saving…', async () => { if (confirmKeep()) { await keepPhoneProgress(); rerender(); } }) }, 'Keep this phone'))) : null;
  const picker = h('div', { class: 'backup-list' });
  const showBackups = busy('Loading…', async () => {
    const list = await listDriveBackups();
    if (!list.length) { msg.textContent = 'There is no backup in Drive yet.'; return; }
    picker.replaceChildren(
      h('p', { class: 'small muted' }, 'Pick a backup to restore. One copy is kept per day for two weeks.'),
      ...list.map((b) => h('button', {
        class: 'btn btn-ghost backup-opt',
        onclick: busy('Restoring…', async () => {
          await restoreFromDrive(b.name === 'latest.json' ? null : b.name);
          toast(`Restored: ${b.label}`); rerender();
        }),
      }, b.label)));
  });

  card.append(
    held,
    h('div', { class: 'status-list' },
      h('div', {}, h('span', { class: 'muted' }, 'Signed in as'), h('span', {}, s.name || s.user || 'owner')),
      h('div', {}, h('span', { class: 'muted' }, 'Backup to Drive'), h('span', {}, when(s.lastBackup))),
      h('div', {}, h('span', { class: 'muted' }, 'Last sync'), h('span', {}, when(s.lastSync))),
      h('div', {}, h('span', { class: 'muted' }, 'AI-made items'), h('span', {}, String(aiCount))),
      h('div', {}, h('span', { class: 'muted' }, 'Waiting to be made'), h('span', {}, String(Object.keys(s.pending || {}).filter((k) => Date.now() - s.pending[k] < 3 * 864e5).length)))),
    msg,
    h('div', { class: 'row', style: { marginTop: '14px', flexWrap: 'wrap' } },
      h('button', { class: 'btn btn-primary', onclick: busy('Syncing…', async () => { const r = await syncNow({ forceBackup: true }); msg.textContent = r ? `Synced. ${r.added} new items.` : 'Offline: try again when online.'; }) }, 'Sync now'),
      h('button', { class: 'btn btn-secondary', onclick: busy('Making content…', async () => { msg.textContent = 'This takes a few minutes. You can keep studying.'; const r = await getContentNow(); msg.textContent = `Done: ${r.made || 0} new items made.`; }) }, 'Get new content now')),
    h('div', { class: 'row', style: { marginTop: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn btn-ghost', onclick: showBackups }, 'Restore from Drive…'),
      h('button', { class: 'btn btn-ghost', onclick: () => { saveSettings({ backend: null }); state.sync.user = null; state.sync.name = null; import('../main.js').then((m) => m.render()); } }, 'Disconnect')),
    picker,
    h('p', { class: 'tiny muted', style: { marginTop: '10px' } }, 'On the free Gemini tier, Google may use what is sent to improve its products. Only learning content is sent, never your progress.'));
  return card;
}

/* ---------- Appearance ---------- */

function appearance() {
  const current = state.settings.theme || 'auto';
  return h('div', {},
    h('h2', { class: 'section-title' }, 'Appearance'),
    h('div', { class: 'themes', role: 'group', 'aria-label': 'Theme' }, THEMES.map((t) => h('button', {
      class: 'theme-opt', 'aria-pressed': String(current === t.id),
      onclick: (e) => {
        saveSettings({ theme: t.id });
        applyTheme(t.id, { animate: true });
        // Update the picker in place: a full re-render would skip the fade.
        e.currentTarget.parentNode.querySelectorAll('.theme-opt').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
      },
    },
      h('span', { class: 'sw', 'aria-hidden': 'true' }, t.swatch.map((c) => h('i', { style: { background: c } }))),
      h('b', {}, t.name),
      h('small', {}, t.note)))),
    photoCard());
}

function photoCard() {
  const photo = loadPhoto();
  const msg = h('p', { class: 'small muted', role: 'status' });
  const file = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
  const rerender = () => import('../main.js').then((m) => m.render());
  file.addEventListener('change', async () => {
    if (!file.files[0]) return;
    msg.textContent = 'Preparing the photo…';
    try { savePhoto(await photoFromFile(file.files[0])); rerender(); }
    catch (e) { msg.textContent = e.message; }
  });
  const body = [
    h('h3', {}, 'Background photo'),
    h('p', { class: 'small muted' }, 'Pick any picture from your phone. It stays on this phone only: it is not uploaded or backed up.'),
    file,
  ];
  if (!photo) {
    body.push(h('button', { class: 'btn btn-ghost', onclick: () => file.click() }, 'Choose a photo'));
  } else {
    const veil = h('input', { type: 'range', min: '0.35', max: '0.9', step: '0.05', value: String(photo.veil ?? 0.72), 'aria-label': 'How much the photo shows' });
    veil.addEventListener('input', () => savePhoto({ ...loadPhoto(), veil: Number(veil.value) }));
    const match = h('input', { type: 'checkbox', class: 'switch', checked: photo.matchAccent !== false, disabled: !photo.accent });
    match.addEventListener('change', () => savePhoto({ ...loadPhoto(), matchAccent: match.checked }));
    body.push(
      h('div', { class: 'photo-preview', style: { backgroundImage: `url("${photo.src}")` } }),
      h('label', { class: 'small' }, 'Photo shows more ↔ text stands out more', veil),
      h('label', { class: 'row-between' }, h('span', {}, photo.accent ? 'Accent colour from the photo' : 'No clear colour in this photo'), match),
      h('div', { class: 'row-gap' },
        h('button', { class: 'btn btn-ghost', onclick: () => file.click() }, 'Change photo'),
        h('button', { class: 'btn btn-ghost', onclick: () => { savePhoto(null); rerender(); } }, 'Remove')));
  }
  body.push(msg);
  return h('div', { class: 'card', style: { marginTop: '14px' } }, ...body);
}
