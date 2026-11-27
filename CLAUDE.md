# Mi Español — handoff for AI assistants (and humans)

Read this first. It tells you what the app is, the rules that keep it working, and
where everything is documented. `AGENTS.md` points here too.

## What it is

A personal, offline-first Castilian Spanish app for iPhone, used by two learners
(the owner and his partner). Plain HTML/CSS/ES modules, no framework, no bundler,
hosted on GitHub Pages and installed to the home screen. Progress lives on the phone
(IndexedDB). An optional Google Apps Script backend in the owner's Google account
backs progress up to Drive and makes new content overnight with Gemini.

- Live app: https://dayn228.github.io/Spanish-Learning-App/
- Repository: https://github.com/dayn228/Spanish-Learning-App (public)

## Where to read next

| You want to… | Read |
|---|---|
| Understand how the code fits together | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Add or change words, grammar, texts, topics | [docs/CONTENT.md](docs/CONTENT.md) |
| Deploy, manage users, backups, fix problems | [docs/OPERATIONS.md](docs/OPERATIONS.md) |
| Set up the backend from scratch | [docs/SETUP-BACKEND.md](docs/SETUP-BACKEND.md) |
| See what was built and what is next | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Make content with ChatGPT / run a review | [docs/prompts/](docs/prompts/) |

## Rules (keep these)

1. **No framework, no build step for the app.** Files are served as they are. `npm run build`
   only validates content, writes the `index.json` files and refreshes `sw.js`.
2. **Before every push:** `npm test` (prints dots, only failures) and `npm run build`
   (must end with `OK:`). The build refuses invalid content.
3. **The repo and the site are public.** Never commit: tokens, the Gemini key, the
   Apps Script URL, backups, learners' progress, articles the owner downloaded
   (those go into the Drive inbox), or anything copyrighted (album covers, fan art,
   song lyrics, logos, photos of real people). Practice texts are written for the app.
4. **Progress belongs to the phone.** Never change the IndexedDB keys or backup format
   without a migration in `js/state.js` (`importBackup` must keep reading old files,
   including the Drive wrapper `{ savedAt, data }`).
5. **Never let a nearly empty phone overwrite a bigger Drive backup.** The guard is in
   `backend/src/Store.gs` (`saveBackup`) and `js/sync.js`; keep both.
6. **Backend changes need a published version.** Pushing `backend/**` uploads the code
   with clasp; the live web app only changes when a new version is deployed (automatic
   if the `DEPLOYMENT_ID` secret is set, otherwise by hand). Bump `VERSION` in `Main.gs`.
7. **Internal user ids stay fixed** (`owner`, `partner`): backup folders are named after
   them. Display names ("Big Daddy", "Wifey") come from `DEFAULT_NAMES` / the `NAMES`
   Script Property.
8. **Every AI-made item is checked twice**: a Gemini review pass in the backend and
   `js/validate.js` in the app. Keep both.
9. **Writing style:** UI text in plain English, sentence case, no jargon. Spanish is
   Castilian (vosotros, Spain vocabulary). Code comments in English.
10. **Accessibility:** every theme passes WCAG AA text contrast; respect Reduce Motion.

## Working on it

```bash
npm test            # unit tests (node --test), no browser needed
npm run build       # validate content, write index files and sw.js
npm run serve       # http://localhost:8000 to try it in a browser
```

The service worker caches everything, so in a desktop browser use a private window or
"Update on reload" in DevTools while developing. On the iPhone, updates load by
themselves when the app opens (it reloads once when a new version takes over).
