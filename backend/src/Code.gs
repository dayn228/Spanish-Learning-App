/**
 * Mi Español backend (Apps Script). Built in phase 4:
 *   - Drive backup and restore of progress
 *   - Gemini proxy (the API key lives in Script Properties, never in the app)
 *   - Nightly news job and the content refill queue
 *
 * For now it only answers a health check, so the deploy pipeline can be tested.
 */

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, app: 'mi-espanol', phase: 1 }))
    .setMimeType(ContentService.MimeType.JSON);
}
