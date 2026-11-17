# LiftLog: offline workout tracker

A BodySpace-style workout tracker that runs entirely on your phone. It has no backend, no account, no API keys, and no network calls after the first load. It installs to your home screen and works in airplane mode.

- **Plans:** 5 free starter plans (Full Body Beginner, Push/Pull/Legs, Upper/Lower 4-day, 5×5 Strength, Dumbbell-only Home), your own custom plans, and one-off workouts. "Today's workout" tracks which week and day you're on.
- **Fast logging:** weight and reps steppers, a numeric keypad, sets pre-filled from last time ("Last: 135 × 8"), add/remove/swap, notes, an auto rest timer, and a workout clock. Edits are saved within a fraction of a second (rapid typing is grouped into one write, and anything pending is written immediately when you leave the screen or switch apps). The log shows Saving, Saved, or a failure with retry and backup controls.
- **Form guides:** a looping SVG figure for each of 31 exercises, with primary and secondary muscles highlighted and form cues. Tap to enlarge, with pause/play.
- **Progress:** history, a per-exercise chart of top set and estimated 1RM (Epley), automatic PR detection with a little celebration, a weekly summary (workouts, volume, streak), plan progress, and a bodyweight trend.
- **Your data:** stored on the device in IndexedDB, with a localStorage fallback. You can export and import a JSON backup.

---

## Run it on your computer

You need Python 3, which macOS already has. Node 18+ is only needed for the tests and helper scripts.

```bash
cd "Old Bodyspace"
python3 tools/serve.py 8080
```

Open **http://localhost:8080**. (`npm start` does the same thing.) The dev server turns off browser caching, but the service worker still caches the app, as it does in production. After you edit files, see "Changing the app" below.

Run the unit and regression tests using Node's built-in test runner, with nothing to install:

```bash
npm test
```

Additional checks:

```bash
npm run test:server
npm run test:browser
```

Browser checks launch Chrome with a disposable profile and a loopback-only test server. They cover native IndexedDB transactions, logging/reload/finish, modal focus, plan customization, and an actual offline reload. On macOS the runner uses the installed Google Chrome; elsewhere it uses `chromium`. Set `CHROME_PATH` to override the executable. No browser-testing packages are required.

The dev server binds only to this computer and serves app assets. To allow a phone on your local network to load the assets, explicitly run `python3 tools/serve.py 8080 --lan`. HTTPS is still needed for installation/offline support away from localhost.

**To test offline:** load the app once, stop the server (Ctrl-C), then reload the page. Everything keeps working.

---

## Deploy for free

Both options give you an `https://` address. Offline mode and installing to the home screen require HTTPS (localhost is the only exception).

### Option A: Netlify Drop (no account setup, about 1 minute)

1. Build a clean folder that contains only the app files:
   ```bash
   npm run dist
   ```
   This creates `dist/`, so hidden folders such as `.remember` and `.superpowers` don't get uploaded.
2. Open **https://app.netlify.com/drop** and sign in (free).
3. Drag the **`dist`** folder onto the page.
4. Netlify gives you an address like `https://random-name-123.netlify.app`. To get a nicer address, go to **Site configuration → Change site name**.
5. To update later: run `npm run dist` again, open your site in Netlify, go to **Deploys**, and drag the new `dist` folder onto it.

### Option B: GitHub Pages

1. Create a free account at github.com, then click **New repository**. Name it something like `liftlog`, make it **Public** (free Pages needs public), and click **Create repository**.
2. Put the files in the repository.
   - **Without git:** on the new repo page, click **uploading an existing file**. Open the `dist` folder from step A1 and drag its *contents* (not the folder itself) into the browser, then click **Commit changes**.
   - **With git** (from this folder):
     ```bash
     git init
     ```
     ```bash
     git add .
     ```
     ```bash
     git commit -m "LiftLog"
     ```
     ```bash
     git branch -M main
     ```
     ```bash
     git remote add origin https://github.com/YOUR-USERNAME/liftlog.git
     ```
     ```bash
     git push -u origin main
     ```
     (`.gitignore` keeps out `dist/` and the private `.remember/` notes. The app runs from the repo root, so tests and tools are pushed too, which is harmless.)
3. In the repo, go to **Settings → Pages**. Under **Build and deployment**, set **Source: Deploy from a branch**, **Branch: `main`**, **Folder: `/ (root)`**, then click **Save**.
4. Wait about a minute and refresh. The page shows your address: `https://YOUR-USERNAME.github.io/liftlog/`.
5. To update later: upload the changed files (or `git push`). See "Changing the app" first.

All paths in the app are relative, so it works in a sub-folder such as `/liftlog/` with no configuration.

---

## Install it on your phone

### iPhone (must use Safari)
1. Open your app's address in **Safari**. Chrome on iPhone also has this option on recent iOS, but Safari is the most reliable.
2. Tap the **Share** button (the square with an arrow).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Open LiftLog **from the new home-screen icon**. It runs full-screen like an app.
5. Turn on **Airplane Mode** and open it again to confirm it works offline.

### Android (Chrome)
1. Open your app's address in **Chrome**.
2. Tap **Install** if the banner appears. Otherwise tap the **⋮** menu → **Install app** (or **Add to Home screen**).
3. Open it from the home screen or app drawer. Then test it in airplane mode.

The first visit downloads and caches the whole app, about 300 KB. After that it never needs the network.

---

## Your data, backups and moving to a new phone

- Everything is stored **only on that phone**. Nothing is uploaded anywhere.
- To back up, go to **Settings → Your data → Export backup**. On a phone this opens the share sheet, so save the file to Files, iCloud Drive, Google Drive, or email it to yourself. On a computer it downloads `liftlog-backup-YYYY-MM-DD.json`. Today's screen reminds you if you haven't backed up in 30 days.
- To move to a new phone: install the app on the new phone, then go to **Settings → Import** and pick the backup file. Import validates nested records, numeric limits, unique IDs, settings, and plan progress before writing. Replacement is transactional: a failed restore leaves the original data intact.
- **Storage protection:** Settings shows whether the browser has agreed not to clear your data. On iPhone, add the app to the Home Screen; Safari can wipe data for websites you haven't opened in 7 days, but not for installed apps. Keep backups anyway.
- **Save failures:** the logging screen keeps unsaved edits in memory and blocks navigation until a save succeeds. Use **Retry save** or **Export backup** before closing. If persistence cannot be opened, startup displays a recovery error instead of silently presenting an empty database. If neither storage API exists, a prominent temporary-storage warning appears.
- **Plan edits:** customizations preserve every week, including the alternating 5×5 schedule. Changing the schedule of an active plan or a plan referenced by a draft creates a revised copy. **Save** leaves the current plan intact; **Save & start plan** starts the revision from the beginning.
- **Separate installations:** subdirectory installations now use separate databases and service-worker caches. On upgrade, the first installation to claim the legacy shared database copies it into its scoped database; the original remains available. Other installations can import an exported backup. Export/import is also the supported way to move data to a different URL.
- **Sample data:** **Settings → Load sample history** adds 8 weeks of tagged demo workouts so you can explore the charts. **Remove sample** deletes only those. Sample workouts can appear in demonstration charts, but never supply weights or PR comparisons for real workouts.

### Phone limitations (these come from the platforms, not bugs)
- **iPhone can't vibrate from web apps.** The rest timer beeps and flashes instead. The beep follows the ring/silent switch.
- **No alerts while the app is in the background.** That needs a push server. The rest timer counts using the real clock, so it's correct when you come back, and it alerts you then.

---

## Changing the app

| What | Where |
|---|---|
| Exercises, muscles, cues and **form animations** | `data/exercises.js` (one file; the ANIMATIONS section is at the bottom) |
| Built-in plans | `data/plans.js` |
| Data model reference | `SCHEMA.md` |
| Preview every animation at 4 points in the rep | open `http://localhost:8080/tools/anim-preview.html` (add `?ex=squat,deadlift` to filter) |
| Regenerate the icons | `npm run icons` |

**After changing any app file, run `npm run build-sw`.** It updates the service worker's file list and version. Installed phones then show **"Update ready — tap to reload"** the next time they open the app while online. `npm test` fails if you forget.

Adding an exercise means adding one `ex(...)` entry plus an `ANIMATIONS['your-id']` clip made of a few joint-angle keyframes. You don't draw any new artwork. The angle conventions are explained at the top of the ANIMATIONS section and in `SCHEMA.md`.

## Project layout

```
index.html, manifest.webmanifest, sw.js   app shell, install manifest, offline cache
css/app.css                               all styles (dark default, light theme)
data/exercises.js  data/plans.js          the editable library and starter plans
js/app.js          router, tab bar, service worker registration
js/db.js           transactional IndexedDB / localStorage / in-memory storage
js/model.js        units, Epley 1RM, PR detection, weekly summary (pure)
js/workout.js      building/finishing sessions, pre-fill (pure)
js/plans.js        plan progression (pure)      js/progress.js  charts data, sample history (pure)
js/rig.js          figure kinematics + IK (pure) js/figure.js    SVG renderer for the rig
js/chart.js        SVG line/bar charts           js/backup.js    validated, atomic export/import
js/views/*.js      one file per screen
tests/             node --test suites
tools/             dev server, icon generator, sw builder, dist builder, animation preview
```

The localStorage backend stores one atomic JSON snapshot and uses Web Locks when available to coordinate windows. On older browsers without Web Locks, use one app window at a time. Its cost grows with history size; IndexedDB is preferred. Service-worker freshness tests are read-only (`node tools/build-sw.mjs --check`).
