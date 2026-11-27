/*
  Service worker: saves every app file on the phone so the app works offline.

  How updates work: `npm run build` rewrites VERSION and FILES below.
  When this file changes, the phone downloads the new version the next time
  the app opens online, and uses it from the launch after that.
*/

const VERSION = '89e4dbbbc2';
const FILES = [
  "./",
  "./css/app.css",
  "./css/themes.css",
  "./css/tokens.css",
  "./data/core/basics.json",
  "./data/core/connectors.json",
  "./data/core/describing.json",
  "./data/core/food.json",
  "./data/core/health.json",
  "./data/core/home.json",
  "./data/core/people.json",
  "./data/core/shopping.json",
  "./data/core/time.json",
  "./data/core/travel.json",
  "./data/core/verbs.json",
  "./data/core/work.json",
  "./data/grammar/index.json",
  "./data/grammar/u01.json",
  "./data/grammar/u02.json",
  "./data/grammar/u03.json",
  "./data/grammar/u04.json",
  "./data/grammar/u05.json",
  "./data/grammar/u06.json",
  "./data/grammar/u07.json",
  "./data/grammar/u08.json",
  "./data/grammar/u09.json",
  "./data/grammar/u10.json",
  "./data/grammar/u11.json",
  "./data/grammar/u12.json",
  "./data/grammar/u13.json",
  "./data/grammar/u14.json",
  "./data/index.json",
  "./data/packs/beauty.json",
  "./data/packs/books.json",
  "./data/packs/construction.json",
  "./data/packs/economics.json",
  "./data/packs/fashion.json",
  "./data/packs/finance.json",
  "./data/packs/music.json",
  "./data/packs/news.json",
  "./data/packs/politics.json",
  "./data/packs/selfcare.json",
  "./data/packs/sport.json",
  "./data/packs/trips.json",
  "./data/reading/common.json",
  "./data/reading/index.json",
  "./data/reading/t01.json",
  "./data/reading/t02.json",
  "./data/reading/t03.json",
  "./data/reading/t04.json",
  "./data/reading/t05.json",
  "./data/reading/t06.json",
  "./data/reading/t07.json",
  "./data/reading/t08.json",
  "./data/reading/t09.json",
  "./data/reading/t10.json",
  "./data/reading/t11.json",
  "./data/reading/t12.json",
  "./fonts/newsreader-latin-400-italic.woff2",
  "./fonts/newsreader-latin-400-normal.woff2",
  "./fonts/newsreader-latin-500-normal.woff2",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./index.html",
  "./js/backdrop.js",
  "./js/check.js",
  "./js/content.js",
  "./js/dates.js",
  "./js/db.js",
  "./js/exercise.js",
  "./js/grammar.js",
  "./js/listening.js",
  "./js/main.js",
  "./js/reading.js",
  "./js/refill.js",
  "./js/session.js",
  "./js/speech.js",
  "./js/srs.js",
  "./js/state.js",
  "./js/streak.js",
  "./js/sync.js",
  "./js/theme.js",
  "./js/ui.js",
  "./js/validate.js",
  "./js/verbs.js",
  "./js/views/drill.js",
  "./js/views/practice.js",
  "./js/views/read.js",
  "./js/views/report.js",
  "./js/views/study.js",
  "./js/views/text.js",
  "./js/views/today.js",
  "./js/views/topic.js",
  "./js/views/topics.js",
  "./js/views/unit.js",
  "./js/views/you.js",
  "./manifest.webmanifest"
];

const CACHE = 'mi-espanol-' + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Delete caches from older versions.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Cache first: answer from the phone, fall back to the network,
  // and for page loads fall back to the cached app page.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    })
  );
});
