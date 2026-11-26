/*
  Small helpers for building the screens.

  h('div', { class: 'card', onclick: fn }, 'text', child, ...) creates an
  element. Text is always set as text, never as HTML, so word data can never
  break the page.
*/

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Inline SVG icon from a path list (stroke icons, 24×24). */
export function icon(paths, size = 22) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

export const ICONS = {
  today: ['M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M4 10h16', 'M9 3v4', 'M15 3v4'],
  topics: ['M5 4h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z', 'M14 4h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z', 'M5 13h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z', 'M14 13h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z'],
  practice: ['M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z', 'M8.5 12.5l2.5 2.5 4.5-5'],
  read: ['M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z', 'M12 6v13.5'],
  you: ['M12 5.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z', 'M5 20c1-4 4-6 7-6s6 2 7 6'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  speaker: ['M4 10v4h4l5 4V6L8 10H4z', 'M16 9c1.5 1.5 1.5 4.5 0 6'],
  back: ['M15 5l-7 7 7 7'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
};

let toastTimer = null;
export function toast(message) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
}

/** Dots for a list of stages ('new' | 'learning' | 'known'). */
export function dots(stages, columns) {
  return h('div', { class: 'dots', 'aria-hidden': 'true', style: columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : null },
    stages.map((s) => h('span', { class: 'dot' + (s === 'new' ? '' : ' ' + s) })));
}

export function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }
