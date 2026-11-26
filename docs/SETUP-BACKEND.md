# Setting up the backend (Google Drive backup and AI content)

About 15 minutes, once. You need the Google account whose Drive should hold the backups.

When it is done, the app backs up your progress to Drive by itself, and every night your backend asks Gemini for new exercises, words and texts where you are running low, plus real news articles prepared for reading.

## 1. Create the Apps Script project

1. Go to [script.google.com](https://script.google.com) → **New project**. Name it **Mi Español backend**.
2. Open **Project Settings** (gear icon) and copy the **Script ID**.
3. Send me the Script ID. I put it in `backend/.clasp.json`, and GitHub uploads the code from then on, the same way as Fram-Automation.

## 2. Let GitHub upload the code

In this repository: **Settings → Secrets and variables → Actions → New repository secret**

- Name: `CLASPRC_JSON`
- Value: the same value as the `CLASPRC_JSON` secret in Fram-Automation (same Google account). If you no longer have it, run `npx @google/clasp login` on a computer and paste the contents of `~/.clasprc.json`.

The Apps Script API must be on at [script.google.com/home/usersettings](https://script.google.com/home/usersettings). It already is if Fram-Automation deploys.

Then in **Actions → Deploy backend → Run workflow**. When it finishes, the project in the editor shows the files `Main`, `Store`, `Gemini`, `Jobs`, `Setup` and `Pure`.

## 3. Add your Gemini key

1. Go to [aistudio.google.com](https://aistudio.google.com) → **Get API key** → create a key.
2. In the Apps Script editor: **Project Settings → Script properties → Add script property**
   - `GEMINI_API_KEY` = your key
3. Optional properties:
   - `GEMINI_MODEL`: the model name exactly as AI Studio shows it. The default is `gemini-3.6-flash`. Model names change often; if the nightly run reports an unknown model, copy a current Flash model name from AI Studio.
   - `MAX_CALLS_PER_NIGHT`: default 30, which stays well inside the free tier.
   - `NEWS_FEEDS`: your own feed list, e.g. `[{"topic":"economics","url":"https://…"}]`.

On the free Gemini tier, Google may use what is sent to improve its products. The backend only sends learning content (unit names, word lists, articles), never your progress.

## 4. Run setup

1. In the editor, choose the function **setup** in the toolbar and press **Run**.
2. Google asks for permission. Because this is your own unverified script: **Advanced → Go to Mi Español backend (unsafe) → Allow**. It needs Drive (backups), external requests (Gemini and news feeds) and triggers (the nightly job).
3. Open **Executions** and copy the **APP_TOKEN** from the log.

This creates the **Mi Español** folder in your Drive and schedules the nightly job at about 03:00.

## 5. Publish it as a web app

1. **Deploy → New deployment** → type **Web app**.
2. Execute as: **Me**. Who has access: **Anyone**. (The token keeps it private: requests without it are refused.)
3. **Deploy**, then copy the **Web app URL** (ends in `/exec`).
4. Copy the **Deployment ID** too and add it as a second repository secret, `DEPLOYMENT_ID`. Code updates then go live automatically; without it, each update needs **Deploy → Manage deployments → Edit → New version**.

## 6. Connect the app

On your iPhone: **You → Google Drive and AI** → paste the URL and the token → **Connect**. The first backup runs at once.

Use **Get new content now** to test Gemini without waiting for the night. It takes a few minutes.

## If something goes wrong

- **"Wrong or missing token"**: the token was not copied completely; run `showStatus` in the editor to see the setup.
- **"Gemini error 404"**: the model name is out of date; set `GEMINI_MODEL` to a current one from AI Studio.
- **"Gemini free-tier limit reached"**: nothing is lost; the queue waits for the next night.
- **No news articles**: a feed may be down or paywalled. The run log (`showStatus`, or `status.json` in the Drive folder) says which.
- In the editor, `testNightly` runs the nightly job by hand and prints what it did.
