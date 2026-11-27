# Operations: deploy, users, backups, troubleshooting

## Deploying

### The app (GitHub Pages)
`.github/workflows/pages.yml` runs on every push to `main` (except `backend/**` and
Markdown): `npm test`, `npm run build`, publish to Pages. Live in about a minute at
https://dayn228.github.io/Spanish-Learning-App/.

Phones pick up the new version the next time the app comes to the foreground online:
the service worker installs it and the page reloads once. The version code is shown on
You → Backup file ("App version …", the first 7 characters of `VERSION` in `sw.js`).

### The backend (Apps Script)
`.github/workflows/deploy-backend.yml` runs on pushes that touch `backend/**`:
`clasp push` uploads the code to the script in `backend/.clasp.json`, then, **only if the
`DEPLOYMENT_ID` secret exists**, `clasp deploy -i $DEPLOYMENT_ID` publishes it.

| GitHub secret | What |
|---|---|
| `CLASPRC_JSON` | contents of `~/.clasprc.json` after `npx @google/clasp login`. Best made with a login used only for this project (ideally a personal Google account), so this public repo's workflow never holds a token for a work account. If deploys fail with `invalid_grant`, the login expired: log in again and replace the secret. |
| `DEPLOYMENT_ID` | Apps Script → Deploy → Manage deployments → the web app's Deployment ID (`AKfy…`). Without it, publish by hand. |

Publishing by hand: Apps Script editor → **Deploy → Manage deployments → pencil →
Version: New version → Deploy**. The `/exec` URL stays the same. If the new code needs
a new permission (e.g. Drive advanced service), Google asks to authorise again.

Always bump `VERSION` in `backend/src/Main.gs`; `ping` returns it, so you can tell which
version is live.

### Script Properties (Apps Script → Project Settings)

| Property | Set by | What |
|---|---|---|
| `APP_TOKEN` | `setup()` / `rotateToken()` | the owner's token |
| `USERS` | `addUser()` / `addPartner()` | JSON: token → user id |
| `NAMES` | `setName()` | JSON: user id → display name (defaults in `Main.gs`) |
| `FOLDER_ID` | `setup()` | the "Mi Español" Drive folder |
| `GEMINI_API_KEY` | you | key from aistudio.google.com (free tier) |
| `GEMINI_MODEL` | optional | default `gemini-3.6-flash` |
| `MAX_CALLS_PER_NIGHT` | optional | Gemini calls per run, default 30 |
| `MAX_CALLS_PER_DAY` | optional | Gemini calls per day across all runs, default 60 |
| `CALLS_<date>`, `MANUAL_RUN_<user>` | backend | today's call count (old ones cleaned weekly); last "Get new content now" per learner (once an hour) |
| `NEWS_FEEDS` | optional | JSON `[{ topic, url }]` RSS feeds, replaces the defaults |
| `LAST_SEQ` | backend | last content batch number |

Never put any of these in the repo.

## Learners

| Who | User id | Display name | Token |
|---|---|---|---|
| Owner | `owner` | Big Daddy | `APP_TOKEN` |
| Partner | `partner` | Wifey | in `USERS`, made by `addPartner()` |

- **New learner:** run `addUser('name')` (or `addPartner()`) in the editor; copy the token from
  the Execution log. Running it again for the same name makes a new token and kills the old one.
- **Rename:** `setName('partner', 'New name')`.
- **Remove:** `removeUser('name')` (their backups stay in Drive).
- **Leaked token:** `rotateToken()` for the owner, `addUser(sameName)` for others; reconnect the phone.

### Setting up a phone
1. Safari → https://dayn228.github.io/Spanish-Learning-App/ → Share → Add to Home Screen.
2. Open from the home screen. You → Google Drive and AI → paste the `/exec` URL and the
   learner's token → Connect. It shows "Signed in as …". A fresh phone restores its
   progress from Drive automatically.
3. Topics: choose focus topics (they steer AI exercises and texts). You → Appearance.

## Safety limits (backend)

- Gemini: per run and per day budgets (above); manual runs once an hour per learner.
- Sizes: backups up to 2 MB, reports up to 20 KB, up to 30 requests of 20 KB per sync, request body up to 5 MB.
- Content batches are written under the script lock, file first, then `LAST_SEQ`.
- News and inbox texts pass the same Gemini review as AI texts; articles are fenced as data in prompts.
- Inbox texts belong to the owner; start a file name with `share-` to give it to both learners.

## Backups

- Automatic on every sync (after a session, at app open, when back online), at most
  every 2 hours unless you studied. `latest.json` plus one `backup-YYYY-MM-DD.json`
  per day, 14 kept, per learner.
- **Reset guard:** a backup with less than half of Drive's progress is held back, and the
  You screen offers "Restore from Drive" or "Keep this phone".
- **Restore:** You → Restore from Drive… (pick a day), or download a file from Drive and
  You → Restore from file (both the Drive wrapper and plain exports work).
- Not in backups: AI content (comes back from Drive), the background photo, the token.
- Deleting the home-screen icon on iPhone **erases the app's storage**. Restore as above.

## Troubleshooting (things that already happened)

| Symptom | Cause | Fix |
|---|---|---|
| "Wrong or missing token" | token pasted incompletely (32 characters for the owner's first token, 40 after `rotateToken` and for other learners) | copy again from the Execution log |
| Partner token rejected, names missing | backend code pushed but no new version published | publish a new version; add `DEPLOYMENT_ID` |
| Progress gone after re-adding the app | iOS wiped storage; old app overwrote the newest backup | restore yesterday's daily copy; guard now prevents this |
| Restore says "not a backup" | old app version did not unwrap `{ savedAt, data }` | update the app (check the version code) |
| A fix doesn't show on the phone | phone still runs the cached version | swipe the app away, reopen online; check the version code |
| Deploy backend workflow fails | broken YAML or missing `CLASPRC_JSON` | check the run log; the job skips itself if not set up |
| No AI content | no `GEMINI_API_KEY`, call budget used (per run or per day), or unknown model name |
| "Already requested in the last hour" | "Get new content now" is limited to once an hour per learner | wait, or run `testNightly()` in the editor | `showStatus()` in the editor; set `GEMINI_MODEL` to a current Flash model |
| AI item looks wrong | – | "Report a problem" on it; it disappears and is logged in `reports.json` |
| Moving Drive files with the Drive connector fails | the connector can't move files it did not create | move them by hand in Drive |

Useful editor functions: `showStatus()` (folder link, model, key set, queue length, last night's result), `testNightly()`
(runs the nightly job now), `setup()` (safe to re-run; makes missing folders and the trigger).

## Costs, limits and privacy

- Gemini free tier only. On the free tier Google may use prompts to improve its products;
  only learning content is sent, never progress or names.
- Apps Script: 6-minute run limit (jobs stop at 5), daily quotas far above this use.
- The web app is "Anyone" with a token check, because home-screen apps can't send Google
  sign-in. If the backend runs in a work (Workspace) account, that organisation's admins can
  technically see the Drive files; a personal Google account keeps them fully separate.
