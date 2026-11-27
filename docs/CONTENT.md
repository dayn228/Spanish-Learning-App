# Content: words, grammar, texts

Everything the learner studies lives in `data/` as JSON. `npm run build` checks all of
it (rules in `js/validate.js` and `tools/build.mjs`) and refuses to finish if anything is
wrong. Run it after every content change, then `npm test`.

Language: Castilian Spanish (Spain vocabulary, vosotros). English translations in
British English. Never paste copyrighted text (articles, lyrics, textbook pages) into
the repo; write originals. The owner's downloaded articles go into the Drive inbox.

## Current inventory (November 2026)

- 25 topics, 961 words: 12 core (A1), 5 work and news packs (construction, finance,
  economics, politics, news; A2–B1), 7 lifestyle packs (music, fashion, beauty, sport,
  self-care, trips, books; A2), TV series and crime (A2–B1).
- 14 grammar units, 393 exercises: u01–u08 A1, u09–u12 A2, u13–u14 B1.
- 15 texts: t01–t06 A1–A2, t07–t09 B1, t10 B2, t11–t12 A2, t13–t15 B1 (Breaking Bad, Dexter, El mentalista; facts from Wikipedia, cited).

## Topics and words (`data/core/*.json`, `data/packs/*.json`)

```json
{
  "id": "construction",
  "name": "Construction and windows",
  "kind": "pack",
  "level": "A2–B1",
  "blurb": "Site work, windows and glazing, quotes and deliveries.",
  "words": [
    ["la obra", "building site / construction work", "Mañana vamos a la obra a las siete.", "Tomorrow we're going to the site at seven.", "n"]
  ]
}
```

- Word fields: Spanish, English, example, example in English, part of speech
  (`n`, `v`, `adj`, `adv`, `phr`). Example and its translation go together.
- Nouns carry their article (`la obra`), so gender is learned with the word.
- Order in the file is teaching order: most useful first.
- **Word id = `<topic>:<slug of the Spanish>`.** Changing the Spanish spelling resets
  that word's progress. Fix a typo in English freely; think twice about the Spanish.
- The same Spanish word may appear in two topics (different ids).
- New topic: add the file, add its id to `order` in `tools/build.mjs`, and if it should
  get AI practice texts, a line in `TEXT_ABOUT` in `js/refill.js`.
- Keep files one word per line (easy diffs).

## Grammar units (`data/grammar/uNN.json`)

```json
{
  "id": "u10", "n": 10, "level": "A2",
  "title": "The past: pretérito indefinido (1)",
  "summary": "Finished actions: ayer firmé, el lunes llegaron.",
  "explain": [ …blocks… ],
  "exercises": [ …exercises… ]
}
```

Units are shown in `n` order. Level (`A1`, `A2`, `B1`, `B2`) drives the level estimate.

### Explanation blocks
| Block | Shows |
|---|---|
| `{"h": "Heading"}` | a sub-heading |
| `{"p": "Text with **bold** and *Spanish in italics*"}` | a paragraph |
| `{"ex": ["Spanish sentence.", "English."]}` | an example; tap to hear it |
| `{"table": [[…], […]], "head": true}` | a table; `head` makes the first row a header |
| `{"tip": "…"}` | a highlighted tip |

Write like a good textbook: when to use it, the forms (table), 2–3 examples from the
learners' world, the classic mistake as a tip.

### Exercises

Every exercise needs `tags` (1–2): the form it practises, e.g. `["se-lo"]`. Wrong answers
raise the weight of exercises with the same tag, and the AI is told which tags exist, so
use a small, consistent set per unit (about 4–8).

| Type | Fields | The learner… |
|---|---|---|
| `gap` | `q` with exactly one `___`, `a`, `hint?`, `en?` | types the missing word(s) |
| `choice` | `q`, `options[]`, `a` (index), `why?` | taps one option |
| `transform` | `instr`, `q`, `a` | rewrites the sentence |
| `error` | `q` (one mistake), `a` (corrected), `why?` | writes the corrected sentence |
| `translate` | `q` (English), `a` | writes it in Spanish |
| `reorder` | `words[]`, `a`, `en?` | taps the words in order (`words` must make `a`) |
| `match` | `pairs[[es, en]…]` (≥ 3), `instr?` | pairs them up |
| `table` | `verb`, `tense?` (`present`, `preterite`, `imperfect`) | fills in all six forms |

- `a` can list alternatives: `"Te lo envío mañana / Te lo mando mañana"`. This works for
  `reorder` too (other correct word orders; each must use exactly the given `words`).
- Accent and article slips count as right (with a note), except in verb tables (half right). Tag an exercise `article…`
  when the article is the point; then a wrong article is half right.
- `table` verbs must be conjugable by `js/verbs.js` (the build checks).
- Aim for 25–35 exercises per unit, mixing types, with at least a third in sentences
  about construction, money, news, travel, music, fashion and daily life in Spain.
- Exercise identity is a hash of its content (`exerciseId` in `js/grammar.js`): editing
  an exercise makes it "new" for progress purposes. That is fine.

### Verbs (`js/verbs.js`)
`VERBS` lists infinitive → `{ en, stem?, yo?, full?, pret?, yPast?, uir? }`:
`stem` `ie`/`ue`/`i` (present stem change; -ir verbs also change in the preterite),
`yo` irregular first person, `full` six irregular present forms, `pret` strong preterite
stem (`tuv`), `yPast` for leer/creer/oír (leyó). Reflexives (`levantarse`) work
automatically. Add tests in `tests/verbs.test.js` for any new irregular.

## Reading texts (`data/reading/tNN.json`)

```json
{
  "id": "t07", "title": "Rehabilitar un edificio de 1975", "en": "Renovating a building from 1975",
  "level": "B1", "topic": "construction", "note": "Practice text written for the app.",
  "paragraphs": [ [ ["Spanish sentence.", "English sentence."], … ], … ],
  "questions": [ { "q": "¿…?", "options": ["…", "…", "…"], "a": 0 } ],
  "glossary": { "construyó": ["construir", "built"], "viviendas": ["la vivienda", "homes"] }
}
```

- One sentence per pair, so long-press translation works.
- **Every word must have a meaning** or the build fails. Lookup order: the text's
  `glossary` (lower-case surface form → `[dictionary form, meaning here, note?]`), then
  `data/reading/common.json` (shared everyday words and forms), then the word lists
  (also plural → singular). To find what is missing, run the build: it lists the words.
- Put a word in `common.json` when it will appear in many texts (conjugated forms of
  ser, estar, haber, numbers, connectors); otherwise in the glossary.
- 4–7 questions, 3 options each. `a` is the index of the right one; the reader shows options in random order.
- Lengths that work: A1 120–200 words, A2 250–350, B1 450–650, B2 600–800.
- Optional: `source: { name, url }` shows "Read the original"; `practice: true` shows
  "Written for practice; not a real news report" (AI texts set this).

## Content made in ChatGPT (content packs)

`docs/prompts/chatgpt-content.md` holds a prompt (regenerate with `node tools/make-prompt.mjs`
after adding units or topics). ChatGPT answers with one JSON object:
`{ "format": "mi-espanol-content-1", "exercises": [{ "unit": "u10", …exercise }], "words": [{ "topic", "name", "words": [[…]] }], "texts": [ …text ] }`.
In the app: You → Add content from ChatGPT → paste → Check → Add. `js/importpack.js` keeps the
items that pass `validate.js`; the backend (`content.add`, `splitPack` in `Pure.gs`) stores them
as normal content batches for this learner (or both), so they sync and survive resets.
New topic ids create new topics on the phone, like AI word batches.

## AI-made content (overnight)

Same formats, made by the backend from prompts in `backend/src/Pure.gs`, reviewed by a
second Gemini pass, stored as Drive batches, and checked again by `js/validate.js` in the
app. Exercises are tagged with the unit's existing tags and set in the learner's focus
topics; words avoid ones already in the topic; texts get glossaries and questions.
"Report a problem" removes an item and logs it in `reports.json` in Drive.

The owner's own articles: drop them into the Drive `inbox` folder. They become private
texts overnight (up to 2 a night) and are never committed.

## Checklist for a content change

1. Edit or add the JSON.
2. `npm run build` → fix whatever it lists → `OK:` line.
3. `npm test`.
4. Commit and push; GitHub Pages publishes; phones update when the app next opens.
