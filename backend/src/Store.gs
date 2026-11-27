/**
 * Storage in your Google Drive, folder "Mi Español":
 *   backups/latest.json, backups/backup-YYYY-MM-DD.json (last 14 days kept)
 *   backups-<name>/…               the same for each extra user (addUser)
 *   inbox/                         drop articles here; the nightly job turns them into texts
 *   content/batch-000001.json …    AI content, in order (the app asks for "since n")
 *   queue.json                     refill requests waiting for the nightly job
 *   seen-news.json                 article links already used
 *   reports.json                   items you marked "This looks wrong"
 *   status.json                    what the last nightly run did
 */

function rootFolder() {
  var id = prop('FOLDER_ID', null);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* folder gone: make a new one */ } }
  var folder = DriveApp.createFolder('Mi Español');
  PropertiesService.getScriptProperties().setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function subFolder(name) {
  var root = rootFolder();
  var it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

function readJson(folder, name, fallback) {
  var it = folder.getFilesByName(name);
  if (!it.hasNext()) return fallback;
  try { return JSON.parse(it.next().getBlob().getDataAsString('UTF-8')); } catch (e) { return fallback; }
}

function writeJson(folder, name, obj) {
  var text = JSON.stringify(obj);
  var it = folder.getFilesByName(name);
  if (it.hasNext()) it.next().setContent(text);
  else folder.createFile(name, text, 'application/json');
}

/* ---------- Backups ---------- */

function backupFolder(user) {
  return subFolder(!user || user === 'owner' ? 'backups' : 'backups-' + user);
}

function saveBackup(data, user) {
  if (!data || data.app !== 'mi-espanol') throw new Error('Not a Mi Español backup.');
  var folder = backupFolder(user);
  var savedAt = new Date().toISOString();
  var payload = { savedAt: savedAt, data: data };
  writeJson(folder, 'latest.json', payload);
  writeJson(folder, 'backup-' + savedAt.slice(0, 10) + '.json', payload);
  // Keep the newest 14 daily copies; older ones go to the Drive bin (recoverable for 30 days).
  var dated = [], it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (/^backup-\d{4}-\d{2}-\d{2}\.json$/.test(f.getName())) dated.push(f); }
  dated.sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; });
  dated.slice(14).forEach(function (f) { f.setTrashed(true); });
  return savedAt;
}

function loadBackup(user) {
  var b = readJson(backupFolder(user), 'latest.json', null);
  return b ? { data: b.data, savedAt: b.savedAt } : { data: null, savedAt: null };
}

function listBackups(user) {
  var out = [], it = backupFolder(user).getFiles();
  while (it.hasNext()) { var f = it.next(); out.push({ name: f.getName(), savedAt: f.getLastUpdated().toISOString() }); }
  return out.sort(function (a, b) { return a.name < b.name ? 1 : -1; });
}

/* ---------- Refill queue ---------- */

function addToQueue(requests, user) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var queue = readJson(rootFolder(), 'queue.json', []);
    var keys = {}; queue.forEach(function (q) { keys[q.key] = true; });
    var added = 0;
    requests.forEach(function (r) {
      if (!r || !r.key || !r.kind || keys[r.key]) return;
      r.added = new Date().toISOString(); r.tries = 0; r.user = user || 'owner';
      queue.push(r); keys[r.key] = true; added++;
    });
    writeJson(rootFolder(), 'queue.json', queue.slice(-50));
    return added;
  } finally { lock.releaseLock(); }
}

/* ---------- Content batches ---------- */

function saveBatch(kind, meta, items) {
  var props = PropertiesService.getScriptProperties();
  var seq = Number(props.getProperty('LAST_SEQ') || 0) + 1;
  props.setProperty('LAST_SEQ', String(seq));
  var batch = { seq: seq, kind: kind, createdAt: new Date().toISOString(), meta: meta || {}, items: items };
  writeJson(subFolder('content'), 'batch-' + ('000000' + seq).slice(-6) + '.json', batch);
  return seq;
}

function batchesSince(after, limit) {
  var last = Number(prop('LAST_SEQ', 0));
  var out = [], folder = subFolder('content');
  for (var s = after + 1; s <= last && out.length < limit; s++) {
    var b = readJson(folder, 'batch-' + ('000000' + s).slice(-6) + '.json', null);
    if (b) out.push(b);
  }
  return { batches: out, last: last };
}

/* ---------- Reports and news memory ---------- */

function addReport(item, reason) {
  var list = readJson(rootFolder(), 'reports.json', []);
  list.push({ at: new Date().toISOString(), reason: String(reason || '').slice(0, 300), item: item });
  writeJson(rootFolder(), 'reports.json', list.slice(-300));
}

function seenNews() { return readJson(rootFolder(), 'seen-news.json', []); }
function rememberNews(link) {
  var list = seenNews(); list.push(link);
  writeJson(rootFolder(), 'seen-news.json', list.slice(-500));
}
