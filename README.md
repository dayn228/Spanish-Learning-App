# Mi Español

A personal, offline-first Spanish (Castilian) learning app for iPhone. It is a plain web app (HTML, CSS, JavaScript, no framework) that installs to the home screen and works without internet.

The full plan: [Mi Español: app plan](https://claude.ai/artifact/GbNyyqNK4AuS6qK3TrG1Wz). This is **phase 1: foundation and words**.

## Use it on your iPhone

1. Open the app's address in **Safari** (the GitHub Pages link, see below).
2. Tap **Share → Add to Home Screen**.
3. Open it from the home screen once while online. From then on it works offline.

Updates: when a new version is published, it downloads the next time you open the app online and is used from the launch after that.

## What phase 1 does

- **Today:** pick 5, 15, 30 or 60 minutes; reviews come first, then new words (about 70% from your focus topics).
- **Study cards:** new-word introductions, flip cards (Again / Good / Easy) and typed answers with accent and article checking. Words read aloud with the iPhone's Spain Spanish voice.
- **Spaced repetition:** correct answers push a word further away (about 1 → 2.5 → 6 → 16 → 40 days), easy answers further still; misses come back in 10 minutes. See `js/srs.js`.
- **Forgiving streak:** any session counts; one freeze earned per 7 days in a row covers a missed day. See `js/streak.js`.
- **Topics:** 12 core topics and 5 focus packs (construction and windows, finance, economics, politics, news language): 523 words with example sentences.
- **Backup:** You → Save backup (to Files or Google Drive) and Restore from file. Automatic Drive backup comes in phase 4.

## Project layout

```
index.html, manifest.webmanifest, sw.js   app page, install info, offline cache
css/tokens.css      colours, fonts, sizes (the design system)
css/app.css         layout and components
js/main.js          start-up and navigation between screens
js/views/           one file per screen (today, topics, topic, study, practice, you)
js/srs.js           spaced repetition
js/streak.js        streak and freezes
js/session.js       builds a session from your minutes and focus topics
js/check.js         checks typed answers
js/state.js, db.js  progress saved on the phone (IndexedDB), backup
data/core/, data/packs/   word lists (JSON)
tools/build.mjs     checks word lists, writes the offline file list
tests/              unit tests for the logic
backend/            Apps Script (phase 4)
```

## Adding or editing words

Each topic is one JSON file in `data/core/` or `data/packs/`. A word is one line:

```json
["el andamio", "scaffolding", "El andamio está montado.", "The scaffolding is up.", "n"]
```

Spanish (with article), English, example, example in English, part of speech. Order in the file = the order new words are taught. Changing a word's Spanish spelling resets its progress (the id comes from the spelling).

Then run `npm run build`. It refuses to build if a list has a duplicate or a missing field.

## Develop on a computer

```
npm test          # unit tests
npm run build     # check word lists and update the offline cache list
npm run serve     # http://localhost:8000
```

## Publishing

- **App:** every push to `main` runs the tests, builds and publishes to GitHub Pages (`.github/workflows/pages.yml`). One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
- **Backend:** `backend/` deploys to Apps Script with clasp, the same way as Fram-Automation (`.github/workflows/deploy-backend.yml`). It skips itself until phase 4 sets the script ID and the `CLASPRC_JSON` secret.

Nothing private is stored in this repository: progress stays on the phone and in your own Drive.

Font: Newsreader, SIL Open Font License (`fonts/LICENSE-Newsreader.txt`).
