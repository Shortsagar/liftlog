import { machineOps, machinePoints } from './machines.js';

// Figure rig math (pure, no DOM).
//
// A pose is a set of SEGMENT ANGLES in degrees, measured in screen space:
//   0 = pointing up, 90 = pointing forward (right, the way the figure faces), 180 = down, 270 = back.
// Keys: trunk (hip→shoulder), head (neck→head), uArm (shoulder→elbow), fArm (elbow→wrist),
//       thigh (hip→knee), shin (knee→ankle), foot (ankle→toe).
// Far-side limbs: uArm2 fArm2 thigh2 shin2 foot2 (default to the near-side value).
// An animation = { view:'side'|'front', duration, anchor:{joint,x,y}, props:[...], keyframes:[{t, pose}] }.
// The anchor joint stays fixed in the 200×200 viewBox (e.g. ankle for squats, hip for bench).

export const DIMS = { trunk: 52, neck: 15, headR: 10, uArm: 30, fArm: 28, thigh: 42, shin: 40, foot: 14 };
export const POSE_KEYS = ['trunk', 'curl', 'head', 'uArm', 'fArm', 'thigh', 'shin', 'foot', 'uArm2', 'fArm2', 'thigh2', 'shin2', 'foot2'];
const FAR = { uArm2: 'uArm', fArm2: 'fArm', thigh2: 'thigh', shin2: 'shin', foot2: 'foot' };

const rad = d => (d * Math.PI) / 180;
export const vec = (a, len) => ({ x: Math.sin(rad(a)) * len, y: -Math.cos(rad(a)) * len });
const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
export const angleOf = (from, to) => ((Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI + 360) % 360;

/** Interpolate angles along the shortest arc. */
export function lerpAngle(a, b, u) {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  return a + d * u;
}
const ease = u => (1 - Math.cos(Math.PI * u)) / 2;

export function normalizeKeyframes(kfs) {
  return [...kfs].sort((a, b) => a.t - b.t).map(k => {
    const pose = { ...k.pose };
    for (const [far, nearKey] of Object.entries(FAR)) if (pose[far] == null) pose[far] = pose[nearKey];
    if (pose.head == null) pose.head = pose.trunk;
    return { t: k.t, pose };
  });
}

/** Pose at loop position t ∈ [0,1). Keyframes must be normalized. Wraps last → first. */
export function samplePose(kfs, t) {
  if (kfs.length === 1) return { ...kfs[0].pose };
  t = ((t % 1) + 1) % 1;
  let i = kfs.length - 1;
  for (let k = 0; k < kfs.length; k++) if (kfs[k].t <= t) i = k;
  if (t < kfs[0].t) i = kfs.length - 1;
  const a = kfs[i], b = kfs[(i + 1) % kfs.length];
  let span = b.t - a.t, pos = t - a.t;
  if (span <= 0) { span += 1; if (pos < 0) pos += 1; }
  const u = span > 0 ? ease(Math.min(1, pos / span)) : 0;
  const out = {};
  for (const k of POSE_KEYS) if (a.pose[k] != null) out[k] = lerpAngle(a.pose[k], b.pose[k] ?? a.pose[k], u);
  return out;
}

/** Side-view joint positions. anchor = {joint, x, y}. */
export function forwardKinematics(pose, anchor = { joint: 'hip', x: 100, y: 100 }, dims = DIMS) {
  const hip = { x: 0, y: 0 };
  const spine = add(hip, vec(pose.trunk, dims.trunk / 2));
  const shoulder = add(spine, vec(pose.trunk + (pose.curl || 0), dims.trunk / 2));
  const head = add(shoulder, vec(pose.head ?? pose.trunk, dims.neck));
  const elbow = add(shoulder, vec(pose.uArm, dims.uArm));
  const wrist = add(elbow, vec(pose.fArm, dims.fArm));
  const knee = add(hip, vec(pose.thigh, dims.thigh));
  const ankle = add(knee, vec(pose.shin, dims.shin));
  const toe = add(ankle, vec(pose.foot ?? 90, dims.foot));
  const elbow2 = add(shoulder, vec(pose.uArm2 ?? pose.uArm, dims.uArm));
  const wrist2 = add(elbow2, vec(pose.fArm2 ?? pose.fArm, dims.fArm));
  const knee2 = add(hip, vec(pose.thigh2 ?? pose.thigh, dims.thigh));
  const ankle2 = add(knee2, vec(pose.shin2 ?? pose.shin, dims.shin));
  const toe2 = add(ankle2, vec(pose.foot2 ?? pose.foot ?? 90, dims.foot));
  const j = { hip, spine, shoulder, head, elbow, wrist, knee, ankle, toe, elbow2, wrist2, knee2, ankle2, toe2 };
  const ref = j[anchor.joint] || hip;
  const dx = anchor.x - ref.x, dy = anchor.y - ref.y;
  for (const k of Object.keys(j)) j[k] = { x: j[k].x + dx, y: j[k].y + dy };
  return j;
}

/** Front view: compute the right side, mirror for the left. Returns {right, left, neck, head, pelvis}. */
export function forwardKinematicsFront(pose, anchor = { x: 100, y: 178 }, dims = DIMS, seated = false) {
  const half = { shoulder: 15, hip: 8 };
  // build relative to pelvis centre (0,0)
  const hipR = { x: half.hip, y: 0 };
  const kneeR = seated
    ? {x: hipR.x + Math.sin(rad(pose.thigh)) * 29, y: 18}
    : add(hipR, vec(pose.thigh, dims.thigh));
  const ankleR = add(kneeR, vec(pose.shin, dims.shin));
  const neck = { x: 0, y: -dims.trunk };
  const shoulderR = { x: half.shoulder, y: -dims.trunk + 4 };
  const elbowR = add(shoulderR, vec(pose.uArm, dims.uArm));
  const wristR = add(elbowR, vec(pose.fArm, dims.fArm));
  const head = { x: 0, y: -dims.trunk - dims.neck };
  const dy = seated ? anchor.y : anchor.y - ankleR.y, cx = anchor.x;
  const T = p => ({ x: cx + p.x, y: p.y + dy });
  const M = p => ({ x: cx - p.x, y: p.y + dy });
  const r = { hip: hipR, knee: kneeR, ankle: ankleR, shoulder: shoulderR, elbow: elbowR, wrist: wristR };
  return {
    right: Object.fromEntries(Object.entries(r).map(([k, p]) => [k, T(p)])),
    left: Object.fromEntries(Object.entries(r).map(([k, p]) => [k, M(p)])),
    neck: T(neck), head: T(head), pelvis: T({ x: 0, y: 0 }),
  };
}

/** Generic two-bone IK: angles for (root→mid, mid→end) so `end` lands on target.
 *  bend: 'front' puts the middle joint toward +x, 'back' toward −x. */
export function twoBoneIK(root, target, L1, L2, bend = 'front') {
  const d = Math.min(Math.max(Math.hypot(target.x - root.x, target.y - root.y), Math.abs(L1 - L2) + 1e-6), L1 + L2 - 1e-6);
  const base = angleOf(root, target);
  const a = (Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)) * 180) / Math.PI;
  const options = [base - a, base + a].map(th => {
    const mid = add(root, vec(th, L1));
    return { a1: (th + 360) % 360, a2: angleOf(mid, target), mid };
  });
  options.sort((p, q) => (bend === 'front' ? q.mid.x - p.mid.x : p.mid.x - q.mid.x));
  return { a1: options[0].a1, a2: options[0].a2 };
}

/** Leg IK (authoring helper). */
export function legIK(hip, ankle, bend = 'front', dims = DIMS) {
  const r = twoBoneIK(hip, ankle, dims.thigh, dims.shin, bend);
  return { thigh: r.a1, shin: r.a2 };
}

/** Pose at t with pins applied. Pins accept a fixed target, a looping point track,
 * a relativeTo joint, and an optional near/far side. Null target axes stay free.
 * A pin keeps a hand (limb:'arm') or ankle (limb:'leg') fixed on a target point. */
export function solvePose(anim, kfs, t) {
  const pose = samplePose(kfs, t);
  if (anim.shoulderRail != null) {
    const j = forwardKinematics(pose, anim.anchor);
    pose.trunk = Math.asin(Math.max(-1, Math.min(1, (anim.shoulderRail - j.hip.x) / DIMS.trunk))) * 180 / Math.PI;
  }
  for (const pin of anim.pins || []) {
    const j = forwardKinematics(pose, anim.anchor);
    const track = pin.track;
    let point = pin.target;
    if (track) {
      const phase = ((t % 1) + 1) % 1;
      let i = track.length - 1;
      for (let k = 0; k < track.length; k++) if (track[k].t <= phase) i = k;
      const a = track[i], b = track[(i + 1) % track.length];
      const span = (b.t - a.t + 1) % 1 || 1;
      const u = ease(((phase - a.t + 1) % 1) / span);
      point = a.point.map((v, axis) => v + (b.point[axis] - v) * u);
    }
    const end = j[pin.limb === 'arm' ? 'wrist' : 'ankle'];
    const relative = pin.relativeTo ? j[pin.relativeTo] : {x:0,y:0};
    const target = { x: point[0] == null ? end.x : point[0] + relative.x, y: point[1] == null ? end.y : point[1] + relative.y };
    const suffixes = pin.side === 'far' ? ['2'] : pin.side === 'near' ? [''] : ['', '2'];
    if (pin.limb === 'arm') {
      const r = twoBoneIK(j.shoulder, target, DIMS.uArm, DIMS.fArm, pin.bend);
      for (const suffix of suffixes) { pose['uArm' + suffix] = r.a1; pose['fArm' + suffix] = r.a2; }
    } else if (pin.limb === 'leg') {
      const r = twoBoneIK(j.hip, target, DIMS.thigh, DIMS.shin, pin.bend);
      for (const suffix of suffixes) { pose['thigh' + suffix] = r.a1; pose['shin' + suffix] = r.a2; }
    }
  }
  return pose;
}

export const posedJoints = (anim, kfs, t) => forwardKinematics(solvePose(anim, kfs, t), anim.anchor);

/** Tight square viewBox around every frame of the clip, its static props and the floor. */
export function fitBox(anim, samples = 40) {
  const pts = [];
  const kfs = normalizeKeyframes(anim.keyframes);
  for (let i = 0; i < samples; i++) {
    const pose = solvePose(anim, kfs, i / samples);
    if (anim.view === 'front') {
      const f = forwardKinematicsFront(pose, anim.anchor, DIMS, anim.seated);
      pts.push(f.head, ...Object.values(f.right), ...Object.values(f.left));
      pts.push(...machinePoints([...machineOps(anim, f), ...machineOps(anim, f, 'front')]));
    } else {
      const j = forwardKinematics(pose, anim.anchor);
      pts.push(...Object.values(j), ...machinePoints([...machineOps(anim, j), ...machineOps(anim, j, 'front')]));
    }
  }
  for (const p of anim.props || []) {
    if (p.from) pts.push({ x: p.from[0], y: p.from[1] });
    if (p.to) pts.push({ x: p.to[0], y: p.to[1] });
    if (p.type === 'bench') pts.push({ x: p.x, y: p.y }, { x: p.x + p.w, y: p.y });
    if (p.type === 'pullupBar') pts.push({ x: p.x - 60, y: p.y - 6 }, { x: p.x + 60, y: p.y - 6 });
  }
  const pad = 28; // head radius + plates
  const x0 = Math.min(...pts.map(p => p.x)) - pad, x1 = Math.max(...pts.map(p => p.x)) + pad;
  const y0 = Math.min(...pts.map(p => p.y)) - pad;
  const y1 = anim.noFloor ? Math.max(...pts.map(p => p.y)) + pad : Math.max(186, ...pts.map(p => p.y + 10)); // floor (y=180) sits near the bottom
  const size = Math.ceil(Math.max(x1 - x0, y1 - y0));
  const cx = (x0 + x1) / 2;
  const top = anim.machine ? (y0 + y1 - size) / 2 : y1 - size;
  return { x: Math.round(cx - size / 2), y: Math.round(top), w: size, h: size };
}
