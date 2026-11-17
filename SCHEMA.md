# LiftLog data model

All data lives on the device in IndexedDB (database `liftlog` at the origin root, or `liftlog:<encoded installation path>` in a subdirectory; uses localStorage when IndexedDB is absent).
Every record has a string `id`. **Weights are always stored in kilograms** (floats) and converted
for display, so switching lb ↔ kg never changes history or creates false PRs.

Stores: `sessions`, `plans` (custom plans only), `bodyweight`, `kv` (key → value).

## Exercise — `database/exercises.js` (read-only library, edit the file to change it)

```js
{
  id: 'bench-press',            // stable; referenced by plans and sessions — never rename
  name: 'Barbell Bench Press',
  equipment: 'barbell',          // barbell | dumbbell | cable | machine | bodyweight
  primary: ['chest'],            // keys of MUSCLES
  secondary: ['triceps', 'frontDelts'],
  cues: ['…', '…', '…'],         // 3–4 short form cues
  metric: 'reps',                // 'reps' | 'seconds' (plank)
  bodyweight: false,             // true → weight field means *added* weight; PRs tracked on reps
  anim: Animation,               // see below
}
```

### Animation (figure rig, `src/rig.js`)

```js
{
  view: 'side',                  // 'side' (default) | 'front'
  duration: 3000,                // ms per loop
  anchor: { joint: 'ankle', x: 92, y: 175 },   // joint pinned in the 200×200 frame; floor is y = 180
  pins: [{ limb: 'arm', target: [148, 176], bend: 'back' }],  // optional: keep a hand/foot planted (IK)
  props: [{ type: 'barbell', at: 'wrist' }],   // barbell | dumbbell | bar | roller (at a joint), cable, pad, bench, plate, pullupBar
  keyframes: [{ t: 0, pose: { trunk: 5, head: 0, uArm: 200, fArm: 345, thigh: 180, shin: 180, foot: 95 } }, …],
}
```

Pose angles are degrees in screen space: **0 = up, 90 = forward (the figure faces right), 180 = down,
270 = back**. Keys: `trunk` (hip→shoulder), `head`, `uArm`, `fArm`, `thigh`, `shin`, `foot`, plus far-side
`uArm2 fArm2 thigh2 shin2 foot2` (default to the near side). Clips loop from the last keyframe back to the
first with cosine easing. Preview while editing: `tools/anim-preview.html`.

## Plan — `database/plans.js` (built-in) and store `plans` (custom)

```js
{
  id: 'push-pull-legs' | 'custom-…',
  name, summary, level, daysPerWeek,
  builtIn: true | false,
  weeks: [ { days: [ { name: 'Push 1', exercises: [ { exId: 'bench-press', sets: 4, reps: '6-8' } ] } ] } ],
}
```
`reps` is a number or a string: `5`, `"8-12"`, `"30s"`. New custom plans repeat one template week. Copies and edits preserve a multiweek schedule. Schedule changes to an active plan or a draft-referenced plan create a new plan ID, preserving existing references.

## Active plan — `kv['activePlan']`

```js
{ planId, week: 0, day: 0, startedAt: ms, completedAt: ms | null,
  done: [ { week, day, sessionId } ] }   // week/day point at the next workout (0-based)
```

## Session (a finished workout) — store `sessions`

```js
{
  id, date: ms /* start */, endedAt: ms, durationSec,
  name: 'Push 1',
  planRef: { planId, week, day } | null,
  notes: '',
  exercises: [ { exId, notes, target: { sets, reps }, sets: [ Set ] } ],
  prs: [ { exId, type: 'weight' | 'e1rm' | 'reps', value, prev } ],
  sample?: true                  // only on generated sample data
}
```

### Set
```js
{ w: kg | null, r: reps (or seconds for timed exercises) | null, done: boolean }
```
Saved sessions keep only completed sets. Estimated 1RM = Epley: `w × (1 + r/30)` (`w` when r = 1).

## In-progress workout — `kv['draft']`
Same shape as a Session with `endedAt: null`; each exercise also carries `last` (the sets from the previous
time, used for "Last: 135 × 8" and pre-fill). Queued for persistence on every change. The UI indicates when persistence completes and exposes retry/export recovery on failure.

## Rest timer — `kv['rest']`
`{ endsAt: ms, total: sec }` — absolute end time so it survives locking the phone or reloading.

## Body weight — store `bodyweight`
```js
{ id, date: ms, kg, sample?: true }
```

## Settings — `kv['settings']`
```js
{ unit: 'lb' | 'kg', incLb: 2.5 | 5, incKg: 1.25 | 2.5, restSec: 90, autoRest: true,
  sound: true, vibrate: true, theme: 'dark' | 'light' | 'system', showDemos: true, lastBackupAt: ms | null }
```

## Backup file (Settings → Export)
```js
{ app: 'liftlog', version: 1, exportedAt: ms, sessions: [...], plans: [...], bodyweight: [...], kv: [...] }
```
Import validates nested structures, IDs, limits and active-plan references before replacing anything. All stores are replaced in one transaction; any failure preserves the original records. Internal `kv` keys beginning with `__` contain installation migration metadata and are neither exported nor replaced on import. Ordinary single-record mutations and workout completion also use transactions.
