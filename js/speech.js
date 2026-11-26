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

export function speak(text, rate = 0.9) {
  if (!canSpeak() || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-ES';
  if (voice) u.voice = voice;
  u.rate = rate;
  speechSynthesis.speak(u);
}
