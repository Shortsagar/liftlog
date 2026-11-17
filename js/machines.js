// Original schematic equipment silhouettes. Coordinates share the figure's world
// space; moving contact parts follow the rig joints. No remote image dependencies.
// Frame/pad colors stay quieter than the muscle highlights in either theme.
export const MACHINES = {
  'face-pull': { name: 'Adjustable cable station', hint: 'Tall weight-stack tower, adjustable pulley and rope attachment.' },
  'triceps-pushdown': { name: 'High cable station', hint: 'Weight-stack tower with a high pulley and short pushdown bar.' },
  'lat-pulldown': { name: 'Lat pulldown station', hint: 'Overhead cable and wide bar above a seat with thigh pads.' },
  'seated-cable-row': { name: 'Seated cable row', hint: 'Low bench facing a cable tower, with footplates in front.' },
  'leg-press': { name: 'Inclined leg press', hint: 'Reclined seat facing a large footplate on angled sled rails.' },
  'leg-curl': { name: 'Lying leg curl', hint: 'Long face-down bench with a pivoting ankle roller.' },
  'leg-extension': { name: 'Leg extension machine', hint: 'Upright seat with a roller across the front of the lower legs.' },
  'seated-leg-curl': { name: 'Seated leg curl', hint: 'Back-supported seat, thigh restraint and roller behind the ankles.' },
  'calf-raise': { name: 'Standing calf machine', hint: 'Raised foot block below shoulder pads on a vertical carriage.' },
  'smith-squat': { name: 'Smith machine', hint: 'A bar attached to two tall guide rails, with rack hooks and safety stops.' },
  'smith-bench-press': { name: 'Smith machine with bench', hint: 'A flat bench beneath a bar attached to two guide rails.' },
  'chest-press-machine': { name: 'Seated chest press', hint: 'Back-supported seat with press arms and handles at chest height.' },
  'shoulder-press-machine': { name: 'Seated shoulder press', hint: 'Back-supported seat with lever arms that press overhead.' },
  'machine-row': { name: 'Chest-supported row', hint: 'Seat facing a chest pad, with pulling handles in front.' },
  'assisted-pull-up': { name: 'Assisted pull-up / dip station', hint: 'Tall tower with overhead grips, dip handles, steps and a moving knee pad.' },
  'assisted-dip': { name: 'Assisted pull-up / dip station', hint: 'Tall tower with dip handles, steps and a counterweighted knee pad.' },
  'hip-abduction': { name: 'Hip abductor machine', hint: 'Seated machine with pads outside the knees; push the pads apart.' },
  'hip-adduction': { name: 'Hip adductor machine', hint: 'Seated machine with pads inside the knees; squeeze the pads together.' },
  'ab-crunch-machine': { name: 'Seated abdominal crunch', hint: 'Seat with ankle restraints and a pivoting upper-body pad and handles.' },
  'back-extension': { name: '45° back-extension bench', hint: 'Angled frame with split hip pads, a footplate and heel restraints.' },
  'machine-biceps-curl': { name: 'Preacher curl machine', hint: 'Seat behind a sloping upper-arm pad, with pivoting curl handles.' },
};
export const machineInfo = anim => MACHINES[anim?.machine] || null;

const point = (x, y) => ({ x, y });
const line = (a, b, cls = 'machine-frame', w = 4, part = 'frame') => ({ tag: 'line', cls,
  a: { x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'stroke-width': w, 'data-part': part } });
const rect = (x, y, width, height, cls = 'machine-panel', part = 'housing') => ({ tag: 'rect', cls,
  a: { x, y, width, height, rx: 3, 'data-part': part } });
const circle = (p, r = 4, cls = 'machine-pivot', part = 'pivot') => ({ tag: 'circle', cls,
  a: { cx: p.x, cy: p.y, r, 'data-part': part } });
const L = (x1, y1, x2, y2, cls, w, part) => line(point(x1, y1), point(x2, y2), cls, w, part);
const pad = (a, b, w = 9, part = 'pad') => line(a, b, 'machine-pad', w, part);
const grip = p => L(p.x, p.y - 5, p.x, p.y + 5, 'machine-grip', 4, 'handle');

function base(x1, x2, y = 180) {
  return [L(x1, y - 3, x2, y - 3, 'machine-frame', 5),
    rect(x1 - 5, y - 3, 13, 4, 'machine-foot', 'foot'), rect(x2 - 8, y - 3, 13, 4, 'machine-foot', 'foot')];
}
function stack(x, top = 36, bottom = 174) {
  const ops = [rect(x - 14, top, 28, bottom - top),
    L(x - 8, top + 7, x - 8, bottom - 5, 'machine-rail', 1.5),
    L(x + 8, top + 7, x + 8, bottom - 5, 'machine-rail', 1.5)];
  for (let i = 0; i < 8; i++) ops.push(rect(x - 10, bottom - 9 - i * 5, 20, 4, 'machine-weight', 'weight-stack'));
  ops.push(circle(point(x + 3, bottom - 23), 2, 'machine-adjust', 'selector-pin'));
  return ops;
}
function tower(x, top = 12, bottom = 180) {
  return [...base(x - 18, x + 18, bottom), ...stack(x, top + 12, bottom - 6),
    L(x - 16, bottom - 4, x - 16, top), L(x + 16, bottom - 4, x + 16, top), L(x - 16, top, x + 16, top)];
}
function lever(pivot, contact, part = 'moving-lever') {
  return [line(pivot, contact, 'machine-lever', 5, part), circle(pivot), grip(contact)];
}

/** Back layer contains structural members; front contains small contact pads only. */
export function machineOps(anim, j, layer = 'back') {
  const id = anim.machine;
  if (!MACHINES[id]) return [];
  const ops = [];
  if (id === 'hip-abduction' || id === 'hip-adduction') {
    const {pelvis, left, right} = j;
    if (layer === 'back') {
      ops.push(...base(46, 183), ...tower(169, 59),
        rect(pelvis.x - 22, pelvis.y - 58, 44, 59, 'machine-pad-fill', 'backrest'),
        pad(point(73, 119), point(127, 119), 10, 'seat'),
        L(100, 125, 100, 175), L(100, 145, 156, 145));
      for (const s of [left, right]) {
        ops.push(line(point(100, 143), point(s.knee.x, 145), 'machine-lever', 4, 'knee-lever'),
          line(point(s.knee.x, 145), s.ankle, 'machine-lever', 3, 'foot-support'),
          pad(point(s.ankle.x - 7, s.ankle.y + 5), point(s.ankle.x + 7, s.ankle.y + 5), 5, 'footplate'));
      }
    } else {
      for (const [s, out] of [[left, -1], [right, 1]]) {
        const offset = (id === 'hip-adduction' ? -1 : 1) * out * 7;
        ops.push(pad(point(s.knee.x + offset, s.knee.y - 7), point(s.knee.x + offset, s.knee.y + 7), 6, 'knee-pad'));
      }
    }
    return ops;
  }
  if (layer === 'front') {
    if (id === 'calf-raise') ops.push(pad(point(j.shoulder.x - 9, j.shoulder.y - 7), point(j.shoulder.x + 9, j.shoulder.y - 7), 7, 'shoulder-pad'));
    if (id === 'ab-crunch-machine') ops.push(pad(point(j.shoulder.x + 7, j.shoulder.y + 8), point(j.shoulder.x + 11, j.shoulder.y + 20), 6, 'chest-pad'));
    return ops;
  }
  if (['face-pull', 'triceps-pushdown', 'lat-pulldown', 'seated-cable-row'].includes(id)) {
    const pulley = anim.props.find(p => p.type === 'cable').from;
    const x = id === 'lat-pulldown' ? 174 : pulley[0] + 20;
    const top = Math.min(12, pulley[1] - 8);
    ops.push(...tower(x, top), L(x - 16, top, pulley[0], top), L(pulley[0], top, ...pulley, 'machine-rail', 3),
      circle(point(...pulley), 5, 'machine-pivot', 'pulley'));
    if (id === 'lat-pulldown') {
      ops.push(...base(78, 192), L(104, 140, 104, 176), L(141, 123, 174, 123),
        pad(point(129, 123), point(150, 123), 7, 'thigh-restraint'),
        L(j.wrist.x - 22, j.wrist.y + 3, j.wrist.x + 22, j.wrist.y + 3, 'machine-grip', 3, 'lat-bar'));
    } else if (id === 'seated-cable-row') {
      ops.push(...base(36, x + 14), L(54, 161, 54, 176), L(93, 161, 93, 176),
        L(156, 139, 170, 176), grip(j.wrist));
    } else if (id === 'face-pull') {
      // Two rope ends diverge at the grip, unlike the rigid pushdown bar.
      ops.push(L(j.wrist.x + 10, j.wrist.y, j.wrist.x - 3, j.wrist.y - 7, 'machine-rope', 2, 'rope'),
        L(j.wrist.x + 10, j.wrist.y, j.wrist.x - 3, j.wrist.y + 7, 'machine-rope', 2, 'rope'),
        circle(point(j.wrist.x - 3, j.wrist.y - 7), 2.5, 'machine-grip-fill', 'rope-stop'),
        circle(point(j.wrist.x - 3, j.wrist.y + 7), 2.5, 'machine-grip-fill', 'rope-stop'));
    } else ops.push(L(j.wrist.x - 9, j.wrist.y, j.wrist.x + 9, j.wrist.y, 'machine-grip', 4, 'pushdown-bar'));
  } else if (id.startsWith('smith-')) {
    const x = id === 'smith-squat' ? 66 : 88;
    const bar = id === 'smith-squat' ? j.shoulder : j.wrist;
    ops.push(...base(x - 28, x + 78), L(x - 19, 177, x - 19, 7), L(x + 73, 177, x + 73, 7),
      L(x - 19, 7, x + 73, 7), L(x, 15, x, 174, 'machine-rail', 3), L(x + 54, 15, x + 54, 174, 'machine-rail', 3));
    for (const y of [34, 54, 74, 94, 114, 134]) ops.push(L(x - 19, y, x - 10, y - 3, 'machine-frame', 2.5, 'rack-hook'));
    ops.push(L(x - 8, bar.y, x + 62, bar.y, 'machine-rail', 4, 'guided-bar'),
      rect(x - 4, bar.y - 7, 8, 14, 'machine-carriage', 'bar-carriage'),
      rect(x + 50, bar.y - 7, 8, 14, 'machine-carriage', 'bar-carriage'),
      L(x - 9, 145, x + 10, 145, 'machine-adjust', 4, 'safety-stop'));
  } else if (id === 'leg-press') {
    ops.push(...base(12, 190), L(30, 139, 30, 176), L(78, 140, 92, 176),
      L(78, 129, 184, 68, 'machine-rail', 4, 'sled-rail'), L(96, 148, 202, 87, 'machine-rail', 4, 'sled-rail'),
      L(184, 68, 190, 176), L(202, 87, 190, 176));
    const p = point(j.toe.x + 13, j.toe.y + 7);
    ops.push(L(p.x - 9, p.y - 15, p.x + 11, p.y + 20, 'machine-lever', 7, 'sled'),
      circle(point(p.x + 17, p.y + 4), 13, 'machine-plate', 'load-plate'),
      circle(point(p.x + 17, p.y + 4), 3, 'machine-pivot'));
  } else if (id.startsWith('assisted-')) {
    const top = id === 'assisted-dip' ? -36 : 0;
    const floor = id === 'assisted-dip' ? 162 : 207;
    ops.push(...tower(24, top, floor), ...base(8, 157, floor),
      L(51, floor - 5, 51, top), L(155, floor - 5, 155, top), L(51, top, 155, top),
      L(51, top + 7, 100, top + 7, 'machine-grip', 4, 'pullup-grip'),
      L(155, 68, 110, 60, 'machine-grip', 4, 'dip-handle'),
      pad(point(53, floor - 20), point(75, floor - 20), 6, 'step'),
      pad(point(132, floor - 36), point(155, floor - 36), 6, 'step'),
      L(51, j.knee.y + 7, j.knee.x, j.knee.y + 7, 'machine-lever', 5, 'knee-carriage'),
      rect(46, j.knee.y - 1, 10, 16, 'machine-carriage', 'slider'),
      pad(point(j.knee.x - 25, j.knee.y + 7), point(j.knee.x + 7, j.knee.y + 7), 8, 'knee-platform'));
  } else if (id === 'back-extension') {
    ops.push(...base(31, 126), L(42, 175, 104, 114, 'machine-frame', 6),
      L(104, 114, 116, 176), L(48, 166, 66, 176, 'machine-lever', 5, 'footplate'),
      pad(point(101, 115), point(112, 104), 9, 'hip-pad'),
      circle(point(86, 133), 3, 'machine-adjust', 'height-adjustment'));
  } else if (id === 'calf-raise') {
    ops.push(...tower(155, 0), ...base(78, 173), L(126, 13, 126, 171, 'machine-rail', 4),
      L(126, j.shoulder.y - 8, j.shoulder.x, j.shoulder.y - 8, 'machine-lever', 5, 'shoulder-carriage'),
      rect(122, j.shoulder.y - 16, 8, 17, 'machine-carriage', 'slider'),
      L(j.shoulder.x + 19, j.shoulder.y - 8, j.shoulder.x + 19, j.shoulder.y + 18, 'machine-grip', 4, 'handle'));
  } else {
    // Selectorized machines share the stack, but each has its own working lever,
    // pivot, pad arrangement and seat orientation.
    const lying = id === 'leg-curl';
    const x = lying ? 177 : ['machine-row', 'machine-biceps-curl'].includes(id) ? 184 : 35;
    ops.push(...tower(x, lying ? 76 : 45), ...base(lying ? 15 : 48, lying ? 195 : 173));
    if (id === 'chest-press-machine') {
      ops.push(L(60, 176, 60, 39), L(60, 39, 76, 39), ...lever(point(76, 39), j.wrist));
    } else if (id === 'shoulder-press-machine') {
      ops.push(L(56, 175, 56, 111), ...lever(point(56, 111), j.wrist));
    } else if (id === 'machine-row') {
      ops.push(L(171, 176, 171, 50), L(112, 120, 112, 176), ...lever(point(171, 50), j.wrist));
    } else if (['leg-extension', 'seated-leg-curl', 'leg-curl'].includes(id)) {
      const dx = id === 'leg-extension' ? 4 : 0;
      const dy = id === 'seated-leg-curl' ? 6 : 0;
      ops.push(line(point(j.knee.x, 176), j.knee),
        ...lever(j.knee, point(j.ankle.x + dx, j.ankle.y + dy), 'roller-lever'));
      if (id === 'seated-leg-curl') ops.push(L(112, 114, 112, 176), pad(point(100, 114), point(123, 114), 8, 'thigh-restraint'));
    } else if (id === 'machine-biceps-curl') {
      ops.push(L(j.elbow.x, 176, j.elbow.x, j.elbow.y), ...lever(j.elbow, j.wrist, 'curl-lever'));
    } else if (id === 'ab-crunch-machine') {
      ops.push(L(59, 176, 59, 116), ...lever(point(59, 116), j.wrist, 'crunch-lever'));
    }
  }
  return ops;
}

/** Exact primitive extents feed the rig's camera fit; includes moving equipment. */
export function machinePoints(ops) {
  return ops.flatMap(({tag, a}) => {
    if (tag === 'line') {
      const r = a['stroke-width'] / 2;
      return [point(Math.min(a.x1, a.x2) - r, Math.min(a.y1, a.y2) - r), point(Math.max(a.x1, a.x2) + r, Math.max(a.y1, a.y2) + r)];
    }
    if (tag === 'circle') return [point(a.cx - a.r - 1, a.cy - a.r - 1), point(a.cx + a.r + 1, a.cy + a.r + 1)];
    return [point(a.x - 1, a.y - 1), point(a.x + a.width + 1, a.y + a.height + 1)];
  });
}
