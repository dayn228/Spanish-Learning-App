/*
  Reads Spanish aloud with the phone's built-in voice (works offline).
  Prefers a Spain Spanish (es-ES) voice.
*/

let voice = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'es-ES' && /mónica|monica|jorge|premium|enhanced/i.test(v.name))
    || voices.find((v) => v.lang === 'es-ES')
    || voices.find((v) => v.lang && v.lang.startsWith('es'))
    || null;
}

if ('speechSynthesis' in window) {
  voice = pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', () => { voice = pickVoice(); });
}

export const canSpeak = () => 'speechSynthesis' in window;

/** True when the phone has a Spanish voice installed (checked lazily: voices load late). */
export function hasSpanishVoice() {
  if (!canSpeak()) return false;
  if (!voice) voice = pickVoice();
  return !!voice || speechSynthesis.getVoices().length === 0;   // unknown yet → assume yes
}

/** Speak several texts one after another (used to read a whole text). Returns a stop function. */
export function speakSequence(texts, rate = 0.9, onEach) {
  if (!canSpeak()) return () => {};
  speechSynthesis.cancel();
  let stopped = false;
  texts.forEach((t, i) => {
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'es-ES';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.onstart = () => { if (!stopped && onEach) onEach(i); };
    if (i === texts.length - 1) u.onend = () => { if (!stopped && onEach) onEach(-1); };
    speechSynthesis.speak(u);
  });
  return () => { stopped = true; speechSynthesis.cancel(); if (onEach) onEach(-1); };
}

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel();
}

export function speak(text, rate = 0.9) {
  if (!canSpeak() || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-ES';
  if (voice) u.voice = voice;
  u.rate = rate;
  speechSynthesis.speak(u);
}
