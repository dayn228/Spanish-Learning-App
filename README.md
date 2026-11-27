# Mi Español

A personal, offline-first Castilian Spanish app for iPhone: words by topic with spaced
repetition, textbook-style grammar with lenient checking, a verb trainer, listening,
graded reading with tap-to-translate, and new content made overnight by Gemini through
an Apps Script backend that also backs progress up to Google Drive. Plain HTML, CSS and
JavaScript; no framework.

**App:** https://dayn228.github.io/Spanish-Learning-App/ (open in Safari → Share → Add to Home Screen)

## Documentation

| | |
|---|---|
| [CLAUDE.md](CLAUDE.md) | start here if you are an AI assistant (or new to the code): rules and map |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | how the app and backend work, storage, sync protocol, algorithms |
| [docs/CONTENT.md](docs/CONTENT.md) | formats for words, grammar units, exercises and texts; how to add them |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | deploying, learners and tokens, backups, troubleshooting |
| [docs/SETUP-BACKEND.md](docs/SETUP-BACKEND.md) | setting up the Apps Script backend from scratch |
| [docs/ROADMAP.md](docs/ROADMAP.md) | what is done and what comes next |

## What is in it

- **Words:** 24 topics, 921 words (everyday A1; construction, finance, economics, politics,
  news; music, fashion, beauty, sport, self-care, trips, books). Sessions of 5–60 minutes,
  reviews first, 70% from focus topics. Forgiving streak with freezes.
- **Grammar:** 14 units (A1–B1), 393 exercises, mastery proportional to accuracy, mistakes
  practised more. Verb trainer: present, preterite, imperfect.
- **Listening and reading:** dictation, which-word, sound pairs; 12 texts A1–B2 with word,
  sentence and full translations and questions.
- **Backend (optional):** Drive backups per learner, AI exercises, words and texts set in
  each learner's interests, real news, the owner's own articles via a Drive inbox.
- **You:** themes, background photo, two learners with their own names and backups.

## Develop

```bash
npm test          # unit tests
npm run build     # validate content, write index files and the offline cache list
npm run serve     # http://localhost:8000
```

Every push to `main` is tested, built and published to GitHub Pages; changes in
`backend/` are uploaded to Apps Script (see OPERATIONS.md for publishing a new version).

Nothing private is stored in this repository: progress stays on the phones and in the
owner's Drive.

Font: Newsreader, SIL Open Font License (`fonts/LICENSE-Newsreader.txt`).
