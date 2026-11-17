import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EXERCISES, byId} from '../data/exercises.js';
import {MACHINES, machineOps, machinePoints} from '../js/machines.js';
import {DIMS, normalizeKeyframes, solvePose, forwardKinematics, forwardKinematicsFront, fitBox} from '../js/rig.js';
const joints = (anim, t) => {
  const pose = solvePose(anim, normalizeKeyframes(anim.keyframes), t);
  return anim.view === 'front' ? forwardKinematicsFront(pose, anim.anchor, DIMS, anim.seated) : forwardKinematics(pose, anim.anchor);
};

test('every machine and cable exercise has identifying equipment artwork and guidance', () => {
  const exercises = EXERCISES.filter(e => ['machine', 'cable'].includes(e.equipment));
  assert.equal(exercises.length, 21);
  for (const ex of exercises) {
    assert.ok(MACHINES[ex.anim.machine]?.hint, ex.id);
    const ops = machineOps(ex.anim, joints(ex.anim, .5));
    assert.ok(ops.some(o => o.a['data-part'] === 'frame'), ex.id);
    assert.ok(ops.some(o => ['sled-rail', 'rack-hook', 'hip-pad', 'knee-lever', 'weight-stack'].includes(o.a['data-part'])), `${ex.id}: recognizable equipment structure`);
  }
});

test('complete machine silhouettes and moving parts fit the camera throughout every rep', () => {
  for (const ex of EXERCISES.filter(e => e.anim.machine)) {
    const box = fitBox(ex.anim);
    let signature;
    for (let i = 0; i < 120; i++) {
      const j = joints(ex.anim, i / 120);
      const ops = [...machineOps(ex.anim, j), ...machineOps(ex.anim, j, 'front')];
      const tags = ops.map(o => o.tag);
      if (signature) assert.deepEqual(tags, signature, ex.id);
      signature = tags;
      for (const p of machinePoints(ops)) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), ex.id);
        assert.ok(p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h,
          `${ex.id} equipment clipped at ${i / 120}`);
      }
    }
  }
});

test('leg-machine roller levers follow the ankle while their knee pivots stay fixed', () => {
  for (const id of ['leg-extension', 'leg-curl', 'seated-leg-curl']) {
    const anim = byId(id).anim;
    const initial = joints(anim, 0).knee;
    for (let i = 0; i < 60; i++) {
      const j = joints(anim, i / 60);
      const op = machineOps(anim, j).find(o => o.a['data-part'] === 'roller-lever').a;
      assert.equal(op.x1, initial.x); assert.equal(op.y1, initial.y);
      assert.equal(op.x2, j.ankle.x + (id === 'leg-extension' ? 4 : 0));
      assert.equal(op.y2, j.ankle.y + (id === 'seated-leg-curl' ? 6 : 0));
    }
  }
});

test('hip machine pads distinguish inner-knee adduction from outer-knee abduction', () => {
  for (const id of ['hip-abduction', 'hip-adduction']) {
    const anim = byId(id).anim, j = joints(anim, .3);
    const pads = machineOps(anim, j, 'front').filter(o => o.a['data-part'] === 'knee-pad');
    assert.equal(pads.length, 2);
    assert.equal(pads[1].a.x1 > j.right.knee.x, id === 'hip-abduction');
    assert.equal(pads[0].a.x1 < j.left.knee.x, id === 'hip-abduction');
  }
});
