# Architecture

How the app is put together. For content formats see [CONTENT.md](CONTENT.md); for
deploying and running it see [OPERATIONS.md](OPERATIONS.md).

## The big picture

```
 iPhone (home-screen web app)                         Owner's Google account
 ┌──────────────────────────────────┐                ┌───────────────────────────────┐
 │ index.html + js/ + css/ + data/  │   HTTPS POST   │ Apps Script web app (/exec)    │
 │ cached offline by sw.js          │ ─────────────▶ │ backend/src/*.gs               │
 │                                  │  text/plain    │  ├ Drive folder "Mi Español"   │
 │ IndexedDB: progress, AI content  │  + token       │  │   backups, content, inbox   │
 │ localStorage: theme, photo       │ ◀───────────── │  └ nightly trigger 03:00 ──▶ Gemini API
 └──────────────────────────────────┘    JSON        └───────────────────────────────┘
        ▲ served by GitHub Pages (public)
```

- The app works fully offline. The backend is optional: without it there is no Drive
  backup and no AI content, but everything else works.
- The phone never talks to Gemini. The Gemini key lives only in Script Properties.
- Requests are `POST` with `Content-Type: text/plain` (avoids a CORS preflight, which
  Apps Script cannot answer). The body is JSON with `token` and `action`.

## Front end

Plain ES modules loaded by `index.html`. No framework: views build DOM with the tiny
`h(tag, props, ...children)` helper in `js/ui.js`. Every screen re-renders from `state`.

### Start-up (`js/main.js`)
1. Load content (`js/content.js`) and saved state (`js/state.js`) in parallel.
2. Apply theme (`js/theme.js`) and background photo (`js/backdrop.js`).
3. `refreshContent()` merges base content, AI extras and the learner's own words.
4. Render the route, register the service worker, schedule a sync.

`index.html` has a small inline script that applies the saved theme before first paint.

### Routes (hash based)

| Hash | View file | What |
|---|---|---|
| `#today` | `views/today.js` | greeting, session length, start, streak week, today's reading |
| `#topics`, `#topic/<id>` | `topics.js`, `topic.js` | choose focus topics, word lists |
| `#study` | `study.js` | a word session (full screen) |
| `#practice` | `practice.js` | mistakes, listening, verb trainer, grammar units |
| `#grammar/<unitId>` | `unit.js` | a unit's explanation and buttons |
| `#drill` | `drill.js` | any exercise set (practice, test-out, review, verbs, mistakes, listening) |
| `#read`, `#text/<id>` | `read.js`, `text.js` | text list, the reader |
| `#you` | `you.js` | stats, focus, appearance, photo, Drive and AI, backup file |

### Modules (`js/`)

| File | Role |
|---|---|
| `state.js` | the in-memory `state`, save functions, `exportBackup` / `importBackup` |
| `db.js` | IndexedDB key-value store (falls back to memory) |
| `content.js` | loads `data/`, word ids, `rebuild(content, custom, extra)` |
| `session.js` | turns minutes into a queue: due reviews first, then new words (70% focus topics) |
| `srs.js` | spaced repetition (grades 0–3, ease, interval; known at ≥ 21 days) |
| `streak.js` | forgiving streak with freezes (one per 7 days, hold 2) |
| `check.js` | answer checking: normalising, alternatives `a / b`, accent and article leniency |
| `exercise.js` | renders and scores every exercise type |
| `grammar.js` | unit mastery, weak tags, retiring exercises, reviews, verb trainer and mistakes picking |
| `verbs.js` | conjugation engine: present, preterite, imperfect |
| `listening.js` | "which word did you hear", dictation, minimal pairs |
| `reading.js` | tokenising texts, word lookup (glossary → common → deck, plurals), known share |
| `refill.js` | decides what to ask the backend for, and the learner's level estimate |
| `sync.js` | backend calls: ping, requests, reports, new content, backups, restore |
| `validate.js` | shared checks for words, exercises and texts (build and app) |
| `theme.js` | theme list, apply with a fade |
| `backdrop.js` | background photo kept on the phone, accent colour from the photo |
| `speech.js` | Spanish text-to-speech (prefers an es-ES voice) |
| `ui.js` | `h()`, icons, toast, small helpers |
| `dates.js` | day keys and date maths |

### Stored on the phone

IndexedDB (`js/db.js`), database `mi-espanol`, one key per value:

| Key | Holds | In backups? |
|---|---|---|
| `cards` | word id → SRS state | yes |
| `streak` | current, best, last day, freezes | yes |
| `settings` | focus topics, minutes, theme, backend `{url, token}` | yes, **without** `backend` |
| `log` | day → answers that day | yes |
| `grammar` | per unit: score, sets, forms by tag, seen exercises, reviews; verb forms | yes |
| `custom` | "My words" | yes |
| `reading` | per text: done, score | yes |
| `extra` | AI-made words, exercises, texts; batch seqs already merged | no (comes back from Drive) |
| `sync` | user id and display name, last sync/backup, pending requests, held-backup warning | no |

localStorage: `mi-espanol-theme` (applied before paint), `mi-espanol-photo`
(the background photo, never uploaded).

### Service worker (`sw.js`)
Cache-first for every file in `FILES` (written by `npm run build`, with `VERSION` = a
hash of the content). A new version installs with `skipWaiting` and `clients.claim`;
`main.js` reloads the page once on `controllerchange` and checks for updates whenever
the app comes back to the foreground (iPhone home-screen apps resume, not relaunch).
The You screen shows the version (first 7 characters of `VERSION`).

### Learning logic in one paragraph each

- **Words:** grade 0 brings a word back in 10 minutes; right answers multiply the
  interval by `ease`, which grows with easy answers. `wrong` and `lastWrong` feed the
  "Your mistakes" card. Multiple-choice modes (choose English, choose Spanish) come
  before typing.
- **Grammar:** each set adds `100 × accuracy² × (n/10)` to the unit score (100 =
  mastered); below 50% nothing is added. Tags of missed exercises are weighted ×6 in the
  next set. An exercise right twice in a row retires. "Test me" masters at 90%.
  Mastered units come back at 7 → 18 → 45 days.
- **Leniency:** accent slips and article slips count as right with a note; exercises
  tagged `article*` give 0.5 for a wrong article.
- **Verb trainer:** present always; preterite unlocks after a set in `u10`, imperfect
  after `u12` (`TENSE_UNITS` in `views/drill.js`).
- **Level estimate** (`refill.js`): A1 until all A1 units are mastered, then A2, B1, B2.
  It sets the level of AI content.

## Backend (`backend/src/`)

Google Apps Script, deployed as a web app ("Execute as: me", "Who has access: Anyone").
Access is by token, not Google sign-in, because a home-screen app cannot send Google auth.

| File | Role |
|---|---|
| `Main.gs` | `doPost` router, tokens → user, `VERSION`, display names |
| `Store.gs` | Drive folder and JSON files: backups, queue, content batches, reports, seen news |
| `Gemini.gs` | `callGemini` (JSON output, nightly call budget), `reviewItems` (second pass) |
| `Jobs.gs` | `nightly()` and the jobs: exercises, words, text, news, inbox |
| `Pure.gs` | prompts, feed and article parsing, cleaners (no Google services, unit-tested) |
| `Setup.gs` | functions run by hand: `setup`, `addPartner`, `addUser`, `removeUser`, `setName`, `rotateToken`, `showStatus`, `testNightly` |

### Actions

| Action | Body | Returns |
|---|---|---|
| `ping` | – | `{ version, user, name, ai, model }` |
| `backup.save` | `data`, `force?` | `{ savedAt }` or `{ held, driveSavedAt, driveProgress, phoneProgress }` |
| `backup.load` | `name?` (`backup-YYYY-MM-DD.json`) | `{ data, savedAt }` |
| `backup.list` | – | `{ backups: [{ name, savedAt }] }` |
| `queue.add` | `requests[]` | `{ queued }` |
| `content.since` | `after` (seq) | `{ batches, last }` (10 at a time) |
| `report` | `item`, `reason` | `{ ok }` |
| `status` | – | queue and last-run info |
| `nightly.run` | – | runs the nightly job now (the "Get new content now" button) |

### Users
- `APP_TOKEN` → user `owner`. `USERS` (JSON token → name) holds the others; `addPartner()`
  creates `partner`. Backups go to `backups/` (owner) or `backups-<user>/`.
- Display names: `DEFAULT_NAMES` in `Main.gs` (`owner` → Big Daddy, `partner` → Wifey),
  overridden by the `NAMES` property (`setName('partner', '…')`).
- Content batches carry `meta.user`; the app skips exercise and text batches made for the
  other learner (inbox texts, `user: 'inbox'`, go to everyone).

### Drive layout (folder "Mi Español", id in `FOLDER_ID`)
```
backups/                latest.json + backup-YYYY-MM-DD.json (14 kept)   owner
backups-partner/        same, for the partner
content/                batch-000001.json …  AI content, numbered (seq)
inbox/                  drop articles here (Docs, PDF, Word, txt, html); moved to processed/ after use
queue.json              refill requests waiting for the night
reports.json            "Report a problem" log
seen-news.json          article links already used
```
A backup file is `{ savedAt, data: <the app's export> }`.

### The night (`nightly`, trigger at 03:00)
1. Take the queue, most urgent first (exercises, words, news, text), within 5 minutes
   and `MAX_CALLS_PER_NIGHT` Gemini calls (default 30).
2. Each job: prompt (`Pure.gs`) → Gemini (JSON) → clean → Gemini review → save as a
   numbered batch. News: fetch feeds, pick unseen articles, keep the original sentences,
   add translations, glossary and questions. Inbox: up to 2 files a night.
3. The app downloads new batches on its next sync and checks every item again.

Prompts set content in each learner's focus topics (`interests` on exercise requests,
`TEXT_ABOUT` in `refill.js`) and forbid lyrics and real celebrities.

## Tests

`tests/*.test.js` with `node --test`:
- `engine` (srs, streak, session, check), `verbs`, `grammar`, `phase4` (refill, validate,
  sync merge, backdrop accent),
- `backend` (Pure.gs in a Node `vm`), `backend-flow` (all `.gs` files in a `vm` with
  mocked Drive, Properties, UrlFetch: users, backups and the reset guard, queue → nightly → content).

Browser checks during development used puppeteer-core with Chrome against a small
local server that runs the real `.gs` files as a fake `/exec`; that harness is not in the
repo. Easiest way to recreate it: serve the repo folder and route `POST /exec` to the
`.gs` files loaded into a `vm` context with the same mocks as `tests/backend-flow.test.js`.
