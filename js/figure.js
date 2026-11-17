// Renders a rig animation as inline SVG. One shared requestAnimationFrame loop drives every
// visible figure; off-screen figures pause automatically. Elements are created once and only
// their attributes change per frame.
import { normalizeKeyframes, solvePose, forwardKinematics, forwardKinematicsFront, fitBox, vec, DIMS } from './rig.js';

const NS = 'http://www.w3.org/2000/svg';
const W = { trunk: 20, neck: 7, uArm: 10, fArm: 8, thigh: 15, shin: 11, foot: 6 };
const HALF = Object.fromEntries(Object.entries(W).map(([k, v]) => [k, v / 2]));

// Side view muscle placement: segment, span along it (0 = start joint), side (+1 front, -1 back, 0 centre), half-width.
const SIDE = {
  chest: [['trunk', 0.62, 0.92, 1, 4.5]],
  abs: [['trunk', 0.1, 0.56, 1, 4]],
  obliques: [['trunk', 0.12, 0.5, 0, 3.5]],
  lats: [['trunk', 0.45, 0.85, -1, 4.5]],
  upperBack: [['trunk', 0.7, 0.98, -1, 4.5]],
  lowerBack: [['trunk', 0.04, 0.4, -1, 4]],
  traps: [['neck', -0.2, 0.7, -1, 3.5]],
  frontDelts: [['uArm', -0.05, 0.32, 1, 4]],
  sideDelts: [['uArm', -0.12, 0.28, 0, 5.5]],
  rearDelts: [['uArm', -0.05, 0.32, -1, 4]],
  biceps: [['uArm', 0.3, 0.9, 1, 3.5]],
  triceps: [['uArm', 0.3, 0.9, -1, 3.5]],
  forearms: [['fArm', 0.08, 0.65, 0, 3.4]],
  glutes: [['thigh', -0.16, 0.26, -1, 6]],
  quads: [['thigh', 0.14, 0.9, 1, 4.5]],
  hamstrings: [['thigh', 0.25, 0.9, -1, 4]],
  calves: [['shin', 0.08, 0.55, -1, 4]],
};
const LIMB_SEGS = new Set(['uArm', 'fArm', 'thigh']); // front = angle − 90; trunk/neck/shin-calves handled by sign

const cache = new Map(); // exId → {kfs, box}
function prep(ex) {
  if (!cache.has(ex.id)) cache.set(ex.id, { kfs: normalizeKeyframes(ex.anim.keyframes), box: fitBox(ex.anim) });
  return cache.get(ex.id);
}

/** Build the list of drawing ops for a pose. Order and count depend only on the clip, never the pose. */
export function opsFor(ex, pose) {
  const anim = ex.anim;
  const roles = new Map(Object.keys(SIDE).map(m => [m, 'neutral']));
  for (const m of ex.primary) roles.set(m, 'p');
  for (const m of ex.secondary) if (roles.get(m) !== 'p') roles.set(m, 's');
  return anim.view === 'front' ? frontOps(anim, pose, roles) : sideOps(anim, pose, roles);
}

const line = (a, b, w, cls) => ({ tag: 'line', cls, a: { x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'stroke-width': w } });
const circle = (c, r, cls) => ({ tag: 'circle', cls, a: { cx: c.x, cy: c.y, r } });
function ellipse(c, rx, ry, rot, cls) {
  return { tag: 'ellipse', cls, a: { cx: c.x, cy: c.y, rx: Math.max(0.1, rx), ry, transform: `rotate(${rot} ${c.x} ${c.y})` } };
}
const lerp = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });

function muscleOnSeg(P, Q, angle, seg, t0, t1, side, w, cls) {
  const len = Math.hypot(Q.x - P.x, Q.y - P.y);
  const front = LIMB_SEGS.has(seg) ? angle - 90 : seg === 'shin' ? angle - 90 : angle + 90;
  const off = side * Math.max(0, HALF[seg] - w * 0.6);
  const n = vec(front, off);
  const c = lerp(P, Q, (t0 + t1) / 2);
  return ellipse({ x: c.x + n.x, y: c.y + n.y }, (len * (t1 - t0)) / 2, w, angle - 90, cls);
}

function segInfo(j, pose, far) {
  const s = far ? '2' : '';
  return {
    trunk: [j.hip, j.shoulder, pose.trunk],
    neck: [j.shoulder, j.head, pose.head],
    uArm: [j.shoulder, j['elbow' + s], pose['uArm' + s]],
    fArm: [j['elbow' + s], j['wrist' + s], pose['fArm' + s]],
    thigh: [j.hip, j['knee' + s], pose['thigh' + s]],
    shin: [j['knee' + s], j['ankle' + s], pose['shin' + s]],
  };
}

function muscleOps(segs, roles, onlySegs, extraCls = '') {
  const ops = [];
  for (const [m, role] of roles) {
    for (const [seg, t0, t1, side, w] of SIDE[m] || []) {
      if (!onlySegs.includes(seg)) continue;
      const [P, Q, ang] = segs[seg];
      ops.push(muscleOnSeg(P, Q, ang, seg, t0, t1, side, w, `m-${role}${extraCls}`));
    }
  }
  return ops;
}

function propOps(anim, joints, layer) {
  const ops = [];
  for (const p of anim.props || []) {
    const at = p.at ? joints[p.at] : null;
    const pos = at ? { x: at.x + (p.dx || 0), y: at.y + (p.dy || 0) } : null;
    if (layer === 'back') {
      if (p.type === 'pad') ops.push(line({ x: p.from[0], y: p.from[1] }, { x: p.to[0], y: p.to[1] }, p.w || 8, 'prop-pad'));
      if (p.type === 'bench') {
        ops.push(line({ x: p.x, y: p.y }, { x: p.x + p.w, y: p.y }, 8, 'prop-pad'));
        ops.push(line({ x: p.x + 12, y: p.y + 4 }, { x: p.x + 12, y: 180 }, 4, 'prop-pad'));
        ops.push(line({ x: p.x + p.w - 12, y: p.y + 4 }, { x: p.x + p.w - 12, y: 180 }, 4, 'prop-pad'));
      }
      if (p.type === 'pullupBar') {
        ops.push(line({ x: p.x - 60, y: p.y - 6 }, { x: p.x + 60, y: p.y - 6 }, 2, 'prop'));
        ops.push(circle({ x: p.x, y: p.y }, 3.5, 'prop-solid'));
      }
      if (p.type === 'cable') {
        const hand = joints.wrist;
        ops.push(line({ x: p.from[0], y: p.from[1] }, hand, 1.5, 'prop-cable'));
        ops.push(circle({ x: p.from[0], y: p.from[1] }, 4, 'prop'));
      }
    } else {
      if (p.type === 'barbell') { ops.push(circle(pos, p.r || 16, 'prop-plate')); ops.push(circle(pos, 2.5, 'prop-solid')); }
      if (p.type === 'dumbbell') {
        if (p.grip === 'neutral') {
          const v = vec(anim.gripAngle ?? 0, 8);
          ops.push(line({x:pos.x-v.x,y:pos.y-v.y},{x:pos.x+v.x,y:pos.y+v.y},3,'prop'));
          for (const sign of [-1,1]) ops.push(line({x:pos.x+sign*v.x-5,y:pos.y+sign*v.y},{x:pos.x+sign*v.x+5,y:pos.y+sign*v.y},4,'prop'));
        } else { ops.push(circle(pos, 6.5, 'prop-plate')); ops.push(circle(pos, 2, 'prop-solid')); }
      }
      if (p.type === 'bar') ops.push(circle(pos, 3, 'prop-solid'));
      if (p.type === 'roller') ops.push(circle(pos, 6, 'prop-plate'));
      if (p.type === 'plate') {
        const half = vec(p.angle - 90, 22), beyond = vec(p.angle, 4);
        const c = { x: pos.x + beyond.x, y: pos.y + beyond.y };
        ops.push(line({ x: c.x - half.x, y: c.y - half.y }, { x: c.x + half.x, y: c.y + half.y }, 5, 'prop-pad'));
      }
    }
  }
  return ops;
}

function sideOps(anim, pose, roles) {
  const j = forwardKinematics(pose, anim.anchor);
  const ops = [];
  if (!anim.noFloor) ops.push(line({ x: -400, y: 180 }, { x: 600, y: 180 }, 1.5, 'floor'));
  ops.push(...propOps(anim, j, 'back'));
  // far limbs (behind the body)
  const far = segInfo(j, pose, true);
  ops.push(line(j.knee2, j.ankle2, W.shin, 'fig-far'), line(j.ankle2, j.toe2, W.foot, 'fig-far'), line(j.hip, j.knee2, W.thigh, 'fig-far'));
  ops.push(line(j.shoulder, j.elbow2, W.uArm, 'fig-far'), line(j.elbow2, j.wrist2, W.fArm, 'fig-far'));
  ops.push(...muscleOps(far, roles, ['uArm', 'fArm', 'thigh', 'shin'], ' m-far'));
  ops.push(...(anim.props || []).filter(p => p.at === 'wrist' && p.type === 'dumbbell' && p.grip !== 'neutral' && !anim.oneArm).flatMap(p => [circle(j.wrist2, 6.5, 'prop-plate prop-far')]));
  // body
  const near = segInfo(j, pose, false);
  const neckEnd = lerp(j.shoulder, j.head, 0.45);
  ops.push(line(j.hip, j.spine, W.trunk, 'fig'), line(j.spine, j.shoulder, W.trunk, 'fig'), line(j.shoulder, neckEnd, W.neck, 'fig'), circle(j.head, 10, 'fig-head'));
  ops.push(...muscleOps(near, roles, ['trunk', 'neck']));
  ops.push(line(j.hip, j.knee, W.thigh, 'fig'), line(j.knee, j.ankle, W.shin, 'fig'), line(j.ankle, j.toe, W.foot, 'fig'));
  ops.push(...muscleOps(near, roles, ['thigh', 'shin']));
  ops.push(line(j.shoulder, j.elbow, W.uArm, 'fig'), line(j.elbow, j.wrist, W.fArm, 'fig'));
  ops.push(...muscleOps(near, roles, ['uArm', 'fArm']));
  for (const point of [j.elbow, j.knee]) ops.push(circle(point, 2.3, 'fig-joint'));
  ops.push(circle(j.wrist, 3.2, 'fig-head'));
  const face = vec((pose.head ?? pose.trunk) + 90, 8);
  ops.push(circle({x: j.head.x + face.x, y: j.head.y + face.y}, 1.3, 'fig-feature'));
  ops.push(...propOps(anim, j, 'front'));
  return ops;
}

function frontOps(anim, pose, roles) {
  const f = forwardKinematicsFront(pose, anim.anchor, DIMS, anim.seated);
  const ops = [line({ x: -400, y: 180 }, { x: 600, y: 180 }, 1.5, 'floor')];
  if (anim.seated) {
    ops.push(line({x: f.pelvis.x - 24, y: f.neck.y + 5}, {x: f.pelvis.x - 24, y: f.pelvis.y + 9}, 7, 'prop-pad'));
    ops.push(line({x: f.pelvis.x - 29, y: f.pelvis.y + 9}, {x: f.pelvis.x + 29, y: f.pelvis.y + 9}, 8, 'prop-pad'));
  }
  for (const s of [f.left, f.right]) ops.push(line(s.hip, s.knee, W.thigh, 'fig'), line(s.knee, s.ankle, W.shin, 'fig'));
  ops.push({ tag: 'polygon', cls: 'fig-torso', a: { points: [f.left.shoulder, f.right.shoulder, f.right.hip, f.left.hip].map(p => `${p.x},${p.y}`).join(' ') } });
  ops.push(line(f.neck, lerp(f.neck, f.head, 0.5), W.neck, 'fig'), circle(f.head, 10, 'fig-head'));
  for (const s of [f.left, f.right]) ops.push(line(s.shoulder, s.elbow, W.uArm, 'fig'), line(s.elbow, s.wrist, W.fArm, 'fig'));
  const has = m => roles.get(m);
  for (const [i, s] of [f.left, f.right].entries()) {
    const out = i === 0 ? -1 : 1;
    const segA = (P, Q, t0, t1, w, cls) => {
      const ang = Math.atan2(Q.x - P.x, -(Q.y - P.y)) * 180 / Math.PI;
      return ellipse(lerp(P, Q, (t0 + t1) / 2), Math.hypot(Q.x - P.x, Q.y - P.y) * (t1 - t0) / 2, w, ang - 90, cls);
    };
    if (has('chest')) ops.push(ellipse({ x: (s.shoulder.x + f.neck.x) / 2, y: s.shoulder.y + 9 }, 6.5, 4.5, 0, `m-${has('chest')}`));
    if (has('lats')) ops.push(ellipse({ x: s.shoulder.x - out * 3, y: s.shoulder.y + 19 }, 3, 9, 0, `m-${has('lats')}`));
    if (has('obliques')) ops.push(ellipse({ x: f.pelvis.x + out * 8, y: f.pelvis.y - 15 }, 2.5, 8, 0, `m-${has('obliques')}`));
    if (has('traps')) ops.push(segA({ x: f.neck.x + out * 3, y: f.neck.y - 4 }, s.shoulder, 0.1, 0.9, 2.6, `m-${has('traps')}`));
    if (has('frontDelts')) ops.push(circle({ x: s.shoulder.x - out * 1.5, y: s.shoulder.y + 1 }, 4.2, `m-${has('frontDelts')}`));
    if (has('sideDelts')) ops.push(circle({ x: s.shoulder.x + out * 2, y: s.shoulder.y }, 5.5, `m-${has('sideDelts')}`));
    if (has('biceps') || has('triceps')) ops.push(segA(s.shoulder, s.elbow, 0.3, 0.9, 3.4, `m-${has('biceps') || has('triceps')}`));
    if (has('forearms')) ops.push(segA(s.elbow, s.wrist, 0.1, 0.65, 3, `m-${has('forearms')}`));
    if (has('quads')) ops.push(segA(s.hip, s.knee, 0.15, 0.9, 4.5, `m-${has('quads')}`));
    if (has('glutes')) ops.push(ellipse({ x: s.hip.x + out * 5, y: s.hip.y - 2 }, 3, 6, 0, `m-${has('glutes')}`));
    if (has('adductors')) { const a = lerp(s.hip, s.knee, 0.35); ops.push(ellipse({ x: a.x - out * 4, y: a.y }, 2.5, 9, 0, `m-${has('adductors')}`)); }
    if (has('calves')) ops.push(segA(s.knee, s.ankle, 0.1, 0.55, 3.5, `m-${has('calves')}`));
  }
  for (const y of [12, 20, 28]) for (const x of [-3, 3]) ops.push(ellipse({x: f.pelvis.x + x, y: f.pelvis.y - y}, 2.4, 3.3, 0, `m-${has('abs')}`));
  for (const s of [f.left, f.right]) {
    ops.push(circle(s.elbow, 2.3, 'fig-joint'), circle(s.knee, 2.3, 'fig-joint'), circle(s.wrist, 3.2, 'fig-head'));
    ops.push(line(s.ankle, {x: s.ankle.x + (s === f.left ? -8 : 8), y: s.ankle.y + 2}, 6, 'fig'));
    if (anim.seated) ops.push(line({x:s.knee.x + (s === f.left ? -7 : 7), y:s.knee.y - 6}, {x:s.knee.x + (s === f.left ? -7 : 7), y:s.knee.y + 6}, 5, 'prop-pad'));
  }
  for (const p of anim.props || []) if (p.type === 'dumbbell') for (const s of [f.left, f.right]) ops.push(circle(s.wrist, 6, 'prop-plate'), circle(s.wrist, 2, 'prop-solid'));
  return ops;
}

// ── Controller ──
const running = new Set();
let raf = 0;
function loop(ts) {
  for (const fig of running) fig.frame(ts);
  raf = running.size ? requestAnimationFrame(loop) : 0;
}
const kick = () => { if (!raf && running.size) raf = requestAnimationFrame(loop); };

const io = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver(entries => {
    for (const e of entries) { const fig = e.target.__fig; if (fig) fig.setVisible(e.isIntersecting); }
  }, { rootMargin: '80px' })
  : null;

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Create an animated figure SVG for `ex`. Returns a controller. */
export function createFigure(ex, { autoplay = !reducedMotion(), className = '', phase: startPhase } = {}) {
  if (!ex.anim) return null;
  const { kfs, box } = prep(ex);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
  svg.setAttribute('class', `figure ${className}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${ex.name} form demonstration`);
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('stroke-linecap', 'round');
  svg.append(g);
  let els = [];
  let playing = autoplay, visible = false, phase = startPhase ?? (autoplay ? 0 : 0.5), last = null;

  const draw = t => {
    const ops = opsFor(ex, solvePose(ex.anim, kfs, t));
    if (els.length !== ops.length) {
      g.replaceChildren();
      els = ops.map(op => { const el = document.createElementNS(NS, op.tag); g.append(el); return el; });
    }
    ops.forEach((op, i) => {
      const el = els[i];
      if (el.__cls !== op.cls) { el.setAttribute('class', op.cls); el.__cls = op.cls; }
      for (const [k, v] of Object.entries(op.a)) el.setAttribute(k, typeof v === 'number' ? v.toFixed(2) : v);
    });
  };

  const fig = {
    el: svg,
    frame(ts) {
      if (!svg.isConnected) { fig.destroy(); return; }
      if (last != null) phase = (phase + (ts - last) / ex.anim.duration) % 1;
      last = ts;
      draw(phase);
    },
    setVisible(v) { visible = v; sync(); },
    play() { playing = true; sync(); onChange(); },
    pause() { playing = false; sync(); onChange(); },
    toggle() { playing ? fig.pause() : fig.play(); },
    get playing() { return playing; },
    destroy() { running.delete(fig); io?.unobserve(svg); },
    onchange: null,
  };
  const onChange = () => fig.onchange && fig.onchange(playing);
  function sync() {
    if (playing && visible) { last = null; running.add(fig); kick(); } else running.delete(fig);
  }
  svg.__fig = fig;
  draw(phase); // paused figures show the hardest point of the rep
  if (io) io.observe(svg); else fig.setVisible(true);
  return fig;
}
