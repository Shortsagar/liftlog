# Workout animation review — 2026-11-17

Reviewed all 44 library clips at phases 0, .25, .5 and .75 in Chromium. Automated checks sample 120 rendered poses and 240 adjacent joint positions per loop. These are schematic two-dimensional illustrations: side views do not fully communicate grip rotation or out-of-plane elbow position.

Every figure now includes neutral muscle contours alongside the primary/secondary highlights, joint landmarks and hands. Front views also have feet and segmented abdominal detail. The first playback frame matches the displayed starting pose; pausing, resuming, offscreen lifecycle and reduced-motion defaults retain the existing controller behavior.

| Exercise(s) | Review / resulting adjustment |
| --- | --- |
| Barbell Bench Press; Dumbbell Bench Press | Controlled hand paths from chest to overhead; planted feet. |
| Incline Dumbbell Press | Corrected press route and avoided the ambiguous 180° arm interpolation. |
| Push-up | Verified fixed hands/toes and aligned trunk/legs. |
| Overhead Press | Hand path clears the face and finishes overhead. |
| Dumbbell Shoulder Press; Shoulder Press Machine | Start at ear height; controlled overhead extension. |
| Lateral Raise | Verified symmetric shoulder-height raise and soft elbows. |
| Face Pull | Removed the original arm-angle windmill; constrained hand path to forehead height. |
| Deadlift | Reviewed floor start, straight arms, hip/knee extension and upright finish. |
| Barbell Row | Reviewed stable hinge and elbow-driven pull toward ribs. |
| One-Arm Dumbbell Row | Added bench, supported far hand/knee and planted near foot. |
| Lat Pulldown | Guided hands to upper chest; corrected elbow bend direction. |
| Pull-up; Assisted Pull-up | Verified fixed grip and body rise; full overhead bar fits the frame. Assisted version keeps its moving knee platform. |
| Seated Cable Row | Reviewed fixed seat/feet, cable attachment and abdominal pull endpoint. |
| Dumbbell Curl; Barbell Curl | Fixed upper arms while forearms curl. |
| Hammer Curl | Fixed upper arms and distinct neutral-grip dumbbell silhouette. |
| Triceps Pushdown | Full extension now aligns with the stationary upper arm. |
| Overhead Triceps Extension | Forearm passes behind the head rather than through the front. |
| Back Squat | Bar attached to upper back; hands remain next to the bar throughout the rep. |
| Goblet Squat | Dumbbell stays by upper chest with elbows below the hands. |
| Leg Press | Constant foot orientation against the plate and softly bent extension endpoint. |
| Romanian Deadlift; Dumbbell Romanian Deadlift | Revised hip/knee geometry and hanging arms to keep load closer to legs. |
| Dumbbell Lunge | Rear support pinned; cue explicitly describes the stationary split-stance variation shown. |
| Bulgarian Split Squat | Rear ankle remains on its bench throughout the repetition. |
| Hip Thrust | Upper back stays on bench and feet remain planted; horizontal torso and vertical shins at lockout. |
| Lying Leg Curl | Reduced over-flexed finish; hips remain on pad. |
| Leg Extension; Seated Leg Curl | Reviewed fixed thighs, knee-led rotation and ankle rollers. |
| Standing Calf Raise | Forefoot on platform edge with heel free to lower and rise. |
| Plank | True static hold with forearms on floor and aligned body. |
| Smith Machine Squat | Shoulder/bar fixed to vertical rail with attached grip. |
| Smith Machine Bench Press | Hand/bar path stays on vertical rail. |
| Chest Press Machine | Reviewed seated support and forward pressing motion. |
| Seated Machine Row | Reviewed chest support, stable legs and backward elbow motion. |
| Assisted Dip | Reviewed fixed hands and body lowering with knee platform. |
| Hip Abductor Machine; Hip Adductor Machine | Fixed seated pelvis, foreshortened thighs, seat and knee pads; knees open/close without lifting body. |
| Ab Crunch Machine | Added spinal flexion so the torso curls rather than only hinging. |
| 45° Back Extension | Reviewed stable lower body, hip hinge and straight-line finish. |
| Machine Biceps Curl | Reviewed upper-arm support and isolated forearm rotation. |

## Repeatable checks

- `npm test`: includes per-exercise render, contact, loop, frame, rail and posture regressions.
- `npm run test:browser`: app integration and offline behavior.
- `node tools/animation-review.mjs`: Chromium contact sheets in the system temporary directory and playback checks for every clip. Uses `CHROME_PATH` if supplied.
- `tools/anim-preview.html?ex=exercise-id`: existing four-phase visual inspection page.

The service-worker version was rebuilt so installed clients can receive the updated assets. No deployment was performed.


## Machine recognition pass

All 21 machine/cable exercises now include an original equipment silhouette, with frames, stacks, rail carriages, levers and contact pads where applicable. Machine shapes are drawn locally with SVG primitives and included in offline assets; no manufacturer images are shipped. Camera bounds include the equipment at every sampled pose. Enlarged demos add identifying features and explain that actual designs vary by gym.

Reference catalog: [Life Fitness Insignia Series](https://www.lifefitness.com/en-us/catalog/strength-training/selectorized/insignia-series), with equipment examples for the [seated leg curl](https://www.lifefitness.com/en-us/catalog/strength-training/selectorized/insignia-series-seated-leg-curl) and [assisted dip/chin station](https://www.lifefitness.com/en-us/catalog/strength-training/selectorized/insignia-series-assist-dip-chin). These are generic identification schematics, not exact replicas of a particular brand or facility's equipment.

`node tools/animation-review.mjs --machines` captures all machine clips in both themes and a 390px phone demo, and checks playback. `tests/machines.test.js` checks complete equipment coverage, camera containment, ankle-roller attachment and inner/outer knee-pad placement.
