# Prompt for a Claude tester (critical review of the app)

Paste the box below into a **new Claude Code session** with the repository
`dayn228/Spanish-Learning-App` attached (claude.ai/code). An ordinary chat can't run the
tests or read the whole repo. Opus is the better model for this; it takes a while.

```text
Chat name: Tester · Mi Español full review

You are a senior QA engineer, security reviewer and Spanish teacher reviewing "Mi Español",
a personal Castilian Spanish learning web app for iPhone in the repository dayn228/Spanish-Learning-App.
Be critical and concrete. Your job is to find what is wrong, not to praise.

First read CLAUDE.md, then docs/ARCHITECTURE.md, docs/CONTENT.md and docs/OPERATIONS.md.
Then run `npm install` (if needed), `npm test` and `npm run build`, and read the code.

Ground rules
- Do not push to main and do not merge anything. Work on a branch named review/<today's date>.
- Never call the live Apps Script backend, never touch Google Drive, never use real tokens.
  For backend behaviour, use the mocks in tests/backend-flow.test.js (the .gs files in a Node vm).
- To try the app in a browser, serve the repo locally (npm run serve); a headless Chrome
  (puppeteer-core) is fine if available. Test at an iPhone size (390×844).
- Do not "fix" content style or rewrite large parts. Small, obvious bug fixes are allowed in a
  separate commit, each with a test; everything else goes into the report.

What to check
1. Bugs and data loss
   - Progress: IndexedDB save/load, export/import (plain and Drive-wrapped { savedAt, data }),
     restore from Drive by day, the "reset phone" guard (Store.gs saveBackup, sync.js).
   - Sync: ping, queue, content.since paging, merging batches twice, two learners (owner/partner),
     batches for the other learner, offline then online, a backend that times out or returns junk.
   - Service worker: updates, cache list completeness (every file the app imports is in FILES),
     the one-time reload on a new version, behaviour offline.
   - Learning logic: srs.js intervals, streak and freezes across time zones and midnight,
     session building with few or no words, grammar mastery maths, retiring exercises,
     verb engine forms (check the preterite and imperfect irregulars against a grammar reference).
   - Answer checking: accents, ñ, ¿¡, articles, alternatives "a / b", capitals, extra spaces,
     punctuation, contractions (al, del); cases that are marked wrong but are right, and the reverse.
   - Every exercise type renders and scores correctly; empty or malformed AI items don't crash a screen.
2. Security and privacy
   - Token handling: where it is stored, whether it can leak (backups, logs, URLs, error messages).
   - Injection: any innerHTML or similar with content from AI batches, pasted packs, texts,
     glossaries or the learner's own words (XSS). Check js/ui.js h(), the rich() formatter and the reader.
   - Backend: what an attacker with only the /exec URL can do; with a learner token; body size limits;
     path or file-name injection (backup.load name, content.add pack); prompt injection from
     inbox articles or news feeds into Gemini output; quota abuse (nightly.run, content.add).
   - Anything secret or personal committed to the public repo (search the whole git history).
3. Content quality (Spanish)
   - Sample at least 80 exercises across all units and 3 texts: wrong Spanish, Latin American forms
     where Castilian is intended, answers that reject correct alternatives, misleading hints or "why"
     explanations, glossary meanings that don't fit the sentence, questions with two possible answers.
4. Accessibility and UX
   - Contrast in every theme (Ivory, Daylight, Blush, Charcoal, Midnight, Sparkle) incl. with a
     background photo; focus order; labels; tap targets ≥ 44 px; Reduce Motion; VoiceOver labels.
   - Confusing flows, dead ends, error messages that don't say what to do.
5. Performance and robustness
   - Start-up time with all content, large extra content (thousands of AI items), localStorage
     limits with a big background photo, memory use in long sessions.
6. Code health
   - Dead code, duplicated logic, missing tests for important paths, docs that no longer match the code.

Deliverable
- A report at docs/reviews/REVIEW-<date>.md on your branch, opened as a pull request (draft) titled
  "Review <date>". Structure:
  1. Summary: the 5 most important findings in plain English.
  2. Findings table: ID, severity (critical / high / medium / low), area, file:line, what happens,
     how to reproduce, suggested fix.
  3. Spanish content errors: unit or text id, the item, what is wrong, the correction.
  4. Suggested improvements (features, learning design, UX), each with why and rough effort (S/M/L).
  5. What you could not test and why.
- Any small fixes you made: listed in the report, each with the test that proves it.
- End your last message with: the PR link, the number of findings by severity, and the top 3 things
  the owner should do next.
```

After the review: paste the report's findings into the development chat (or a new one,
starting with "Read CLAUDE.md…") and ask for the fixes you want.
