/**
 * Mi Español backend: the app's only connection to the internet services.
 *
 * The app sends POST requests (Content-Type text/plain, so the browser does
 * not need a CORS preflight) with a JSON body: { token, action, ... }.
 * Every request must carry a user's token: APP_TOKEN (you, made by setup())
 * or one made by addUser('name') for someone else. Each user has their own
 * backups; AI content and reading texts are shared.
 *
 * Actions:
 *   ping            → { ok, version, ai }            check the connection
 *   backup.save     { data }    → { savedAt }        progress to Drive (latest + daily copy)
 *   backup.load     → { data, savedAt }               newest backup
 *   backup.list     → { backups: [{ name, savedAt }] }
 *   queue.add       { requests } → { queued }         refill requests from the app
 *   content.since   { after }   → { batches, last }   new AI content (batches after seq `after`)
 *   content.add     { pack, forEveryone? } → { batches, added }   a content pack pasted in the app
 *   report          { item, reason } → { ok }         "This looks wrong"
 *   status          → last nightly run and errors
 *   nightly.run     → runs the nightly job now (takes a few minutes)
 *
 * Script Properties (Project Settings → Script properties):
 *   GEMINI_API_KEY        required for AI content
 *   GEMINI_MODEL          optional, default below; copy exact names from AI Studio
 *   MAX_CALLS_PER_NIGHT   optional, default 30
 *   NEWS_FEEDS            optional JSON: [{"topic":"economics","url":"https://…"}]
 *   APP_TOKEN, FOLDER_ID  set by setup()
 *   USERS                 set by addUser(): {"token": "name"}
 */

var VERSION = 10;
var DEFAULT_MODEL = 'gemini-3.6-flash';

function prop(name, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(name);
  return v === null || v === '' ? fallback : v;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  // Opening the URL in a browser only shows that the backend is up; nothing else without the token.
  return json({ ok: true, app: 'mi-espanol' });
}

var MAX_BACKUP = 2 * 1024 * 1024;
var MAX_BODY = 5 * 1024 * 1024;   // backups are far smaller; refuse anything bigger

function doPost(e) {
  var body;
  if (!e || !e.postData || e.postData.contents.length > MAX_BODY) return json({ ok: false, error: 'Request too large.' });
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'Request is not JSON.' }); }
  var user = body && userForToken(body.token);
  if (!user) return json({ ok: false, error: 'Wrong or missing token.' });
  try {
    return json(route(body, user));
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

/** 'owner' for APP_TOKEN, the name for a token made by addUser(), else null. */
function userForToken(token) {
  if (!token || typeof token !== 'string') return null;
  if (token === prop('APP_TOKEN', null)) return 'owner';
  var users = {};
  try { users = JSON.parse(prop('USERS', '{}')); } catch (e) { /* no extra users */ }
  return Object.prototype.hasOwnProperty.call(users, token) ? users[token] : null;
}

function route(body, user) {
  switch (body.action) {
    case 'ping': return { ok: true, version: VERSION, user: user, name: displayName(user), ai: !!prop('GEMINI_API_KEY', null), model: prop('GEMINI_MODEL', DEFAULT_MODEL) };
    case 'backup.save':
      if (JSON.stringify(body.data || null).length > MAX_BACKUP) return { ok: false, error: 'This backup is larger than 2 MB; that should never happen. Please report it.' };
      return Object.assign({ ok: true }, saveBackup(body.data, user, !!body.force));
    case 'content.add': {
      var parts = splitPack(body.pack, body.forEveryone ? undefined : user);
      var counts = { exercises: 0, words: 0, texts: 0 };
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(30000)) return { ok: false, error: 'The backend is busy making content. Try again in a few minutes.' };
      try { parts.forEach(function (p) { saveBatch(p.kind, p.meta, p.items); counts[p.kind] += p.items.length; }); }
      finally { lock.releaseLock(); }
      return { ok: true, batches: parts.length, added: counts };
    }
    case 'backup.load': return Object.assign({ ok: true }, loadBackup(user, body.name));
    case 'backup.list': return { ok: true, backups: listBackups(user) };
    case 'queue.add': {
      var reqs = (Array.isArray(body.requests) ? body.requests : []).slice(0, 30)
        .filter(function (r) { return JSON.stringify(r).length <= 20000; });
      return { ok: true, queued: addToQueue(reqs, user) };
    }
    case 'content.since': return Object.assign({ ok: true }, batchesSince(Number(body.after) || 0, 30));
    case 'report': addReport(body.item, body.reason); return { ok: true };
    case 'status': return Object.assign({ ok: true }, readJson(rootFolder(), 'status.json', {}), { queue: readJson(rootFolder(), 'queue.json', []).length });
    case 'nightly.run': {
      // "Get new content now": once an hour per learner, so taps (or a leaked token) can't drain the free tier.
      var props = PropertiesService.getScriptProperties(), key = 'MANUAL_RUN_' + user;
      var last = Number(props.getProperty(key) || 0);
      if (Date.now() - last < 60 * 60 * 1000) {
        return { ok: false, error: 'New content was already requested in the last hour. Try again after ' + Utilities.formatDate(new Date(last + 3600000), Session.getScriptTimeZone(), 'HH:mm') + '.' };
      }
      props.setProperty(key, String(Date.now()));
      return Object.assign({ ok: true }, nightly());
    }
    default: return { ok: false, error: 'Unknown action: ' + body.action };
  }
}

/* What the app calls each learner. Internal ids (owner, partner) stay the same so
   backup folders keep working; change a name with setName('partner', 'Wifey'). */
var DEFAULT_NAMES = { owner: 'Big Daddy', partner: 'Wifey' };
function displayName(user) {
  var names = JSON.parse(PropertiesService.getScriptProperties().getProperty('NAMES') || '{}');
  return names[user] || DEFAULT_NAMES[user] || user;
}
