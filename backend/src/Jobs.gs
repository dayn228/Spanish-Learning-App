/**
 * The nightly job (runs about 03:00, and on "Get new content now").
 *
 * Works through the refill queue, oldest first, within a time limit and a
 * Gemini call budget:
 *   exercises → 20 new exercises for a grammar unit, reviewed, saved as a batch
 *   words     → 30 new words for a topic, reviewed, saved as a batch
 *   text      → a graded practice text (e.g. construction), reviewed
 *   news      → 1–2 real articles from the news feeds, prepared for reading
 * A request that fails 3 times is dropped. Hitting the free-tier limit stops
 * the run; the rest waits for the next night.
 */

var TIME_LIMIT_MS = 5 * 60 * 1000;   // Apps Script stops runs at 6 minutes

var DEFAULT_FEEDS = [
  { topic: 'finance', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.elpais.com/portada' },
  { topic: 'economics', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.elpais.com/portada' },
  { topic: 'economics', url: 'https://rss.elconfidencial.com/economia/' },
  { topic: 'politics', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana/portada' },
  { topic: 'news', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada' },
];

function nightly() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { skipped: 'Another run is in progress.' };
  var started = Date.now(), log = [], made = 0;
  geminiCalls = 0;
  try {
    var queue = readJson(rootFolder(), 'queue.json', []);
    var order = { exercises: 0, words: 1, news: 2, text: 3 };
    var rank = function (k) { return k in order ? order[k] : 9; };   // note: exercises is 0, so no `|| 9`
    queue.sort(function (a, b) { return rank(a.kind) - rank(b.kind) || (a.added < b.added ? -1 : 1); });
    var remaining = [];
    for (var i = 0; i < queue.length; i++) {
      var req = queue[i];
      if (Date.now() - started > TIME_LIMIT_MS) { remaining = remaining.concat(queue.slice(i)); log.push('Time limit: ' + (queue.length - i) + ' requests wait for the next run.'); break; }
      try {
        var n = runJob(req);
        made += n;
        log.push(req.key + ': ' + n + ' new items');
      } catch (err) {
        if (err instanceof QuotaError) { remaining = remaining.concat(queue.slice(i)); log.push(err.message); break; }
        req.tries = (req.tries || 0) + 1;
        log.push(req.key + ' failed (' + req.tries + '/3): ' + err.message);
        if (req.tries < 3) remaining.push(req);
      }
    }
    writeJson(rootFolder(), 'queue.json', remaining);
  } finally {
    var status = { lastRun: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 1000), made: made, calls: geminiCalls, log: log };
    writeJson(rootFolder(), 'status.json', status);
    lock.releaseLock();
  }
  return { made: made, log: log };
}

function runJob(req) {
  switch (req.kind) {
    case 'exercises': return jobExercises(req);
    case 'words': return jobWords(req);
    case 'text': return jobText(req);
    case 'news': return jobNews(req);
    default: throw new Error('Unknown request kind ' + req.kind);
  }
}

function jobExercises(req) {
  var r = callGemini(exercisePrompt(req));
  var items = cleanExercises(r.exercises, req.tags);
  items = reviewItems('grammar exercises for unit "' + req.unitTitle + '"', items);
  if (!items.length) throw new Error('No exercises passed review.');
  saveBatch('exercises', { unitId: req.unitId }, items);
  return items.length;
}

function jobWords(req) {
  var r = callGemini(wordsPrompt(req));
  var items = cleanWords(r.words, req.existing);
  items = reviewItems('vocabulary for topic "' + req.topicName + '"', items);
  if (!items.length) throw new Error('No words passed review.');
  saveBatch('words', { topicId: req.topicId, topicName: req.topicName }, items);
  return items.length;
}

function jobText(req) {
  var t = callGemini(textPrompt(req), { temperature: 0.8 });
  var verdict = callGemini(textReviewPrompt(t), { temperature: 0 });
  if (!verdict.ok) throw new Error('Text rejected in review: ' + (verdict.problems || []).join('; '));
  t.topic = req.topic; t.practice = true;
  saveBatch('texts', { topic: req.topic }, [t]);
  return 1;
}

function jobNews(req) {
  var feeds = DEFAULT_FEEDS;
  try { if (prop('NEWS_FEEDS', null)) feeds = JSON.parse(prop('NEWS_FEEDS', '[]')); } catch (e) { /* keep defaults */ }
  var wanted = (req.topics && req.topics.length) ? req.topics : ['economics'];
  var seen = {}; seenNews().forEach(function (l) { seen[l] = true; });
  var made = 0, tried = 0, maxArticles = req.n || 2;
  var candidates = feeds.filter(function (f) { return wanted.indexOf(f.topic) >= 0; });
  if (!candidates.length) candidates = feeds;

  for (var i = 0; i < candidates.length && made < maxArticles && tried < 4; i++) {
    var feed = candidates[i], items;
    try {
      var res = UrlFetchApp.fetch(feed.url, { muteHttpExceptions: true, followRedirects: true });
      if (res.getResponseCode() >= 400) continue;
      items = parseFeed(res.getContentText());
    } catch (e) { continue; }
    var item = items.filter(function (x) { return !seen[x.link]; })[0];
    if (!item) continue;
    tried++;
    rememberNews(item.link); seen[item.link] = true;

    var paragraphs = [];
    try {
      var page = UrlFetchApp.fetch(item.link, { muteHttpExceptions: true, followRedirects: true });
      if (page.getResponseCode() < 400) paragraphs = extractParagraphs(page.getContentText(), 10);
    } catch (e) { /* paywalled or blocked: fall back to the summary */ }
    if (paragraphs.length < 2 && item.description && item.description.length > 80) paragraphs = [item.description];
    if (!paragraphs.length) continue;
    paragraphs = trimToWords(paragraphs, req.level === 'A1' ? 120 : 180);

    var t = callGemini(newsPrompt({ title: item.title, paragraphs: paragraphs }, req), { temperature: 0.2 });
    t.topic = feed.topic;
    t.source = { name: hostName(item.link), url: item.link, title: item.title };
    saveBatch('texts', { topic: feed.topic }, [t]);
    made++;
  }
  if (!made) throw new Error('No new article could be prepared (feeds empty, blocked or already used).');
  return made;
}

function hostName(url) {
  var m = /^https?:\/\/(?:www\.)?([^/]+)/.exec(url || '');
  return m ? m[1] : '';
}
