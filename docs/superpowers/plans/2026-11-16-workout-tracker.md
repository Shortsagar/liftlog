# Offline Workout Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, offline-first PWA workout tracker (plans → logging → form animations → progress) that runs entirely on-device.

**Architecture:** Vanilla ES modules, no build step. Pure logic modules (`js/model.js`, `js/plans.js`, `js/rig.js` math) are DOM-free so Node's built-in test runner can test them; views render into `#app` via a hash router. IndexedDB persistence behind a tiny async KV/store API with a localStorage fallback.

**Tech Stack:** HTML, CSS, vanilla JS (ES2020 modules), IndexedDB, Service Worker, inline SVG. Tests: `node --test` (Node 24, no deps). Local server: `python3 -m http.server`.

**Spec:** `docs/superpowers/specs/2026-11-16-workout-tracker-design.md`

## Global Constraints
- Zero runtime dependencies, no CDNs, no external fonts/images, no network calls besides the app's own files.
- Dark mode default; mobile-first; tap targets ≥ 44px; numeric inputs use `inputmode="decimal"` / `"numeric"`.
- Weights stored canonically in **kg** (float); displayed in the user's unit (`lb` default), rounded to 0.1 and trailing `.0` stripped.
- Weight stepper increments: 5 lb or 2.5 kg default; selectable 2.5/5 lb and 1.25/2.5 kg in settings.
- Default rest 90 s, adjustable. Beep (WebAudio) + `navigator.vibrate` where available + screen flash.
- e1RM = Epley: `w * (1 + r/30)`, and `w` when `r === 1`; 0 when `r === 0`.
- Exercise library and starter plans live in `data/exercises.js` and `data/plans.js` (plain editable data).
- Not a git repo: skip commit steps unless the user asks for git.

## Review Focus
1. **Refresh / app kill mid-workout** → in-progress workout restored from `kv.draft`, workout & rest timers resume from stored timestamps (Task 3, test `draft survives reload`).
2. **Blank or comma-decimal inputs** (`""`, `"62,5"`) → blank = untouched (falls back to prefill), comma parsed as decimal; unchecked sets never count toward volume/PRs (Task 2 tests `parseNum`, `sessionVolume ignores undone`).
3. **Switching lb↔kg with history present** → history/charts convert, no false PRs from rounding (Task 2 test `no PR from unit round-trip`).
4. **Importing a bad or foreign JSON file** → rejected with a message, existing data untouched (Task 9 test `importAll rejects invalid`).
5. **Bodyweight / timed exercises** (pull-up w=0, plank in seconds) → PRs detected on reps/seconds when weight is 0; chart shows reps (Task 2 test `bodyweight PR on reps`).

---

### Task 1: Scaffold, data model, storage

**Files:**
- Create: `index.html`, `css/app.css`, `js/app.js`, `js/ui.js`, `js/db.js`, `data/exercises.js`, `data/plans.js` (stub, filled in Task 4), `SCHEMA.md`, `tests/db.test.js`

**Interfaces — Produces:**
- `data/exercises.js`: `export const EXERCISES = [ { id, name, equipment, primary: string[], secondary: string[], cues: string[], metric: 'reps'|'seconds', bodyweight: bool, anim: {...} } ]`, `export const byId = id => Exercise`.
- `js/db.js`: `openStore(backend?)` returning `{ get(store,id), put(store,obj), del(store,id), all(store), kvGet(key, dflt), kvSet(key, val), clear() }`; stores: `sessions`, `plans`, `bodyweight`, `kv`. Backend auto-picks IndexedDB, falls back to localStorage; tests inject an in-memory backend.
- `js/ui.js`: `h(tag, attrs, ...children)` DOM builder, `toast(msg)`, `modal(contentEl) -> close()`.
- `js/app.js`: hash router `#/today`, `#/log`, `#/plans`, `#/plan/:id`, `#/progress`, `#/exercise/:id`, `#/session/:id`, `#/settings`; bottom tab bar.
- `SCHEMA.md`: Exercise, Plan, ActivePlan, Session, Set, BodyweightEntry, Settings shapes.

- [ ] Write `tests/db.test.js`: `put/get/all/del roundtrip`, `kvGet returns default`, using the memory backend.
- [ ] Run `node --test tests/` → FAIL (module missing).
- [ ] Implement `js/db.js`, seed `EXERCISES` with the 15 required lifts (names, muscles, cues, metric; `anim` stubbed `{}`).
- [ ] Run `node --test tests/` → PASS. Open `python3 -m http.server 8080` → tab bar renders, no console errors.

### Task 2: Pure workout logic

**Files:** Create `js/model.js`, `tests/model.test.js`

**Interfaces — Produces (`js/model.js`):**
- `toDisplay(kg, unit) -> number`, `fromDisplay(val, unit) -> kg`, `fmtW(kg, unit) -> string`
- `parseNum(str) -> number|null` (comma → dot, blank → null)
- `epley(w, r) -> number`
- `bestSet(sets) -> {w,r,e1rm}|null` (done sets only; by e1RM, ties → heavier)
- `lastPerformance(sessions, exId) -> Set[]|null` (done sets from most recent session containing exId)
- `sessionVolume(session) -> kg` (Σ w·r over done sets)
- `detectPRs(session, priorSessions) -> [{exId, type:'weight'|'e1rm'|'reps', value}]`; weighted exercises use max weight and max e1RM; bodyweight/timed use max reps/seconds; compare with a 0.01 kg tolerance.
- `weeklySummary(sessions, now) -> {workouts, volumeKg, streakWeeks}` (Mon-start weeks; streak = consecutive weeks with ≥1 workout ending this or last week)

- [ ] Write tests: `epley(100,10) ≈ 133.33`, `epley(100,1)=100`; `parseNum("62,5")=62.5`, `parseNum("")=null`; `sessionVolume ignores undone`; `lastPerformance picks most recent`; `detectPRs first-ever session is not a PR`; `bodyweight PR on reps`; `no PR from unit round-trip` (135 lb → kg → stored → re-logged 135 lb gives no PR); `weeklySummary streak 3`.
- [ ] Run → FAIL. Implement. Run → PASS.

### Task 3: Logging screen + timers  *(end of Stage 1 — demo)*

**Files:** Create `js/views/log.js`, `js/timer.js`; modify `css/app.css`, `js/app.js`

**Interfaces:**
- Consumes: Task 1 db/ui, Task 2 model.
- Produces: `startWorkout({name, planRef|null, exercises:[{exId, sets, reps}]})` writes `kv.draft` and routes to `#/log`. Draft shape = Session with `endedAt: null`.
- `js/timer.js`: `restTimer.start(sec)`, `.stop()`, `.adjust(±sec)`, `onTick`, `onDone`; state persisted as `{endsAt}` in `kv.rest`. `beep()`, `unlockAudio()`.

Behaviour: sticky header with elapsed workout timer + Finish; per-exercise card: name, "Last: 135 × 8", notes field, set rows `[#] [− weight +] [− reps +] [✓]`, add/remove set, swap exercise (picker modal), add exercise. Inputs prefilled from `lastPerformance` else plan target reps. Checking a set starts the rest timer (bottom sheet, ±15 s, skip). Every change saves the draft (debounced 300 ms). Finish → run `detectPRs`, save session, clear draft, show summary + PR celebration (confetti SVG burst + toast).

- [ ] Test (`tests/model.test.js`): `draft survives reload` — save draft via memory store, reopen, deep-equal.
- [ ] Implement; with Today screen showing a "Quick workout" button.
- [ ] Verify in browser pane at 375×812: start quick workout, add bench, log 3 sets, rest timer starts, reload mid-workout → draft and timer intact, finish → appears in storage. **Show user.**

### Task 4: Plans  *(Stage 2 — demo)*

**Files:** Fill `data/plans.js`; create `js/plans.js`, `js/views/plans.js`, `js/views/today.js`, `tests/plans.test.js`

**Interfaces — Produces:**
- Plan: `{ id, name, summary, level, builtIn, weeks: [{ days: [{ name, exercises: [{exId, sets, reps}] }] }] }`; helper `repeatWeeks(n, weekFn)`.
- Starter plans: Full Body Beginner 3×/wk (8 wk), Push/Pull/Legs (6 days, 8 wk), Upper/Lower 4-day (8 wk), 5×5 Strength (A/B alternating, 12 wk), Dumbbell-only Home 3×/wk (8 wk).
- `js/plans.js`: `currentDay(plan, active) -> {week, day, dayDef}|null`, `advance(plan, active, sessionId) -> active`, `progress(plan, active) -> {week, totalWeeks, done, total}`.
- ActivePlan in `kv.activePlan`: `{ planId, week, day, startedAt, done: [{week, day, sessionId}] }`.
- Views: plan library, plan detail (weeks/days), "Start plan", custom plan builder (name, weeks, days, exercises with sets×reps) saved to `plans` store, one-off workout builder. Today shows "Week 3 of 8 · 9/24 done" and today's exercises with Start.

- [ ] Tests: `currentDay at start = w1d1`, `advance wraps to next week`, `advance past last day → completed`, `progress counts done`.
- [ ] FAIL → implement → PASS. Verify in browser: start PPL, log Day 1, Today advances to Day 2. **Show user.**

### Task 5: Form animation rig  *(Stage 3 — demo)*

**Files:** Create `js/rig.js`, `tests/rig.test.js`; fill `anim` in `data/exercises.js`; modify `js/views/log.js`

**Interfaces — Produces (`js/rig.js`):**
- `anim = { view:'side'|'front', duration: ms, props: ['barbell'|'dumbbell'|'cable'|'bench'|'inclineBench'|'pullupBar'|'legPress'], root: {x,y}|keyframed, keyframes: [{ t: 0..1, pose: { hip, knee, ankle, trunk, shoulder, elbow, neck } }] }` — angles in degrees, relative to parent segment.
- `samplePose(keyframes, t) -> pose` (cosine-eased interpolation, loops).
- `forwardKinematics(pose, root, dims) -> { joints: {head, neck, shoulder, elbow, wrist, hip, knee, ankle, toe} }`.
- `mountAnimation(el, exercise, {size}) -> { play(), pause(), destroy() }` — draws figure segments as rounded strokes; muscle shapes (chest, frontDelt, sideDelt, rearDelt, lats, traps, biceps, triceps, forearms, abs, lowerBack, glutes, quads, hamstrings, calves) attached to segments, filled with `--primary` / `--secondary` per exercise; caption "Primary: … · Secondary: …"; cues list; tap → enlarged modal; play/pause button; pauses when offscreen (IntersectionObserver) and honours `prefers-reduced-motion` (starts paused).

- [ ] Tests: `samplePose t=0 equals first keyframe`, `samplePose midway interpolates`, `forwardKinematics straight standing: ankle below hip` and `segment lengths preserved`.
- [ ] FAIL → implement → PASS. Author keyframes for all 15 exercises. Verify each visually in a `#/library` grid. **Show user.**

### Task 6: Progress  *(Stage 4 — demo)*

**Files:** Create `js/chart.js`, `js/views/progress.js`, `js/views/exercise.js`, `js/views/session.js`, `js/views/body.js`

**Interfaces:**
- `lineChart({ series: [{ name, points: [{x: ms, y}], color }], yLabel, height }) -> SVGElement` (auto axes, tap a point → value tooltip, empty state message).
- Progress tab: weekly summary card, plan progress card, history list (date, name, duration, volume, PR badges) → `#/session/:id` (detail, delete with confirm), exercise list → `#/exercise/:id` (top-set weight + e1RM chart, PR list, recent sets), bodyweight log + trend chart (7-entry moving average line).

- [ ] Seed a demo dataset via a hidden Settings button "Load sample history" (removable). Verify charts, PR badges, streak. **Show user.**

### Task 7: Settings, backup, PWA/offline, README  *(Stage 5 — demo)*

**Files:** Create `js/views/settings.js`, `js/backup.js`, `tests/backup.test.js`, `sw.js`, `manifest.webmanifest`, `icons/` (svg + 192/512/180 PNG generated by `tools/make-icons.mjs` using `zlib`), `README.md`

**Interfaces:**
- `exportAll(store) -> {app:'liftlog', version:1, exportedAt, sessions, plans, bodyweight, kv}`; `importAll(store, obj)` validates `app` and `version` and array types **before** clearing; throws `Error('Not a valid backup file')`.
- Settings: unit, increment, rest default, sound, vibrate, export (download `.json`), import (file input + confirm), last-backup date, `navigator.storage.persist()` request, reset all data (confirm).
- `sw.js`: precache list of every app file with versioned cache name; cache-first, cleanup old caches on activate; update toast when new SW waiting.

- [ ] Tests: `export→import roundtrip deep-equal`, `importAll rejects invalid` (store unchanged).
- [ ] FAIL → implement → PASS.
- [ ] Verify: 375×812 viewport, load once, go offline (SW serving / network blocked), reload → app works; log full workout, refresh, data persists; export file downloads valid JSON. README: run locally, GitHub Pages, Netlify drop, Add to Home Screen iOS/Android, backup advice. **Show user.**
