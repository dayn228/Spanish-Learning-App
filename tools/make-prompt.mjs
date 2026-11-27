/*
  Writes docs/prompts/chatgpt-content.md: a prompt to paste into ChatGPT (or any chat AI)
  so it makes content packs for the app. The lists of units, tags and topics come from data/,
  so run this after adding units or topics:  node tools/make-prompt.mjs
*/
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const units = readdirSync(join(root, 'data/grammar')).filter((f) => /^u\d+\.json$/.test(f)).sort().map((f) => json('data/grammar/' + f));
const unitLines = units.map((u) => {
  const tags = [...new Set(u.exercises.flatMap((e) => e.tags || []))];
  return `- ${u.id} (${u.level}) ${u.title} — tags: ${tags.join(', ')}`;
}).join('\n');
const topics = ['core', 'packs'].flatMap((d) => readdirSync(join(root, 'data', d)).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => json(`data/${d}/${f}`)));
const topicLines = topics.map((t) => `- ${t.id}: ${t.name}`).join('\n');

const prompt = `You are writing practice content for "Mi Español", a Castilian Spanish learning app.
Answer with ONE JSON object only, no text before or after it, in exactly this format:

{
  "format": "mi-espanol-content-1",
  "exercises": [ ...exercise objects, each with "unit" and "tags"... ],
  "words": [ { "topic": "<topic id>", "name": "<topic name>", "words": [ ["la palabra", "the word", "Example sentence.", "Example translation.", "n"] ] } ],
  "texts": [ ...text objects... ]
}
Leave out any of the three lists you were not asked for.

RULES FOR ALL CONTENT
- Spanish from Spain (castellano): vosotros, Spain vocabulary (coche, ordenador, móvil), euros.
- English translations in British English.
- Natural, correct, modern Spanish. Every Spanish sentence must be grammatically perfect; check twice.
- Never copy text from books, articles, scripts, song lyrics or websites. Write everything yourself.
- Real TV series, films and public figures may be mentioned only with well-known facts; no quotes,
  no invented statements by real people, no spoilers of endings.
- Use the learners' interests below for the situations in sentences and texts.

LEARNERS
- Learner 1: works at a window and glazing installation company in Spain; interested in construction,
  finance, economics, politics and international news. Level A2, aiming for B1–B2.
- Learner 2: interested in pop music and concerts, fashion, make-up, sport, self-care, travel and books.
  Level A1–A2.
- Both like the TV series Dexter, The Mentalist (El mentalista) and Breaking Bad.

EXERCISES
Each exercise is an object with "unit" (a unit id from the list), "type", the fields for that type,
and "tags" (1–2 tags from that unit's list). Types:
- gap: {"type":"gap","q":"Ayer ___ tarde al trabajo.","hint":"llegar, yo","a":"llegué","en":"Yesterday I got to work late."}
  "q" has exactly one ___ ; "hint" says the verb and person when a verb form is needed.
- choice: {"type":"choice","q":"___ mucha gente en el concierto.","options":["Había","Habían","Hubieron"],"a":0,"why":"Había is always singular."}
  "a" is the index of the right option; 3 options; "why" explains in one short English sentence.
- transform: {"type":"transform","instr":"Put it in the past (ayer).","q":"Hoy trabajo hasta las seis.","a":"Ayer trabajé hasta las seis."}
- error: {"type":"error","q":"Ayer yo llegé tarde.","a":"Ayer yo llegué tarde.","why":"-gar → -gué in the yo form."}
  "q" contains exactly one mistake; "a" is the whole corrected sentence.
- translate: {"type":"translate","q":"We saw the plans last week.","a":"Vimos los planos la semana pasada / La semana pasada vimos los planos"}
  "q" is English; list correct alternatives in "a" separated by " / ".
- reorder: {"type":"reorder","words":["se","lo","explico","mañana"],"a":"se lo explico mañana","en":"I'll explain it to him tomorrow."}
  "words" must be exactly the words of "a" (lower case, no punctuation), in any order.
- match: {"type":"match","pairs":[["por cierto","by the way"],["por lo menos","at least"],["por eso","that's why"]]}
  at least 3 pairs.
Accents and articles are checked leniently by the app, but write them correctly.
Mix types (about 40% gap, 20% choice, the rest spread over the others). Make them genuinely
challenging for the unit's level: real sentences, not textbook clichés.

GRAMMAR UNITS (use these ids and tags only)
${unitLines}

WORDS
"words" groups words by topic. Each word is [Spanish, English, example, example in English, part of speech].
Nouns always with their article (la obra, el andamio). Part of speech: n, v, adj, adv or phr.
Use an existing topic id where it fits, or a new short lower-case id with a "name".
Do not repeat very basic words; aim for useful A2–B1 vocabulary.
Existing topics:
${topicLines}

TEXTS
{
  "title": "Spanish title", "en": "English title", "level": "B1", "topic": "<topic id>",
  "paragraphs": [ [ ["Spanish sentence.", "English sentence."], ["…", "…"] ], [ … ] ],
  "questions": [ { "q": "¿Pregunta en español?", "options": ["right answer", "wrong", "wrong"], "a": 0 } ],
  "glossary": { "construyó": ["construir", "built"], "viviendas": ["la vivienda", "homes"] },
  "practice": true
}
- One sentence per pair. Lengths: A2 250–350 words, B1 450–650, B2 600–800.
- 5–6 questions in Spanish, 3 options each, "a" = index of the right one.
- "glossary": every word a learner at that level might not know, keyed by the exact lower-case form
  in the text → [dictionary form (nouns with article), meaning in this sentence]. Aim for 40–80 entries.
- "practice": true for texts you wrote (always, unless told otherwise).
- If the text is based on facts from a real source, add "source": {"name": "…", "url": "https://…"}.

Before answering, check: valid JSON (double quotes, no trailing commas, no comments), every exercise has
"unit" and "tags" from the list, every "reorder" uses exactly the words of "a", every gap has one ___ .

MY REQUEST:
`;

const doc = `# Prompt for ChatGPT (or another chat AI): content packs

Generated by \`node tools/make-prompt.mjs\` from the current units and topics. Re-run it after
adding units or topics.

How to use it:
1. Copy everything inside the box below into ChatGPT.
2. At the end, after "MY REQUEST:", write what you want, for example:
   - "30 exercises for u11, situations from construction sites and Breaking Bad."
   - "40 B1 words for the topic finance about mortgages and banks."
   - "One B1 text (500 words) about how Spanish elections work, plus 15 exercises for u13 using it."
3. Copy ChatGPT's whole answer. In the app: You → Add content from ChatGPT → paste → Check → Add.
   The app keeps only items that pass its checks and lists what it left out.
4. If the JSON is broken, tell ChatGPT: "Fix the JSON and send the whole object again."

Tip: ask for 20–40 exercises per answer; very long answers get cut off.

\`\`\`text
${prompt}\`\`\`
`;
writeFileSync(join(root, 'docs/prompts/chatgpt-content.md'), doc);
console.log('Wrote docs/prompts/chatgpt-content.md');
