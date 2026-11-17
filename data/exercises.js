// ─────────────────────────────────────────────────────────────────────────────
// EXERCISE LIBRARY — edit freely. Each exercise is plain data.
//
//   id         unique kebab-case id (referenced by plans and saved sessions — don't rename)
//   name       display name
//   equipment  barbell | dumbbell | cable | machine | bodyweight
//   primary    target muscles (strong highlight)   — keys of MUSCLES below
//   secondary  assisting muscles (light highlight)
//   cues       3–4 short form cues
//   metric     'reps' or 'seconds' (timed holds like plank)
//   bodyweight true if load is your body (weight field = added weight, usually 0)
//   anim       looping form animation for the figure rig — see ANIMATIONS at the bottom of this file
//              and js/rig.js for the angle conventions. New exercise = new keyframes, no new artwork.
// ─────────────────────────────────────────────────────────────────────────────

export const MUSCLES = {
  chest: 'Chest', frontDelts: 'Front Delts', sideDelts: 'Side Delts', rearDelts: 'Rear Delts',
  traps: 'Traps', upperBack: 'Upper Back', lats: 'Lats', lowerBack: 'Lower Back',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  abs: 'Abs', obliques: 'Obliques',
  glutes: 'Glutes', quads: 'Quads', hamstrings: 'Hamstrings', adductors: 'Inner Thighs', calves: 'Calves',
};

const ex = (id, name, equipment, primary, secondary, cues, opts = {}) =>
  ({ id, name, equipment, primary, secondary, cues, metric: 'reps', bodyweight: false, ...opts });

export const EXERCISES = [
  // ── Chest ──
  ex('bench-press', 'Barbell Bench Press', 'barbell', ['chest'], ['triceps', 'frontDelts'], [
    'Pinch shoulder blades together and down',
    'Feet planted, slight arch in upper back',
    'Lower to mid-chest, elbows ~45° from torso',
    'Press up and slightly back over the shoulders',
  ]),
  ex('incline-db-press', 'Incline Dumbbell Press', 'dumbbell', ['chest'], ['frontDelts', 'triceps'], [
    'Bench at 30–45°',
    'Lower dumbbells to upper chest with control',
    'Wrists stacked over elbows',
    'Press up and slightly in, don\'t clank at the top',
  ]),
  ex('db-bench-press', 'Dumbbell Bench Press', 'dumbbell', ['chest'], ['triceps', 'frontDelts'], [
    'Shoulder blades back and down',
    'Lower until dumbbells reach chest level',
    'Elbows ~45°, forearms vertical',
    'Press up in a slight arc',
  ]),
  ex('push-up', 'Push-up', 'bodyweight', ['chest'], ['triceps', 'frontDelts', 'abs'], [
    'Body in one straight line, glutes tight',
    'Hands just outside shoulders',
    'Chest to an inch off the floor',
    'Elbows ~45°, not flared',
  ], { bodyweight: true }),

  // ── Shoulders ──
  ex('overhead-press', 'Overhead Press', 'barbell', ['frontDelts'], ['triceps', 'sideDelts', 'traps'], [
    'Squeeze glutes and brace abs — no leaning back',
    'Bar starts on front delts, grip just outside shoulders',
    'Move your head back, then press straight up',
    'Lock out with bar over mid-foot',
  ]),
  ex('db-shoulder-press', 'Dumbbell Shoulder Press', 'dumbbell', ['frontDelts'], ['triceps', 'sideDelts'], [
    'Sit tall, back against the pad',
    'Start with dumbbells at ear height',
    'Press up without arching your lower back',
    'Lower under control to ear height',
  ]),
  ex('lateral-raise', 'Lateral Raise', 'dumbbell', ['sideDelts'], ['traps', 'frontDelts'], [
    'Slight bend in the elbows, locked in place',
    'Lead with the elbows, raise to shoulder height',
    'Don\'t shrug — keep traps quiet',
    'Lower slowly, 2–3 seconds',
  ]),
  ex('face-pull', 'Face Pull', 'cable', ['rearDelts'], ['upperBack', 'traps'], [
    'Rope at upper-chest to face height',
    'Pull toward your forehead, hands apart',
    'Finish with elbows high and thumbs back',
    'Pause and squeeze the upper back',
  ]),

  // ── Back ──
  ex('deadlift', 'Deadlift', 'barbell', ['glutes', 'hamstrings', 'lowerBack'], ['quads', 'traps', 'forearms', 'lats'], [
    'Bar over mid-foot, shins touch the bar',
    'Flat back, chest up, lats tight',
    'Push the floor away, bar drags up the legs',
    'Stand tall — hips through, no leaning back',
  ]),
  ex('barbell-row', 'Barbell Row', 'barbell', ['lats', 'upperBack'], ['biceps', 'rearDelts', 'lowerBack'], [
    'Hinge to ~45°, flat back, knees soft',
    'Pull bar to lower ribs',
    'Drive elbows back, squeeze shoulder blades',
    'Lower with control — no torso swing',
  ]),
  ex('db-row', 'One-Arm Dumbbell Row', 'dumbbell', ['lats', 'upperBack'], ['biceps', 'rearDelts'], [
    'Hand and knee on bench, back flat',
    'Pull dumbbell toward your hip',
    'Elbow close to the body',
    'Full stretch at the bottom',
  ]),
  ex('lat-pulldown', 'Lat Pulldown', 'cable', ['lats'], ['biceps', 'upperBack', 'rearDelts'], [
    'Grip just wider than shoulders',
    'Lean back slightly, chest up',
    'Pull bar to upper chest, elbows down and back',
    'Control the bar back up to a full stretch',
  ]),
  ex('pull-up', 'Pull-up', 'bodyweight', ['lats'], ['biceps', 'upperBack', 'forearms'], [
    'Start from a dead hang, shoulders engaged',
    'Pull chest toward the bar',
    'Chin clears the bar, no kipping',
    'Lower all the way under control',
  ], { bodyweight: true }),
  ex('seated-cable-row', 'Seated Cable Row', 'cable', ['upperBack', 'lats'], ['biceps', 'rearDelts'], [
    'Sit tall, slight knee bend',
    'Pull handle to your stomach',
    'Squeeze shoulder blades together',
    'Let shoulders stretch forward on the return, back stays straight',
  ]),

  // ── Arms ──
  ex('db-curl', 'Dumbbell Curl', 'dumbbell', ['biceps'], ['forearms'], [
    'Elbows pinned to your sides',
    'Curl up and turn the palms toward you',
    'Squeeze at the top',
    'Lower slowly, no swinging',
  ]),
  ex('hammer-curl', 'Hammer Curl', 'dumbbell', ['biceps', 'forearms'], [], [
    'Palms face each other throughout',
    'Elbows stay at your sides',
    'Curl to shoulder height',
    'Control the lowering',
  ]),
  ex('barbell-curl', 'Barbell Curl', 'barbell', ['biceps'], ['forearms'], [
    'Shoulder-width grip, palms up',
    'Elbows fixed at your sides',
    'Curl without leaning back',
    'Full extension at the bottom',
  ]),
  ex('triceps-pushdown', 'Triceps Pushdown', 'cable', ['triceps'], [], [
    'Elbows pinned to your sides',
    'Push down until arms are fully straight',
    'Squeeze triceps at the bottom',
    'Only the forearms move',
  ]),
  ex('overhead-triceps-ext', 'Overhead Triceps Extension', 'dumbbell', ['triceps'], [], [
    'Hold one dumbbell overhead with both hands',
    'Elbows point forward, close to head',
    'Lower behind the head for a deep stretch',
    'Extend fully without flaring elbows',
  ]),

  // ── Legs ──
  ex('squat', 'Back Squat', 'barbell', ['quads', 'glutes'], ['hamstrings', 'lowerBack', 'abs'], [
    'Bar on upper back, brace hard',
    'Knees track over toes',
    'Sit down to at least parallel',
    'Drive up through mid-foot, chest up',
  ]),
  ex('goblet-squat', 'Goblet Squat', 'dumbbell', ['quads', 'glutes'], ['abs', 'hamstrings'], [
    'Hold dumbbell at chest, elbows down',
    'Sit between your heels',
    'Elbows brush inside the knees',
    'Stand tall, squeeze glutes',
  ]),
  ex('leg-press', 'Leg Press', 'machine', ['quads'], ['glutes', 'hamstrings'], [
    'Feet shoulder-width, mid-platform',
    'Lower until knees reach ~90°',
    'Keep lower back on the pad',
    'Press without locking the knees hard',
  ]),
  ex('romanian-deadlift', 'Romanian Deadlift', 'barbell', ['hamstrings', 'glutes'], ['lowerBack', 'forearms'], [
    'Soft knees, push hips back',
    'Bar slides down the thighs',
    'Stop at a hamstring stretch — back stays flat',
    'Drive hips forward to stand',
  ]),
  ex('db-rdl', 'Dumbbell Romanian Deadlift', 'dumbbell', ['hamstrings', 'glutes'], ['lowerBack'], [
    'Dumbbells close to the legs',
    'Hinge at the hips, soft knees',
    'Lower to mid-shin with a flat back',
    'Squeeze glutes to stand',
  ]),
  ex('lunge', 'Dumbbell Lunge', 'dumbbell', ['quads', 'glutes'], ['hamstrings', 'calves'], [
    'Step forward, torso upright',
    'Both knees bend to ~90°',
    'Back knee hovers just above the floor',
    'Push through the front heel to return',
  ]),
  ex('bulgarian-split-squat', 'Bulgarian Split Squat', 'dumbbell', ['quads', 'glutes'], ['hamstrings'], [
    'Rear foot on a bench, laces down',
    'Drop straight down, front shin near vertical',
    'Front knee tracks over toes',
    'Drive up through the front heel',
  ]),
  ex('hip-thrust', 'Hip Thrust', 'barbell', ['glutes'], ['hamstrings'], [
    'Upper back on bench, bar over hips',
    'Feet flat, shins vertical at the top',
    'Drive hips up, ribs down',
    'Pause and squeeze glutes at the top',
  ]),
  ex('leg-curl', 'Lying Leg Curl', 'machine', ['hamstrings'], ['calves'], [
    'Pad just above the heels',
    'Hips pressed into the bench',
    'Curl heels toward glutes',
    'Lower slowly to full extension',
  ]),
  ex('leg-extension', 'Leg Extension', 'machine', ['quads'], [], [
    'Knees lined up with machine pivot',
    'Extend until legs are straight',
    'Squeeze quads at the top',
    'Lower under control',
  ]),
  ex('calf-raise', 'Standing Calf Raise', 'machine', ['calves'], [], [
    'Balls of feet on the edge',
    'Full stretch at the bottom',
    'Rise as high as possible',
    'Pause at the top, no bouncing',
  ]),

  // ── Core ──
  ex('plank', 'Plank', 'bodyweight', ['abs'], ['obliques', 'lowerBack', 'frontDelts'], [
    'Elbows under shoulders',
    'Straight line from head to heels',
    'Squeeze glutes, tuck ribs down',
    'Breathe — don\'t hold your breath',
  ], { metric: 'seconds', bodyweight: true }),

  // ── Gym machines (Planet Fitness–style floor: Smith machines, selectorized and plate-loaded machines) ──
  ex('smith-squat', 'Smith Machine Squat', 'machine', ['quads', 'glutes'], ['hamstrings', 'abs'], [
    'Bar across upper back, feet a half-step in front of it',
    'Unrack with a twist of the wrists, set the safety stops',
    'Sit down to parallel, knees track over toes',
    'Drive up through the whole foot, re-rack at the top',
  ]),
  ex('smith-bench-press', 'Smith Machine Bench Press', 'machine', ['chest'], ['triceps', 'frontDelts'], [
    'Bench positioned so the bar lands on your lower chest',
    'Shoulder blades pinched, feet planted',
    'Lower straight down with elbows ~45°',
    'Press straight up — the rails guide the path',
  ]),
  ex('chest-press-machine', 'Seated Chest Press Machine', 'machine', ['chest'], ['triceps', 'frontDelts'], [
    'Seat height so the handles line up with mid-chest',
    'Back flat on the pad, shoulder blades down',
    'Press out until arms are straight, don\'t lock hard',
    'Return slowly until you feel a chest stretch',
  ]),
  ex('shoulder-press-machine', 'Seated Shoulder Press Machine', 'machine', ['frontDelts'], ['triceps', 'sideDelts'], [
    'Handles start just above shoulder height',
    'Back and head against the pad',
    'Press overhead without arching your lower back',
    'Lower under control to the start',
  ]),
  ex('machine-row', 'Seated Machine Row', 'machine', ['upperBack', 'lats'], ['biceps', 'rearDelts'], [
    'Chest against the pad, seat so handles are at chest height',
    'Pull elbows back past your torso',
    'Squeeze shoulder blades together at the end',
    'Let the shoulders reach forward on the return',
  ]),
  ex('assisted-pull-up', 'Assisted Pull-up Machine', 'machine', ['lats'], ['biceps', 'upperBack', 'forearms'], [
    'Kneel on the pad — more counterweight = more help',
    'Start from straight arms, shoulders engaged',
    'Pull until your chin clears the handles',
    'Lower slowly; reduce the assist as you get stronger',
  ], { bodyweight: true }),
  ex('assisted-dip', 'Assisted Dip Machine', 'machine', ['triceps', 'chest'], ['frontDelts'], [
    'Kneel on the pad, grip the dip handles',
    'Lean slightly forward, elbows back not out',
    'Lower until upper arms are about parallel',
    'Press back up to straight arms',
  ], { bodyweight: true }),
  ex('seated-leg-curl', 'Seated Leg Curl', 'machine', ['hamstrings'], ['calves'], [
    'Knees lined up with the machine pivot',
    'Lap pad snug on your thighs',
    'Curl heels down and back as far as you can',
    'Return slowly, don\'t let the stack slam',
  ]),
  ex('hip-abduction', 'Hip Abductor Machine', 'machine', ['glutes'], [], [
    'Sit tall, pads on the outside of the knees',
    'Push knees out as wide as you can',
    'Pause and squeeze the side of your hips',
    'Bring legs back slowly — don\'t let the weights touch',
  ]),
  ex('hip-adduction', 'Hip Adductor Machine', 'machine', ['adductors'], [], [
    'Sit tall, pads on the inside of the knees',
    'Start wide at a comfortable stretch',
    'Squeeze knees together and pause',
    'Open back up slowly',
  ]),
  ex('ab-crunch-machine', 'Ab Crunch Machine', 'machine', ['abs'], ['obliques'], [
    'Feet under the rollers, grip the handles by your shoulders',
    'Curl your ribs toward your hips',
    'Exhale hard and squeeze at the bottom',
    'Return slowly — don\'t pull with your arms',
  ]),
  ex('back-extension', '45° Back Extension', 'machine', ['lowerBack', 'glutes'], ['hamstrings'], [
    'Pad just below your hip bones, heels under the rollers',
    'Arms crossed on your chest',
    'Lower with a flat back to a hamstring stretch',
    'Rise until body is a straight line — don\'t hyperextend',
  ], { bodyweight: true }),
  ex('machine-biceps-curl', 'Machine Biceps Curl', 'machine', ['biceps'], ['forearms'], [
    'Seat so your elbows line up with the pivot',
    'Backs of the upper arms flat on the pad',
    'Curl up and squeeze at the top',
    'Lower all the way to a full stretch',
  ]),
];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATIONS — one looping clip per exercise, driven by the figure rig (js/rig.js).
//   Angles (degrees, screen space): 0 = up, 90 = forward (figure faces right), 180 = down, 270 = back.
//   pose keys: trunk head uArm fArm thigh shin foot  (+ uArm2 fArm2 thigh2 shin2 foot2 for the far side)
//   anchor: the joint pinned in the 200×200 frame (ankle | hip | wrist | toe).  Floor is y = 180.
//   props: barbell | dumbbell (at a joint), bar/roller (small round at a joint), cable (pulley → joint),
//          pad (thick line from → to), plate (footplate at a joint, perpendicular to `angle`), pullupBar.
//   pins: [{ limb: 'arm'|'leg', target: [x, y], bend: 'front'|'back' }] keep a hand/foot planted (solved per frame).
//   keyframes: [{ t: 0..1, pose }] — the clip loops from the last keyframe back to the first.
// ─────────────────────────────────────────────────────────────────────────────
const KF = (...pairs) => pairs.map(([t, pose]) => ({ t, pose }));
const LEGS = { thigh: 180, shin: 180, foot: 95 };
const STAND = { trunk: 0, head: 0, uArm: 180, fArm: 180, ...LEGS };
/** Standard rep: hold start, move to end, hold, return. */
const REP = (a, b, [h1, mv, h2] = [0.1, 0.5, 0.58]) => KF([0, a], [h1, a], [mv, b], [h2, b]);

const ANIMATIONS = {
  'squat': { duration: 3200, anchor: { joint: 'ankle', x: 92, y: 175 }, props: [{ type: 'barbell', at: 'wrist' }],
    keyframes: REP({ trunk: 5, head: 0, uArm: 200, fArm: 345, ...LEGS }, { trunk: 40, head: 20, uArm: 240, fArm: 25, thigh: 97, shin: 205, foot: 95 }, [0.12, 0.5, 0.58]) },
  'goblet-squat': { duration: 3200, anchor: { joint: 'ankle', x: 92, y: 175 }, props: [{ type: 'dumbbell', at: 'wrist' }],
    keyframes: REP({ trunk: 3, head: 0, uArm: 165, fArm: 20, ...LEGS }, { trunk: 25, head: 15, uArm: 185, fArm: 45, thigh: 97, shin: 210, foot: 95 }) },
  'leg-press': { duration: 3200, anchor: { joint: 'hip', x: 70, y: 125 },
    props: [{ type: 'pad', from: [66, 136], to: [16, 107], w: 9 }, { type: 'pad', from: [60, 137], to: [90, 137], w: 9 }, { type: 'plate', at: 'toe', angle: 60 }],
    keyframes: REP({ trunk: 300, head: 330, uArm: 120, fArm: 100, thigh: 60, shin: 60, foot: 330 }, { trunk: 300, head: 330, uArm: 120, fArm: 100, thigh: 20, shin: 110, foot: 20 }) },
  'bench-press': { duration: 3000, anchor: { joint: 'hip', x: 125, y: 122 },
    props: [{ type: 'bench', x: 45, y: 133, w: 92 }, { type: 'barbell', at: 'wrist' }],
    keyframes: REP({ trunk: 270, head: 270, uArm: 5, fArm: 0, thigh: 110, shin: 180, foot: 90 }, { trunk: 270, head: 270, uArm: 150, fArm: 0, thigh: 110, shin: 180, foot: 90 }, [0.1, 0.5, 0.56]) },
  'db-bench-press': { duration: 3000, anchor: { joint: 'hip', x: 125, y: 122 },
    props: [{ type: 'bench', x: 45, y: 133, w: 92 }, { type: 'dumbbell', at: 'wrist' }],
    keyframes: REP({ trunk: 270, head: 270, uArm: 5, fArm: 0, thigh: 110, shin: 180, foot: 90 }, { trunk: 270, head: 270, uArm: 155, fArm: 355, thigh: 110, shin: 180, foot: 90 }, [0.1, 0.5, 0.56]) },
  'incline-db-press': { duration: 3000, anchor: { joint: 'hip', x: 120, y: 125 },
    props: [{ type: 'pad', from: [116, 136], to: [60, 104], w: 9 }, { type: 'pad', from: [110, 137], to: [138, 137], w: 9 }, { type: 'pad', from: [112, 140], to: [112, 180], w: 4 }, { type: 'dumbbell', at: 'wrist' }],
    keyframes: REP({ trunk: 300, head: 310, uArm: 355, fArm: 355, thigh: 100, shin: 180, foot: 90 }, { trunk: 300, head: 310, uArm: 175, fArm: 15, thigh: 100, shin: 180, foot: 90 }) },
  'push-up': { duration: 2800, anchor: { joint: 'toe', x: 30, y: 180 }, pins: [{ limb: 'arm', target: [148, 176], bend: 'back' }],
    keyframes: REP({ trunk: 71, head: 80, uArm: 188, fArm: 188, thigh: 251, shin: 251, foot: 180 }, { trunk: 84, head: 90, uArm: 255, fArm: 150, thigh: 264, shin: 264, foot: 180 }, [0.1, 0.5, 0.56]) },
  'plank': { duration: 4000, anchor: { joint: 'toe', x: 30, y: 180 },
    keyframes: KF([0, { trunk: 82, head: 88, uArm: 180, fArm: 90, thigh: 262, shin: 262, foot: 180 }], [0.5, { trunk: 81, head: 86, uArm: 180, fArm: 90, thigh: 261, shin: 261, foot: 180 }]) },
  'overhead-press': { duration: 3000, anchor: { joint: 'ankle', x: 100, y: 175 }, props: [{ type: 'barbell', at: 'wrist' }],
    keyframes: REP({ trunk: 0, head: 350, uArm: 150, fArm: 346, ...LEGS }, { trunk: 0, head: 5, uArm: 0, fArm: 0, ...LEGS }) },
  'db-shoulder-press': { duration: 3000, anchor: { joint: 'hip', x: 90, y: 128 },
    props: [{ type: 'pad', from: [72, 139], to: [110, 139], w: 9 }, { type: 'pad', from: [78, 139], to: [78, 72], w: 8 }, { type: 'pad', from: [92, 143], to: [92, 180], w: 4 }, { type: 'dumbbell', at: 'wrist' }],
    keyframes: REP({ trunk: 0, head: 0, uArm: 150, fArm: 0, thigh: 100, shin: 180, foot: 90 }, { trunk: 0, head: 0, uArm: 10, fArm: 0, thigh: 100, shin: 180, foot: 90 }) },
  'lateral-raise': { view: 'front', duration: 3000, anchor: { x: 100, y: 175 }, props: [{ type: 'dumbbell', at: 'wrist' }],
    keyframes: REP({ trunk: 0, head: 0, uArm: 172, fArm: 176, thigh: 178, shin: 180 }, { trunk: 0, head: 0, uArm: 92, fArm: 98, thigh: 178, shin: 180 }, [0.1, 0.45, 0.52]) },
  'face-pull': { duration: 3000, anchor: { joint: 'ankle', x: 85, y: 175 }, props: [{ type: 'cable', from: [188, 40] }, { type: 'bar', at: 'wrist' }],
    keyframes: KF(
      [0, { trunk: 355, head: 0, uArm: 85, fArm: 88, ...LEGS }], [0.1, { trunk: 355, head: 0, uArm: 85, fArm: 88, ...LEGS }],
      [0.3, { trunk: 355, head: 0, uArm: 40, fArm: 120, ...LEGS }],
      [0.5, { trunk: 355, head: 0, uArm: 280, fArm: 65, ...LEGS }], [0.58, { trunk: 355, head: 0, uArm: 280, fArm: 65, ...LEGS }],
      [0.8, { trunk: 355, head: 0, uArm: 40, fArm: 120, ...LEGS }]) },
  'deadlift': { duration: 3400, anchor: { joint: 'ankle', x: 85, y: 175 }, props: [{ type: 'barbell', at: 'wrist' }],
    keyframes: REP({ trunk: 75, head: 60, uArm: 190, fArm: 190, thigh: 125, shin: 195, foot: 100 }, { trunk: 0, head: 0, uArm: 180, fArm: 180, thigh: 180, shin: 180, foot: 100 }, [0.1, 0.5, 0.6]) },
  'romanian-deadlift': { duration: 3400, anchor: { joint: 'ankle', x: 85, y: 175 }, props: [{ type: 'barbell', at: 'wrist' }],
    keyframes: REP({ trunk: 0, head: 0, uArm: 182, fArm: 182, thigh: 180, shin: 180, foot: 100 }, { trunk: 80, head: 70, uArm: 200, fArm: 200, thigh: 145, shin: 185, foot: 100 }, [0.1, 0.55, 0.62]) },
  'db-rdl': { duration: 3400, anchor: { joint: 'ankle', x: 85, y: 175 }, props: [{ type: 'dumbbell', at: 'wrist' }],
    keyframes: REP({ trunk: 0, head: 0, uArm: 182, fArm: 182, thigh: 180, shin: 180, foot: 100 }, { trunk: 80, head: 70, uArm: 200, fArm: 200, thigh: 145, shin: 185, foot: 100 }, [0.1, 0.55, 0.62]) },
  'barbell-row': { duration: 2800, anchor: { joint: 'ankle', x: 85, y: 175 }, props: [{ type: 'barbell', at: 'wrist' }],
    keyframes: REP({ trunk: 50, head: 40, uArm: 195, fArm: 195, thigh: 145, shin: 190, foot: 100 }, { trunk: 50, head: 40, uArm: 290, fArm: 170, thigh: 145, shin: 190, foot: 100 }, [0.1, 0.45, 0.55]) },
  'db-row': { duration: 2800, oneArm: true, anchor: { joint: 'ankle', x: 80, y: 175 }, props: [{ type: 'dumbbell', at: 'wrist' }],
    keyframes: REP({ trunk: 75, head: 70, uArm: 180, fArm: 180, uArm2: 205, fArm2: 205, thigh: 150, shin: 190, foot: 100 }, { trunk: 75, head: 70, uArm: 275, fArm: 180, uArm2: 205, fArm2: 205, thigh: 150, shin: 190, foot: 100 }, [0.1, 0.45, 0.55]) },
  'lat-pulldown': { duration: 3000, anchor: { joint: 'hip', x: 100, y: 125 },
    props: [{ type: 'pad', from: [84, 136], to: [124, 136], w: 9 }, { type: 'pad', from: [104, 140], to: [104, 180], w: 4 }, { type: 'roller', at: 'knee', dy: -9 }, { type: 'cable', from: [101, 6] }, { type: 'bar', at: 'wrist' }],
    keyframes: REP({ trunk: 350, head: 355, uArm: 10, fArm: 10, thigh: 100, shin: 180, foot: 90 }, { trunk: 345, head: 0, uArm: 190, fArm: 25, thigh: 100, shin: 180, foot: 90 }) },
  'pull-up': { duration: 3000, noFloor: true, anchor: { joint: 'wrist', x: 100, y: 12 }, props: [{ type: 'pullupBar', x: 100, y: 12 }],
    keyframes: REP({ trunk: 0, head: 0, uArm: 0, fArm: 0, thigh: 172, shin: 212, foot: 125 }, { trunk: 350, head: 0, uArm: 200, fArm: 10, thigh: 162, shin: 205, foot: 125 }) },
  'seated-cable-row': { duration: 3000, anchor: { joint: 'hip', x: 70, y: 150 },
    props: [{ type: 'pad', from: [45, 161], to: [100, 161], w: 9 }, { type: 'pad', from: [72, 165], to: [72, 180], w: 4 }, { type: 'plate', at: 'toe', angle: 100 }, { type: 'cable', from: [192, 104] }, { type: 'bar', at: 'wrist' }],
    keyframes: REP({ trunk: 15, head: 20, uArm: 95, fArm: 95, thigh: 80, shin: 100, foot: 10 }, { trunk: 355, head: 0, uArm: 210, fArm: 90, thigh: 80, shin: 100, foot: 10 }) },
  'db-curl': { duration: 2600, anchor: { joint: 'ankle', x: 100, y: 175 }, props: [{ type: 'dumbbell', at: 'wrist' }],
    keyframes: REP(STAND, { ...STAND, uArm: 172, fArm: 15 }, [0.08, 0.45, 0.55]) },
  'hammer-curl': { duration: 2600, anchor: { joint: 'ankle', x: 100, y: 175 }, props: [{ type: 'dumbbell', at: 'wrist' }],
    keyframes: REP(STAND, { ...STAND, uArm: 172, fArm: 18 }, [0.08, 0.45, 0.55]) },
  'barbell-curl': { duration: 2600, anchor: { joint: 'ankle', x: 100, y: 175 }, props: [{ type: 'barbell', at: 'wrist', r: 12 }],
    keyframes: REP(STAND, { ...STAND, uArm: 172, fArm: 15 }, [0.08, 0.45, 0.55]) },
  'triceps-pushdown': { duration: 2600, anchor: { joint: 'ankle', x: 95, y: 175 }, props: [{ type: 'cable', from: [136, 2] }, { type: 'bar', at: 'wrist' }],
    keyframes: REP({ trunk: 8, head: 5, uArm: 188, fArm: 60, ...LEGS }, { trunk: 8, head: 5, uArm: 188, fArm: 180, ...LEGS }, [0.1, 0.45, 0.55]) },
  'overhead-triceps-ext': { duration: 2800, anchor: { joint: 'ankle', x: 100, y: 175 }, props: [{ type: 'dumbbell', at: 'wrist' }],
    keyframes: REP({ ...STAND, uArm: 8, fArm: 210 }, { ...STAND, uArm: 8, fArm: 5 }) },
  'lunge': { duration: 3000, anchor: { joint: 'ankle', x: 120, y: 175 }, props: [{ type: 'dumbbell', at: 'wrist' }],
    keyframes: REP({ trunk: 0, head: 0, uArm: 180, fArm: 180, thigh: 150, shin: 171, foot: 95, thigh2: 199, shin2: 223, foot2: 150 },
      { trunk: 0, head: 0, uArm: 180, fArm: 180, thigh: 97, shin: 197, foot: 95, thigh2: 178, shin2: 279, foot2: 150 }) },
  'bulgarian-split-squat': { duration: 3000, anchor: { joint: 'ankle', x: 125, y: 175 },
    props: [{ type: 'pad', from: [18, 145], to: [70, 145], w: 10 }, { type: 'pad', from: [40, 150], to: [40, 180], w: 4 }, { type: 'dumbbell', at: 'wrist' }],
    keyframes: REP({ trunk: 5, head: 0, uArm: 180, fArm: 180, thigh: 147, shin: 177, foot: 95, thigh2: 188, shin2: 281, foot2: 250 },
      { trunk: 12, head: 5, uArm: 180, fArm: 180, thigh: 102, shin: 196, foot: 95, thigh2: 203, shin2: 324, foot2: 250 }) },
  'hip-thrust': { duration: 3000, anchor: { joint: 'ankle', x: 130, y: 175 },
    props: [{ type: 'pad', from: [10, 143], to: [54, 143], w: 12 }, { type: 'pad', from: [30, 149], to: [30, 180], w: 4 }, { type: 'barbell', at: 'hip' }],
    keyframes: REP({ trunk: 300, head: 330, uArm: 110, fArm: 130, thigh: 64, shin: 187, foot: 95 }, { trunk: 270, head: 330, uArm: 80, fArm: 100, thigh: 104, shin: 202, foot: 95 }) },
  'leg-curl': { duration: 2800, anchor: { joint: 'hip', x: 85, y: 125 },
    props: [{ type: 'pad', from: [22, 136], to: [150, 136], w: 10 }, { type: 'pad', from: [60, 141], to: [60, 180], w: 4 }, { type: 'pad', from: [130, 141], to: [130, 180], w: 4 }, { type: 'roller', at: 'ankle' }],
    keyframes: REP({ trunk: 90, head: 95, uArm: 165, fArm: 190, thigh: 270, shin: 270, foot: 180 }, { trunk: 90, head: 95, uArm: 165, fArm: 190, thigh: 270, shin: 20, foot: 290 }, [0.1, 0.5, 0.56]) },
  'leg-extension': { duration: 2800, anchor: { joint: 'hip', x: 90, y: 125 },
    props: [{ type: 'pad', from: [74, 136], to: [128, 136], w: 9 }, { type: 'pad', from: [77, 136], to: [64, 84], w: 8 }, { type: 'pad', from: [92, 141], to: [92, 180], w: 4 }, { type: 'roller', at: 'ankle', dx: 4 }],
    keyframes: REP({ trunk: 345, head: 355, uArm: 190, fArm: 160, thigh: 90, shin: 180, foot: 90 }, { trunk: 345, head: 355, uArm: 190, fArm: 160, thigh: 90, shin: 88, foot: 358 }, [0.1, 0.45, 0.55]) },
  'calf-raise': { duration: 2400, anchor: { joint: 'toe', x: 112, y: 170 }, props: [{ type: 'pad', from: [40, 176], to: [114, 176], w: 12 }],
    keyframes: REP({ ...STAND, foot: 75 }, { ...STAND, foot: 125 }, [0.1, 0.45, 0.55]) },

  // ── Gym machines ──
  // Smith clips keep the bar on a vertical rail (the thin pad drawn behind the figure).
  'smith-squat': { duration: 3200, anchor: { joint: 'ankle', x: 80, y: 175 },
    props: [{ type: 'pad', from: [66, 14], to: [66, 180], w: 2 }, { type: 'barbell', at: 'wrist' }],
    keyframes: REP({ trunk: 3, head: 0, uArm: 200, fArm: 345, ...LEGS }, { trunk: 27, head: 10, uArm: 226, fArm: 22, thigh: 95, shin: 204, foot: 95 }, [0.12, 0.5, 0.58]) },
  'smith-bench-press': { duration: 3000, anchor: { joint: 'hip', x: 125, y: 122 },
    props: [{ type: 'pad', from: [88, 40], to: [88, 180], w: 2 }, { type: 'bench', x: 45, y: 133, w: 92 }, { type: 'barbell', at: 'wrist' }],
    keyframes: REP({ trunk: 270, head: 270, uArm: 15, fArm: 15, thigh: 110, shin: 180, foot: 90 }, { trunk: 270, head: 270, uArm: 150, fArm: 0, thigh: 110, shin: 180, foot: 90 }, [0.1, 0.5, 0.56]) },
  'chest-press-machine': { duration: 3000, anchor: { joint: 'hip', x: 90, y: 128 },
    props: [{ type: 'pad', from: [72, 139], to: [110, 139], w: 9 }, { type: 'pad', from: [76, 139], to: [76, 70], w: 8 }, { type: 'pad', from: [92, 143], to: [92, 180], w: 4 }, { type: 'bar', at: 'wrist' }],
    keyframes: REP({ trunk: 0, head: 0, uArm: 205, fArm: 75, thigh: 100, shin: 180, foot: 90 }, { trunk: 0, head: 0, uArm: 100, fArm: 92, thigh: 100, shin: 180, foot: 90 }) },
  'shoulder-press-machine': { duration: 3000, anchor: { joint: 'hip', x: 90, y: 128 },
    props: [{ type: 'pad', from: [72, 139], to: [110, 139], w: 9 }, { type: 'pad', from: [78, 139], to: [78, 66], w: 8 }, { type: 'pad', from: [92, 143], to: [92, 180], w: 4 }, { type: 'bar', at: 'wrist' }],
    keyframes: REP({ trunk: 0, head: 0, uArm: 150, fArm: 0, thigh: 100, shin: 180, foot: 90 }, { trunk: 0, head: 0, uArm: 10, fArm: 0, thigh: 100, shin: 180, foot: 90 }) },
  'machine-row': { duration: 3000, anchor: { joint: 'hip', x: 90, y: 128 },
    props: [{ type: 'pad', from: [72, 139], to: [110, 139], w: 9 }, { type: 'pad', from: [112, 82], to: [112, 120], w: 8 }, { type: 'pad', from: [92, 143], to: [92, 180], w: 4 }, { type: 'bar', at: 'wrist' }],
    keyframes: REP({ trunk: 10, head: 15, uArm: 90, fArm: 90, thigh: 100, shin: 180, foot: 90 }, { trunk: 5, head: 5, uArm: 225, fArm: 92, thigh: 100, shin: 180, foot: 90 }) },
  'assisted-pull-up': { duration: 3000, noFloor: true, anchor: { joint: 'wrist', x: 100, y: 12 },
    props: [{ type: 'pullupBar', x: 100, y: 12 }, { type: 'plate', at: 'knee', angle: 180, dx: -16 }],
    keyframes: REP({ trunk: 0, head: 0, uArm: 0, fArm: 0, thigh: 178, shin: 268, foot: 210 }, { trunk: 350, head: 0, uArm: 200, fArm: 10, thigh: 175, shin: 265, foot: 210 }) },
  'assisted-dip': { duration: 3000, noFloor: true, anchor: { joint: 'wrist', x: 110, y: 60 },
    props: [{ type: 'pad', from: [100, 63], to: [128, 63], w: 5 }, { type: 'plate', at: 'knee', angle: 180, dx: -16 }],
    keyframes: REP({ trunk: 0, head: 0, uArm: 180, fArm: 180, thigh: 182, shin: 268, foot: 210 }, { trunk: 15, head: 15, uArm: 226, fArm: 114, thigh: 190, shin: 270, foot: 210 }) },
  'seated-leg-curl': { duration: 2800, anchor: { joint: 'hip', x: 80, y: 125 },
    props: [{ type: 'pad', from: [64, 136], to: [118, 136], w: 9 }, { type: 'pad', from: [67, 136], to: [54, 84], w: 8 }, { type: 'pad', from: [82, 141], to: [82, 180], w: 4 }, { type: 'pad', from: [98, 114], to: [124, 114], w: 7 }, { type: 'roller', at: 'ankle', dy: 6 }],
    keyframes: REP({ trunk: 345, head: 355, uArm: 190, fArm: 160, thigh: 90, shin: 95, foot: 15 }, { trunk: 345, head: 355, uArm: 190, fArm: 160, thigh: 90, shin: 195, foot: 100 }, [0.1, 0.45, 0.55]) },
  // Front view: knees push apart (abductor) or squeeze together (adductor) while the feet stay close.
  'hip-abduction': { view: 'front', duration: 2800, anchor: { x: 100, y: 175 },
    keyframes: REP({ trunk: 0, head: 0, uArm: 172, fArm: 168, thigh: 177, shin: 183 }, { trunk: 0, head: 0, uArm: 172, fArm: 168, thigh: 157, shin: 203 }, [0.1, 0.45, 0.55]) },
  'hip-adduction': { view: 'front', duration: 2800, anchor: { x: 100, y: 175 },
    keyframes: REP({ trunk: 0, head: 0, uArm: 172, fArm: 168, thigh: 155, shin: 205 }, { trunk: 0, head: 0, uArm: 172, fArm: 168, thigh: 177, shin: 183 }, [0.1, 0.45, 0.55]) },
  'ab-crunch-machine': { duration: 2800, anchor: { joint: 'hip', x: 85, y: 128 },
    props: [{ type: 'pad', from: [67, 139], to: [105, 139], w: 9 }, { type: 'pad', from: [87, 143], to: [87, 180], w: 4 }, { type: 'roller', at: 'ankle', dx: 6, dy: -4 }, { type: 'bar', at: 'wrist' }],
    keyframes: REP({ trunk: 355, head: 0, uArm: 160, fArm: 15, thigh: 95, shin: 180, foot: 90 }, { trunk: 40, head: 60, uArm: 205, fArm: 60, thigh: 95, shin: 180, foot: 90 }, [0.1, 0.45, 0.55]) },
  'back-extension': { duration: 3200, anchor: { joint: 'ankle', x: 50, y: 165 },
    props: [{ type: 'pad', from: [114, 113], to: [96, 131], w: 10 }, { type: 'pad', from: [100, 136], to: [100, 180], w: 4 }, { type: 'roller', at: 'ankle', dx: -5, dy: -5 }, { type: 'plate', at: 'toe', angle: 135 }],
    keyframes: REP({ trunk: 45, head: 50, uArm: 195, fArm: 30, thigh: 225, shin: 225, foot: 135 }, { trunk: 140, head: 150, uArm: 290, fArm: 125, thigh: 225, shin: 225, foot: 135 }, [0.1, 0.5, 0.58]) },
  'machine-biceps-curl': { duration: 2600, anchor: { joint: 'hip', x: 80, y: 128 },
    props: [{ type: 'pad', from: [62, 139], to: [98, 139], w: 9 }, { type: 'pad', from: [80, 143], to: [80, 180], w: 4 }, { type: 'pad', from: [96, 88], to: [113, 106], w: 8 }, { type: 'pad', from: [108, 108], to: [108, 180], w: 4 }, { type: 'bar', at: 'wrist' }],
    keyframes: REP({ trunk: 15, head: 20, uArm: 135, fArm: 125, thigh: 95, shin: 180, foot: 90 }, { trunk: 15, head: 20, uArm: 135, fArm: 15, thigh: 95, shin: 180, foot: 90 }, [0.08, 0.45, 0.55]) },
};
for (const e of EXERCISES) e.anim = ANIMATIONS[e.id] || null;

const INDEX = new Map(EXERCISES.map(e => [e.id, e]));
export const byId = id => INDEX.get(id);
export const muscleLabel = m => MUSCLES[m] || m;
