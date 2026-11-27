/*
  Checking typed answers.

  Result: 'right'  exact (ignoring case, punctuation and extra spaces)
          'accent' right letters, wrong or missing accents (á é í ó ú ü ñ)
          'accent-key' the same, but the accent changes the word (llego/llegó, el/él, esta/está)
          'article' right word, missing or wrong article (el/la/los/las/un/una)
          'wrong'
*/

const ARTICLES = /^(el|la|los|las|un|una|unos|unas|lo)\s+/;

export function normalise(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[¿?¡!.,;:"«»()…“”„‘’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripAccents(s) {
  // Keep ñ distinct from n: it is a different letter in Spanish.
  return s.replace(/ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'ñ');
}

/** An answer can list alternatives separated by '/', e.g. "el móvil / el teléfono". */
export function alternatives(answer) {
  return String(answer).split('/').map(normalise).filter(Boolean);
}

/* Words whose accent tells them apart from another word (tú/tu, más/mas, está/esta…). */
const ACCENT_PAIRS = new Set(['el', 'tu', 'mi', 'si', 'se', 'de', 'te', 'mas', 'aun', 'que', 'como', 'donde', 'cuando', 'quien', 'cual', 'cuanto', 'cuanta', 'cuantos', 'cuantas', 'adonde', 'esta', 'estas', 'este']);

/* Nouns ending in é/ó, where the accent changes nothing. */
const NOT_VERBS = new Set(['café', 'bebé', 'josé', 'puré', 'cliché', 'dominó', 'buró', 'chalé', 'carné', 'bidé']);

/**
 * Does an accent slip change the word? True when a word that differs only in accents is in
 * ACCENT_PAIRS, or when one of the two forms ends in an accented é or ó: that is almost
 * always a past-tense ending (llegó/llego, trabajé/trabaje). menú, difícil, árbol stay lenient.
 */
export function accentChangesWord(got, want) {
  const a = got.split(' '), b = want.split(' ');
  if (a.length !== b.length) return true;
  return a.some((w, i) => {
    if (w === b[i]) return false;
    const bare = stripAccents(w);
    const final = (x) => /[éó]$/.test(x) && !NOT_VERBS.has(x);
    return ACCENT_PAIRS.has(bare) || final(w) || final(b[i]);
  });
}

/* Optional subject pronouns at the start: "Yo estoy cansado" = "Estoy cansado". */
const SUBJECT = /^(yo|tú|él|ella|usted|nosotros|nosotras|vosotros|vosotras|ellos|ellas|ustedes)\s+/;

export function checkAnswer(input, answer, { dropPronoun = false } = {}) {
  const got = normalise(input);
  if (!got) return 'wrong';
  const options = alternatives(answer);
  if (options.includes(got)) return 'right';
  if (dropPronoun) {
    const strip = (s) => s.replace(SUBJECT, '');
    // Only when the rest is a full sentence (2+ words), so "él" alone isn't swallowed.
    const g = strip(got);
    if (g !== got && g.includes(' ') || options.some((o) => strip(o) !== o)) {
      if (options.some((o) => strip(o) === g)) return 'right';
      const oa = options.find((o) => stripAccents(strip(o)) === stripAccents(g));
      if (oa) return accentChangesWord(g, strip(oa)) ? 'accent-key' : 'accent';
    }
  }
  const sameButAccents = options.find((o) => stripAccents(o) === stripAccents(got));
  if (sameButAccents) return accentChangesWord(got, sameButAccents) ? 'accent-key' : 'accent';
  const bare = (s) => s.replace(ARTICLES, '');
  if (options.some((o) => bare(o) === bare(got) && bare(o) !== o)) return 'article';
  if (options.some((o) => stripAccents(bare(o)) === stripAccents(bare(got)) && bare(o) !== o)) return 'article';
  return 'wrong';
}

/*
  Points for a checked answer. Lenient by default:
  a wrong or missing accent, or a wrong or missing article, still counts as
  right (1 point). The learner just sees a note. Exercises that practise
  articles themselves pass strictArticles, and then an article slip is half.
*/
export function pointsFor(result, { strictArticles = false } = {}) {
  if (result === 'right' || result === 'accent') return 1;
  if (result === 'accent-key') return 0.5;
  if (result === 'article') return strictArticles ? 0.5 : 1;
  return 0;
}

/*
  Grade a typed answer for one exercise (pure, so it is unit-tested).
  On top of checkAnswer/pointsFor:
  - "error" exercises: typing the faulty sentence back unchanged is wrong, even when the
    only mistake is an accent (¿Donde…? → ¿Dónde…?), which checkAnswer would forgive.
  - verb forms (conj, table): the accent is often the whole point (hablo / habló,
    trabaje / trabajé), so an accent slip is half right, not right.
*/
export function gradeAnswer(input, answer, ex = {}) {
  if (ex.type === 'error' && ex.q && normalise(input) === normalise(ex.q)) return { points: 0, kind: 'wrong' };
  const kind = checkAnswer(input, answer, { dropPronoun: ex.type === 'translate' || ex.type === 'transform' });
  const strictArticles = (ex.tags || []).some((t) => String(t).startsWith('article'));
  if (kind === 'accent' && (ex.type === 'conj' || ex.type === 'table')) return { points: 0.5, kind: 'accent-key' };
  return { points: pointsFor(kind, { strictArticles }), kind };
}

/** Match exercises: a right-hand item fits a left one if its text is the same (two pairs may share "el"). */
export function matchFits(pairs, leftIndex, rightIndex) {
  if (leftIndex === rightIndex) return true;
  return normalise(pairs[leftIndex][1]) === normalise(pairs[rightIndex][1]);
}

/** Reorder exercises: the placed words are right if they make any of the listed answers ("a / b"). */
export function reorderRight(placedWords, answer) {
  return alternatives(answer).includes(normalise(placedWords.join(' ')));
}

/*
  Dictation: compare word by word, ignoring case, punctuation and accents.
  Returns { points, marks } where marks lists the expected words with ok=true/false,
  so the screen can show which words were missed.
*/
export function wordDiff(input, expected) {
  // Fully lenient here: accents and ñ/n are ignored (listening is about hearing the words).
  const words = (s) => normalise(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ').filter(Boolean);
  const shown = String(expected).replace(/[¿¡]/g, '').split(/\s+/).filter(Boolean);
  const exp = words(expected);
  const got = words(input);
  // Longest common subsequence of words.
  const L = Array.from({ length: exp.length + 1 }, () => new Array(got.length + 1).fill(0));
  for (let i = exp.length - 1; i >= 0; i--)
    for (let j = got.length - 1; j >= 0; j--)
      L[i][j] = exp[i] === got[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ok = new Array(exp.length).fill(false);
  for (let i = 0, j = 0; i < exp.length && j < got.length;) {
    if (exp[i] === got[j]) { ok[i] = true; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  const matched = ok.filter(Boolean).length;
  const extra = Math.max(0, got.length - matched);
  const points = exp.length ? Math.max(0, (matched - extra * 0.5) / exp.length) : 0;
  const marks = (shown.length === exp.length ? shown : exp).map((w, i) => ({ word: w, ok: ok[i] }));
  return { points: Math.round(points * 100) / 100, marks };
}
