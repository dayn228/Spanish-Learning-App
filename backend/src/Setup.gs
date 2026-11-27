/**
 * One-time setup. In the Apps Script editor choose `setup` and press Run.
 *  - creates the "Mi Español" folder in your Drive
 *  - creates APP_TOKEN (the password the app sends)
 *  - schedules the nightly job at about 03:00
 * Then open View → Logs (or Executions) to copy the token.
 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  rootFolder(); subFolder('backups'); subFolder('content'); subFolder('inbox');
  if (!props.getProperty('APP_TOKEN')) props.setProperty('APP_TOKEN', Utilities.getUuid().replace(/-/g, ''));

  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'nightly') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('nightly').timeBased().atHour(3).everyDays(1).create();

  console.log('Folder: ' + rootFolder().getUrl());
  console.log('APP_TOKEN (paste into the app): ' + props.getProperty('APP_TOKEN'));
  console.log(props.getProperty('GEMINI_API_KEY') ? 'Gemini key found.' : 'Gemini key missing: add GEMINI_API_KEY in Project Settings → Script properties.');
  console.log('Next: Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone. Paste the web app URL into the app.');
}

/** Run by hand to test Gemini and the feeds without waiting for the night. */
function testNightly() {
  console.log(JSON.stringify(nightly(), null, 2));
}

/** Prints the current setup. */
function showStatus() {
  var props = PropertiesService.getScriptProperties();
  console.log(JSON.stringify({
    folder: rootFolder().getUrl(),
    model: props.getProperty('GEMINI_MODEL') || DEFAULT_MODEL,
    geminiKey: !!props.getProperty('GEMINI_API_KEY'),
    lastSeq: props.getProperty('LAST_SEQ') || 0,
    queue: readJson(rootFolder(), 'queue.json', []).length,
    lastRun: readJson(rootFolder(), 'status.json', {}),
  }, null, 2));
}

/**
 * Make a new APP_TOKEN, e.g. if the old one may have been seen by someone.
 * The old token stops working at once; paste the new one into the app
 * (You → Google Drive and AI → Disconnect, then Connect with the new token).
 */
function rotateToken() {
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  PropertiesService.getScriptProperties().setProperty('APP_TOKEN', token);
  console.log('New APP_TOKEN (paste into the app): ' + token);
}

/**
 * Add another learner (e.g. addUser('ana')). Prints their token; they connect
 * with the same web app URL and this token. They get their own backups;
 * AI content and texts are shared. Edit the name in the function call, then Run.
 */
function addUser(name) {
  name = String(name || 'friend').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'friend';
  var props = PropertiesService.getScriptProperties();
  var users = JSON.parse(props.getProperty('USERS') || '{}');
  Object.keys(users).forEach(function (t) { if (users[t] === name) delete users[t]; });   // re-adding = new token
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  users[token] = name;
  props.setProperty('USERS', JSON.stringify(users));
  subFolder('backups-' + name);
  console.log('User "' + name + '" added. Their token (paste into their app): ' + token);
}

/** Run this one in the editor: change the name, then Run. */
function addPartner() { addUser('partner'); }

/** Remove a learner's access (their backups stay in Drive). */
function removeUser(name) {
  var props = PropertiesService.getScriptProperties();
  var users = JSON.parse(props.getProperty('USERS') || '{}');
  Object.keys(users).forEach(function (t) { if (users[t] === name) delete users[t]; });
  props.setProperty('USERS', JSON.stringify(users));
  console.log('Removed ' + name + '.');
}
