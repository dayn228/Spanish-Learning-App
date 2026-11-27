# Setting up the backend (Google Drive backup and AI content)

About 15 minutes, once. You need the Google account whose Drive should hold the backups.

When it is done, the app backs up your progress to Drive by itself, and every night your backend asks Gemini for new exercises, words and texts where you are running low, plus real news articles prepared for reading.

## 1. Create the Apps Script project

1. Go to [script.google.com](https://script.google.com) → **New project**. Name it **Mi Español backend**.
2. Open **Project Settings** (gear icon) and copy the **Script ID**.
3. Put the Script ID in `backend/.clasp.json` (`scriptId`) and push. GitHub uploads the code from then on. (Already done: the current script ID is in the file.)

## 2. Let GitHub upload the code

In this repository: **Settings → Secrets and variables → Actions → New repository secret**

- Name: `CLASPRC_JSON`
- Value: run `npx @google/clasp login` on a computer (ideally with a Google account used only for this app) and paste the contents of `~/.clasprc.json`.

The Apps Script API must be on at [script.google.com/home/usersettings](https://script.google.com/home/usersettings).

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

## Adding another learner

Each learner has their own token and their own backups; AI-made content and reading texts are shared.

1. In the Apps Script editor, open `Setup`, find `function addPartner() { addUser('partner'); }` and change `partner` to their name if you like.
2. Choose **addPartner** in the toolbar and press **Run**. The log shows their token.
3. On their iPhone: open the app link in Safari, **Share → Add to Home Screen**, then **You → Google Drive and AI**: the same web app URL, their token.

Their progress stays on their phone and in `backups-<name>` in the Drive folder. `removeUser('name')` takes their access away (their backups stay).

## Your own articles (the inbox)

Drop articles into **Mi Español → inbox** in Drive (from the iPhone: Files app → Google Drive → Mi Español → inbox, or Share → Save to Files from Safari). Google Docs, .txt and .html files work as they are; PDF and Word files are converted with the Drive API, which setup enables.

Each night up to 2 of them become long reading texts (up to about 650 words, the original sentences kept) with translations, a glossary for every word and comprehension questions, then move to **inbox/processed**. They stay private: only your backend and your app see them.

Articles you download with your own subscription are for your own study; keep them in your Drive, not in the public GitHub repository.

## Security

- **Why "Anyone"**: an installed iPhone web app can't send your Google sign-in with its requests, so access limited to signed-in users would block the app. Instead every request must carry the token; without it, the backend refuses everything.
- **What the token protects**: your learning progress and the AI request queue in the Mi Español folder. The backend runs only its fixed list of actions on that folder; it can't be made to read other Drive files, run other code or reveal the Gemini key.
- **Keep the token private**: it is stored only in the app on your phone, and is never written into backups.
- **If it may have leaked**: run `rotateToken` in the editor, then in the app Disconnect and Connect with the new token. The old token stops working at once.
- **Work account**: if the backend runs in a work (Workspace) account, its administrators can reach the files like anything else there. For full separation, set the backend up in a personal Google account instead.

## If something goes wrong

- **"Wrong or missing token"**: the token was not copied completely; run `showStatus` in the editor to see the setup.
- **"Gemini error 404"**: the model name is out of date; set `GEMINI_MODEL` to a current one from AI Studio.
- **"Gemini free-tier limit reached"**: nothing is lost; the queue waits for the next night.
- **No news articles**: a feed may be down or paywalled. The run log (`showStatus`, or `status.json` in the Drive folder) says which.
- In the editor, `testNightly` runs the nightly job by hand and prints what it did.
