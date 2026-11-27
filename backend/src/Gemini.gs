/**
 * Gemini calls. The API key stays in Script Properties and never reaches the app.
 * Two budgets keep it inside the free tier: per run (MAX_CALLS_PER_NIGHT, default 30) and per
 * day across all runs (MAX_CALLS_PER_DAY, default 60), counted in a CALLS_<date> property.
 */

var geminiCalls = 0;

function QuotaError(message) { this.name = 'QuotaError'; this.message = message; }

function callGemini(prompt, opts) {
  opts = opts || {};
  var key = prop('GEMINI_API_KEY', null);
  if (!key) throw new Error('GEMINI_API_KEY is not set in Script Properties.');
  if (geminiCalls >= Number(prop('MAX_CALLS_PER_NIGHT', 30))) throw new QuotaError('Nightly call budget used up.');
  var props = PropertiesService.getScriptProperties();
  var dayKey = 'CALLS_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var today = Number(props.getProperty(dayKey) || 0);
  if (today >= Number(prop('MAX_CALLS_PER_DAY', 60))) throw new QuotaError('Daily Gemini budget used up; more tomorrow.');
  props.setProperty(dayKey, String(today + 1));
  geminiCalls++;
  var model = prop('GEMINI_MODEL', DEFAULT_MODEL);
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': key },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: opts.temperature === undefined ? 0.7 : opts.temperature },
    }),
  });
  var code = res.getResponseCode();
  if (code === 429) throw new QuotaError('Gemini free-tier limit reached; the rest waits for the next night.');
  if (code >= 400) throw new Error('Gemini error ' + code + ': ' + res.getContentText().slice(0, 300));
  var data = JSON.parse(res.getContentText());
  var parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  var text = parts.map(function (p) { return p.text || ''; }).join('');
  if (!text) throw new Error('Gemini returned no text (' + (((data.candidates || [])[0] || {}).finishReason || 'unknown') + ').');
  return parseJsonLoose(text);
}

/** Second opinion: keep only the items a strict reviewer accepts. */
function reviewItems(kind, items) {
  if (!items.length) return [];
  var r = callGemini(reviewPrompt(kind, items), { temperature: 0 });
  var ok = {};
  (r.verdicts || []).forEach(function (v) { if (v && v.ok === true) ok[v.i] = true; });
  return items.filter(function (_, i) { return ok[i]; });
}
