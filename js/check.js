/*
  Checking typed answers.

  Result: 'right'  exact (ignoring case, punctuation and extra spaces)
          'accent' right letters, wrong or missing accents (á é í ó ú ü ñ)
          'article' right word, missing or wrong article (el/la/los/las/un/una)
          'wrong'
*/

const ARTICLES = /^(el|la|los|las|un|una|unos|unas|lo)\s+/;

export function normalise(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[¿?¡!.,;:"«»()…]/g, ' ')
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

export function checkAnswer(input, answer) {
  const got = normalise(input);
  if (!got) return 'wrong';
  const options = alternatives(answer);
  if (options.includes(got)) return 'right';
  if (options.some((o) => stripAccents(o) === stripAccents(got))) return 'accent';
  const bare = (s) => s.replace(ARTICLES, '');
  if (options.some((o) => bare(o) === bare(got) && bare(o) !== o)) return 'article';
  if (options.some((o) => stripAccents(bare(o)) === stripAccents(bare(got)) && bare(o) !== o)) return 'article';
  return 'wrong';
}
