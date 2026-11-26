# Mi Español

A personal, offline-first Spanish (Castilian) learning app for iPhone. It is a plain web app (HTML, CSS, JavaScript, no framework) that installs to the home screen and works without internet.

The full plan: [Mi Español: app plan](https://claude.ai/artifact/GbNyyqNK4AuS6qK3TrG1Wz). Done so far: **phase 1** (foundation and words), **phase 2** (grammar A1 and the verb trainer), **phase 3** (listening and graded reading) and **phase 4** (Drive backup, AI content, real news).

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

## What phase 2 adds

- **Grammar units 1–8 (A1):** pronouns and ser/estar, gender and plurals, regular present, key irregulars, questions and negation, ir a + infinitive, gustar, reflexives. Each has an explanation (tap examples to hear them) and 23–30 exercises.
- **Exercise types:** fill the gap, choose, transform, find the mistake, translate, put words in order, match, and full conjugation tables. An accent bar (á é í ó ú ñ ü ¿ ¡) sits under every answer field.
- **Mastery follows accuracy:** each set adds 100 × accuracy² × (set size / 10) to the unit score, so a perfect set masters a unit and mistakes mean more sets. Missed forms (by tag) come back more often; exercises right twice in a row retire. "I know this: test me" masters a unit at 90%. Mastered units return for short reviews at growing gaps (7, 18, 45 days…). See `js/grammar.js`.
- **Verb trainer:** about 60 verbs in the present tense, weighted to the forms you miss; forms right four times in a row retire. Conjugation rules and irregulars in `js/verbs.js`.
- **Sessions include grammar:** 15, 30 and 60-minute sessions end with 4, 6 or 10 exercises from your next unit, or a review if one is due.

## What phase 3 adds

- **Read tab:** six graded texts (A1–A2) on construction, finance, economics and politics. Tap any word for its meaning in that sentence and its dictionary form; press and hold a sentence for its translation; "Translation" shows the English under each paragraph; "Listen" reads the text aloud sentence by sentence. Words you are learning are underlined, new words dotted. Comprehension questions at the end count towards your streak.
- **My words:** "Add to my words" saves a word from a text (with the sentence as its example) into a My words topic, and "Learn this word next" moves a listed word to the front; either comes first in your next session.
- **Listening (Practice tab):** "which word did you hear?" from your words, dictation of example sentences checked word by word (accents ignored, missed words underlined), and sound pairs like pero / perro. Play and Slower buttons on every item.
- **Sessions:** 30 and 60-minute sessions now run words → grammar → listening (6 or 10 items). Today also suggests a text to read.

## What phase 4 adds

- **Backend (`backend/`)**: a Google Apps Script web app in your own account. It keeps your backups in a Drive folder, and holds your Gemini key so it never reaches the app. Setup: [docs/SETUP-BACKEND.md](docs/SETUP-BACKEND.md).
- **Automatic backup** to Drive when the phone is online (after studying, at most every 2 hours otherwise); 14 daily copies kept. **Restore from Drive** on the You screen.
- **Refill engine (`js/refill.js`)**: when a grammar unit you are working on has fewer than 15 fresh exercises, a focus topic fewer than 20 new words, or you have fewer than 3 unread texts, the app queues a request. Each night the backend asks Gemini, has a second Gemini pass review the result, and stores what passes. The app checks every item again (`js/validate.js`) before adding it.
- **Real news**: the nightly job takes new articles from Spanish news feeds (Cinco Días, El Confidencial, El País by default), keeps the original sentences, and adds translations, a glossary and questions. Texts link to the original. Kept private in your Drive and on your phone.
- **Construction texts**: while construction is a focus topic, Gemini writes new graded practice texts about work at a window installation company.
- **Report a problem**: every AI-made word, exercise and text shows "Made by AI · Report a problem". Reporting removes it at once and logs it in Drive.

## Adding reading texts

Texts live in `data/reading/tNN.json`: paragraphs of `[spanish, english]` sentences, comprehension questions, and a glossary of word forms → `[dictionary form, meaning here, note?]`. Everyday words are shared in `data/reading/common.json`; words already in the word lists are found automatically. `npm run build` refuses a text that has a word with no meaning.

## Adding grammar exercises

Units live in `data/grammar/uNN.json`. Exercise shapes are described at the top of `js/exercise.js`; every exercise needs at least one tag (the form it practises). `npm run build` checks every exercise (answer index in range, reorder words make the answer, table verbs can be conjugated, no duplicates).

## Project layout

```
index.html, manifest.webmanifest, sw.js   app page, install info, offline cache
css/tokens.css      colours, fonts, sizes (the design system)
css/app.css         layout and components
js/main.js          start-up and navigation between screens
js/views/           one file per screen (today, topics, topic, study, practice, unit, drill, read, text, you)
js/srs.js           spaced repetition
js/streak.js        streak and freezes
js/session.js       builds a session from your minutes and focus topics
js/check.js         checks typed answers
js/verbs.js         conjugation (regular, stem changes, irregulars)
js/grammar.js       grammar mastery, weak forms, verb trainer picking
js/exercise.js      renders and checks every exercise type
js/listening.js     builds listening sets from your words
js/reading.js       splits texts into words and looks them up
js/refill.js        decides when to ask for more content
js/sync.js          talks to the backend: requests, new content, backup
js/validate.js      checks words, exercises and texts (build and AI content)
js/state.js, db.js  progress saved on the phone (IndexedDB), backup
data/core/, data/packs/   word lists (JSON)
data/grammar/       grammar units (JSON)
data/reading/       reading texts and the shared everyday dictionary
tools/build.mjs     checks word lists, writes the offline file list
tests/              unit tests for the logic
backend/            Apps Script backend: backup, refill queue, Gemini, nightly jobs
docs/               setup guide for the backend
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
