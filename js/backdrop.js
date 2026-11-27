/*
  Your own background photo, chosen from the phone's photo library.

  The picture is shrunk (longest side 1400 px, JPEG) and kept only on this phone
  (localStorage). It is never uploaded, never in the backups and never in the
  public repository. A soft veil in the theme's page colour sits on top so text
  stays readable, and the theme's accent colour can follow the photo.
*/

const KEY = 'mi-espanol-photo';
const MAX = 1400;

export function loadPhoto() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

/** Show the saved photo (or nothing). Call after applyTheme. */
export function applyPhoto(photo = loadPhoto()) {
  const root = document.documentElement;
  let layer = document.getElementById('backdrop');
  if (!photo) {
    root.classList.remove('has-photo');
    root.style.removeProperty('--clay');
    layer?.remove();
    return;
  }
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'backdrop';
    layer.setAttribute('aria-hidden', 'true');
    document.body.prepend(layer);
  }
  layer.style.backgroundImage = `url("${photo.src}")`;
  layer.style.setProperty('--veil', String(photo.veil ?? 0.72));
  root.classList.add('has-photo');
  if (photo.matchAccent && photo.accent) root.style.setProperty('--clay', photo.accent);
  else root.style.removeProperty('--clay');
}

export function savePhoto(photo) {
  try {
    if (photo) localStorage.setItem(KEY, JSON.stringify(photo));
    else localStorage.removeItem(KEY);
  } catch {
    throw new Error('The photo is too big to keep on this phone. Try a smaller one.');
  }
  applyPhoto(photo);
}

/** Read a picked file, shrink it, and find an accent colour in it. */
export async function photoFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That file is not a picture this phone can open.'));
      i.src = url;
    });
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const src = c.toDataURL('image/jpeg', 0.8);
    return { src, accent: accentFrom(img), veil: 0.72, matchAccent: true };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The most colourful mid-tone in the picture, as a hex colour (or null). */
export function accentFrom(img) {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, 48, 48);
  const data = ctx.getImageData(0, 0, 48, 48).data;
  return pickAccent(data);
}

/** Exported for tests: data is RGBA bytes. Buckets hues, takes the most colourful busy bucket. */
export function pickAccent(data) {
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = hsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.3 || l < 0.2 || l > 0.85) continue;
    const k = Math.round(h / 20);
    const b = buckets.get(k) || { n: 0, h: 0, s: 0, l: 0 };
    b.n += 1; b.h += h; b.s += s; b.l += l;
    buckets.set(k, b);
  }
  let best = null;
  for (const b of buckets.values()) {
    const score = b.n * (b.s / b.n);
    if (!best || score > best.score) best = { score, h: b.h / b.n, s: b.s / b.n, l: b.l / b.n };
  }
  if (!best || best.score < 20) return null;
  // Keep it readable as an accent: not too pale, not too dark.
  return hex(best.h, Math.min(0.85, Math.max(0.45, best.s)), Math.min(0.62, Math.max(0.45, best.l)));
}

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hex(h, s, l) {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
