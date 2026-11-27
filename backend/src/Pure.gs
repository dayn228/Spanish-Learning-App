/**
 * Pure helpers: no Google services, so they are unit-tested in Node
 * (tests/backend.test.js loads this file directly).
 */

var EXERCISE_TYPES_AI = ['gap', 'choice', 'transform', 'error', 'translate', 'reorder', 'match'];

/** Decode the HTML entities that appear in feeds and articles. */
function decodeEntities(s) {
  var named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', ndash: '–', mdash: '—', hellip: '…', iexcl: '¡', iquest: '¿',
    aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', ordf: 'ª', ordm: 'º', euro: '€', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
  return String(s || '')
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); })
    .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); })
    .replace(/&([a-z]+);/gi, function (m, n) { return named[n] !== undefined ? named[n] : m; });
}

function stripTags(s) {
  // Strip, decode, strip again: feeds often carry HTML encoded as &lt;p&gt;.
  var once = decodeEntities(String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' '));
  return once.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** RSS or Atom → [{ title, link, description }]. */
function parseFeed(xml) {
  var items = [];
  var re = /<(item|entry)\b[\s\S]*?<\/\1>/g, m;
  while ((m = re.exec(xml))) {
    var block = m[0];
    var get = function (tag) { var r = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>').exec(block); return r ? r[1] : ''; };
    var link = stripTags(get('link'));
    if (!link) { var lm = /<link[^>]*href="([^"]+)"/.exec(block); link = lm ? lm[1] : ''; }
    items.push({ title: stripTags(get('title')), link: link.trim(), description: stripTags(get('description') || get('summary') || get('content')) });
  }
  return items.filter(function (i) { return i.title && i.link; });
}

/** Article page → the main paragraphs (long <p> blocks, no boilerplate). */
function extractParagraphs(html, max) {
  max = max || 8;
  var body = String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<(nav|footer|aside|header|figure)[\s\S]*?<\/\1>/gi, '');
  var out = [], re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi, m;
  while ((m = re.exec(body)) && out.length < max) {
    var t = stripTags(m[1]);
    if (t.length < 70) continue;
    if (/cookies|suscr[ií]b|newsletter|todos los derechos|copyright|©|publicidad/i.test(t)) continue;
    out.push(t);
  }
  return out;
}

/** Split Spanish text into sentences. */
function splitSentences(text) {
  return String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?…»"])\s+(?=[«"¿¡A-ZÁÉÍÓÚÑ0-9])/).map(function (s) { return s.trim(); }).filter(Boolean);
}

/** Keep about `maxWords` words, cutting only at sentence ends. */
function trimToWords(paragraphs, maxWords) {
  var out = [], count = 0;
  for (var i = 0; i < paragraphs.length; i++) {
    var sents = splitSentences(paragraphs[i]), keep = [];
    for (var j = 0; j < sents.length; j++) {
      var n = sents[j].split(' ').length;
      if (count + n > maxWords && count > 0) break;
      keep.push(sents[j]); count += n;
    }
    if (keep.length) out.push(keep.join(' '));
    if (count >= maxWords) break;
  }
  return out;
}

/** Parse JSON that may be wrapped in ```json fences. */
function parseJsonLoose(text) {
  var t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(t);
}

function normaliseEs(s) {
  return String(s || '').toLowerCase().replace(/^(el|la|los|las|un|una)\s+/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zñ ]/g, '').trim();
}

/* ---------------- Prompts ---------------- */

var HOUSE_RULES = 'Use Castilian Spanish as spoken in Spain (vosotros, Spain vocabulary such as móvil, ordenador, coger). ' +
  'Everything must be correct, natural and suitable for an adult learner. English is British English. Return only JSON, no commentary.';

function exercisePrompt(req) {
  return [
    'You write grammar exercises for a self-study Spanish app.',
    HOUSE_RULES,
    'Unit: "' + req.unitTitle + '" (' + req.level + '). ' + (req.summary || ''),
    'Write ' + req.n + ' NEW exercises for this unit. Use only the grammar of this unit and simpler grammar.',
    req.weakTags && req.weakTags.length ? 'The learner keeps making mistakes with these forms (tags): ' + req.weakTags.join(', ') + '. About half the exercises should practise them.' : '',
    'Allowed tags (use 1–2 per exercise, only from this list): ' + (req.tags || []).join(', ') + '.',
    req.vocabulary && req.vocabulary.length ? 'Where natural, use words the learner is learning: ' + req.vocabulary.join(', ') + '.' : '',
    req.interests && req.interests.length
      ? 'Set the sentences in the learner\'s interests: ' + req.interests.join(', ') + ', and daily life in Spain. Never quote song lyrics or name real celebrities.'
      : 'Prefer sentences about work in construction and window installation, finance, economics, politics and daily life in Spain.',
    'Mix these types: gap, choice, transform, error, translate, reorder, match. Formats (follow exactly):',
    '{"type":"gap","q":"Sentence with exactly one ___","hint":"infinitive or short hint","a":"answer","en":"English translation","tags":["…"]}',
    '{"type":"choice","q":"Sentence with ___","options":["…","…"],"a":0,"why":"short reason","tags":["…"]}  (a = index of the right option)',
    '{"type":"transform","instr":"Short instruction in English","q":"Spanish sentence","a":"rewritten sentence","tags":["…"]}',
    '{"type":"error","q":"Spanish sentence with ONE mistake","a":"corrected sentence","why":"short reason","tags":["…"]}',
    '{"type":"translate","q":"English sentence","a":"Spanish answer / alternative answer","tags":["…"]}',
    '{"type":"reorder","words":["Spanish","words","in","order"],"a":"Spanish words in order","en":"English","tags":["…"]}',
    '{"type":"match","instr":"Short instruction","pairs":[["es","en"],["es","en"],["es","en"],["es","en"]],"tags":["…"]}',
    'Examples from the unit (do not copy them): ' + JSON.stringify(req.samples || []),
    'Do not repeat these existing questions: ' + JSON.stringify((req.avoid || []).slice(0, 40)),
    'Answer as {"exercises":[…]}.'
  ].filter(Boolean).join('\n');
}

function wordsPrompt(req) {
  return [
    'You add vocabulary to a Spanish learning app.',
    HOUSE_RULES,
    'Topic: "' + req.topicName + '", learner level ' + req.level + '.',
    'Give ' + req.n + ' NEW useful words or short phrases for this topic, the most useful first. Nouns with their article (el/la).',
    'Each as ["spanish","english","short example sentence in Spanish","English translation of the example","part of speech: n, v, adj, adv, phr"].',
    'Do not include any of these (already known): ' + JSON.stringify(req.existing || []),
    'Answer as {"words":[[…],[…]]}.'
  ].join('\n');
}

var TEXT_FORMAT = '{"title":"Spanish title","en":"English title","level":"A1|A2|B1","paragraphs":[[["Spanish sentence","English translation"],…],…],' +
  '"glossary":{"word as written, lower case":["dictionary form","meaning in this sentence"],…},' +
  '"questions":[{"q":"question in Spanish","options":["…","…","…"],"a":0},…]}';

function textPrompt(req) {
  return [
    'You write a short graded reading text for a Spanish learning app.',
    HOUSE_RULES,
    'Level ' + req.level + '. About ' + (req.level === 'A1' ? '100' : '150') + ' words in 3 paragraphs. Topic: ' + (req.about || req.topic) + '.',
    'Use grammar suitable for the level (present tense, ir a + infinitive; at A2 also simple past). Make it concrete and realistic.',
    'Give every sentence with an English translation, a glossary entry for EVERY distinct word form in the text (lower case keys), and 3 comprehension questions in simple Spanish with 3 options each.',
    'Format: ' + TEXT_FORMAT
  ].join('\n');
}

function newsPrompt(article, req) {
  return [
    'You prepare a real Spanish news article for a learner (level ' + req.level + ') to read in a study app.',
    HOUSE_RULES,
    'Keep the Spanish sentences EXACTLY as written in the article (you may drop sentences, never rewrite them). Keep at most 12 sentences in 2–4 paragraphs.',
    'Translate each sentence into English. Add a glossary entry for EVERY distinct word form you keep (lower case keys, meaning in this context).',
    'Add 3 comprehension questions in simple Spanish with 3 options each. Estimate the level (A1, A2, B1 or B2).',
    'Format: ' + TEXT_FORMAT,
    'Article title: ' + article.title,
    'Article text:\n' + article.paragraphs.join('\n\n')
  ].join('\n');
}

function reviewPrompt(kind, items) {
  return [
    'You are a careful Spanish teacher from Spain checking material made for learners.',
    'Check each item for: wrong Spanish, a wrong or ambiguous answer, more than one correct option, a wrong translation, or Latin American usage where Spain usage is expected.',
    'Be strict: if in doubt, reject.',
    'Items (' + kind + '): ' + JSON.stringify(items.map(function (x, i) { return { i: i, item: x }; })),
    'Answer as {"verdicts":[{"i":0,"ok":true,"reason":""},…]} with one verdict per item.'
  ].join('\n');
}

function textReviewPrompt(text) {
  return [
    'You are a careful Spanish teacher from Spain. Check this reading text for a learner.',
    'Look for wrong Spanish, wrong English translations, wrong glossary meanings, and comprehension questions whose marked answer is wrong.',
    'Text: ' + JSON.stringify(text),
    'Answer as {"ok":true|false,"problems":["…"]}. Minor style issues are fine; reject only real errors.'
  ].join('\n');
}

/** Basic shape filter before the review pass (the app re-checks everything). */
function cleanExercises(list, allowedTags) {
  var allowed = {};
  (allowedTags || []).forEach(function (t) { allowed[t] = true; });
  return (list || []).filter(function (ex) {
    if (!ex || EXERCISE_TYPES_AI.indexOf(ex.type) < 0) return false;
    if (!Array.isArray(ex.tags) || !ex.tags.length) return false;
    ex.tags = ex.tags.filter(function (t) { return allowed[t]; });
    if (!ex.tags.length && allowedTags && allowedTags.length) ex.tags = [allowedTags[0]];
    if (ex.type === 'gap' && (String(ex.q).match(/___/g) || []).length !== 1) return false;
    if (ex.type === 'choice' && !(Array.isArray(ex.options) && ex.a >= 0 && ex.a < ex.options.length)) return false;
    return true;
  });
}

function cleanWords(list, existing) {
  var seen = {};
  (existing || []).forEach(function (w) { seen[normaliseEs(w)] = true; });
  return (list || []).filter(function (w) {
    if (!Array.isArray(w) || w.length < 4 || !w[0] || !w[1]) return false;
    var k = normaliseEs(w[0]);
    if (!k || seen[k]) return false;
    seen[k] = true;
    return true;
  });
}

/** A long text from your own inbox: keep it real, keep it long, mark the level honestly. */
function inboxPrompt(article) {
  return [
    'You prepare a real Spanish text, supplied by the learner for private study, for reading in a study app.',
    HOUSE_RULES,
    'Keep the Spanish sentences EXACTLY as written (you may drop captions, bylines and boilerplate, never rewrite sentences). Keep up to 30 sentences in natural paragraphs.',
    'Translate each sentence into English. Add a glossary entry for EVERY distinct word form you keep (lower case keys, meaning in this context).',
    'Add 4 comprehension questions in Spanish with 3 options each. Estimate the level honestly (A2, B1, B2 or C1).',
    'Also give "topic": one of construction, finance, economics, politics, news, life.',
    'Format: ' + TEXT_FORMAT.replace('"level":"A1|A2|B1"', '"level":"A2|B1|B2|C1","topic":"…"'),
    'Title: ' + (article.title || '(choose a short title from the text)'),
    'Text:\n' + article.paragraphs.join('\n\n')
  ].join('\n');
}

/** Plain text (from a .txt file or a converted doc) → paragraphs. */
function textToParagraphs(text) {
  return String(text || '').replace(/\r/g, '').split(/\n\s*\n|\n(?=[A-ZÁÉÍÓÚÑ«"¿¡—])/).map(function (p) { return p.replace(/\s+/g, ' ').trim(); })
    .filter(function (p) { return p.length >= 60 && !/cookies|suscr[ií]b|newsletter|todos los derechos|©/i.test(p); });
}
