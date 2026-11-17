# Offline Workout Tracker (PWA) — Design

Approved 2026-11-16.

## Intent
A personal, BodySpace-style workout tracker that is fully owned by the user: pick a free
structured plan, follow it day by day, log every set fast one-handed, and see PRs/charts/history
grow. Static files only — no backend, no keys, no AI at runtime, works in airplane mode,
installable on iPhone/Android.

## Goals
- Fast logging screen: prefilled from last session, steppers, numeric keypad, auto rest timer.
- 5 starter plans + custom plans + one-off workouts; "Today's workout" and plan progress.
- Looping SVG form animation per exercise from one reusable rig + joint-angle keyframes, with
  primary/secondary muscle highlighting and 3–4 cues. ≥15 exercises.
- Progress: history, per-exercise top-set + Epley e1RM chart, PR detection + celebration,
  weekly summary (workouts, volume, streak), bodyweight trend.
- JSON export/import. lb/kg. Dark mode default.

## Non-goals / anti-goals
- No accounts, sync, social, nutrition, ads, external assets/CDNs/fonts.
- Anti-goal: anything that makes logging a set slower than ~2 taps.

## Constraints (platform realities)
- iOS Safari has no `navigator.vibrate` → beep + screen flash; vibrate where supported.
- Audio must be unlocked by a user gesture (checking a set counts).
- No background notifications without a push server → timers are timestamp-based so they're
  correct on return.
- iOS may evict site storage after ~7 days of non-use unless installed → request
  `navigator.storage.persist()`, show "last backup" reminder.

## Approaches
1. **Vanilla JS ES modules, no build step (chosen).** Zero deps, deploy = drag folder. Fits size.
2. Preact + Vite: nicer components, but adds a toolchain and build artifact for little gain.
3. Svelte: smallest runtime-compiled output, same toolchain cost as 2.

## Design
- `index.html`, `css/app.css`, `js/*.js` modules, `data/exercises.js` (exercise library + plans),
  `sw.js`, `manifest.webmanifest`, `icons/`.
- Hash router; tabs: Today · Log · Plans · Progress · Settings.
- Storage: IndexedDB stores `sessions`, `plans`, `bodyweight`, `kv` (settings, active plan
  state, in-progress workout draft); localStorage fallback with same API.
- Schemas: see `js/schema.md` (written during stage 1).
- Charts: hand-rolled SVG line charts.
- Animation rig: 2D side-view figure, segments (torso, head, upper/lower arm, thigh, shin,
  foot) driven by joint angles; equipment (bar/dumbbell/cable/bench) as props; keyframes
  interpolated with easing via requestAnimationFrame. Muscles drawn as shapes attached to
  segments, colored by primary/secondary.

## Left to the builder
Visual styling, exact plan contents, rig proportions, icon artwork.
