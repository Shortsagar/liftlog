import { test } from 'node:test';
import assert from 'node:assert/strict';
import { samplePose, forwardKinematics, legIK, DIMS, lerpAngle, normalizeKeyframes } from '../src/rig.js';

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const STAND = { trunk: 0, head: 0, uArm: 180, fArm: 180, thigh: 180, shin: 180, foot: 90 };

test('lerpAngle takes the shortest arc', () => {
  near(lerpAngle(350, 10, 0.5) % 360, 0);
  near(lerpAngle(270, 10, 0.5), 320);
  near(lerpAngle(10, 350, 0.25), 5);
});

test('samplePose at t=0 equals the first keyframe', () => {
  const kfs = normalizeKeyframes([{ t: 0, pose: STAND }, { t: 0.5, pose: { ...STAND, thigh: 90 } }]);
  assert.equal(samplePose(kfs, 0).thigh, 180);
});

test('samplePose midway between keyframes is the eased midpoint', () => {
  const kfs = normalizeKeyframes([{ t: 0, pose: STAND }, { t: 0.5, pose: { ...STAND, thigh: 90 } }]);
  near(samplePose(kfs, 0.25).thigh, 135);
  // wraps from the last keyframe back to the first
  near(samplePose(kfs, 0.75).thigh, 135);
});

test('normalizeKeyframes fills far-side limbs from near-side', () => {
  const [k] = normalizeKeyframes([{ t: 0, pose: STAND }]);
  assert.equal(k.pose.thigh2, 180);
  assert.equal(k.pose.uArm2, 180);
});

test('forwardKinematics: standing straight puts ankle directly below hip', () => {
  const j = forwardKinematics({ ...STAND }, { joint: 'hip', x: 100, y: 100 });
  near(j.ankle.x, 100);
  near(j.ankle.y, 100 + DIMS.thigh + DIMS.shin);
  near(j.shoulder.y, 100 - DIMS.trunk);
});

test('forwardKinematics preserves segment lengths in any pose', () => {
  const pose = { trunk: 37, head: 20, uArm: 211, fArm: 15, thigh: 97, shin: 205, foot: 100 };
  const j = forwardKinematics(pose, { joint: 'hip', x: 0, y: 0 });
  near(dist(j.hip, j.shoulder), DIMS.trunk);
  near(dist(j.shoulder, j.elbow), DIMS.uArm);
  near(dist(j.elbow, j.wrist), DIMS.fArm);
  near(dist(j.hip, j.knee), DIMS.thigh);
  near(dist(j.knee, j.ankle), DIMS.shin);
});

test('forwardKinematics anchors the chosen joint at the anchor point', () => {
  const j = forwardKinematics({ ...STAND, thigh: 95, shin: 205 }, { joint: 'ankle', x: 50, y: 170 });
  near(j.ankle.x, 50); near(j.ankle.y, 170);
  const k = forwardKinematics({ ...STAND, uArm: 0, fArm: 0 }, { joint: 'wrist', x: 100, y: 30 });
  near(k.wrist.x, 100); near(k.wrist.y, 30);
});

test('legIK returns angles that land the ankle on target with the knee in front', () => {
  const hip = { x: 0, y: 0 }, ankle = { x: 30, y: 45 };
  const { thigh, shin } = legIK(hip, ankle, 'front');
  const j = forwardKinematics({ ...STAND, thigh, shin }, { joint: 'hip', x: 0, y: 0 });
  near(j.ankle.x, 30, 0.05); near(j.ankle.y, 45, 0.05);
  assert.ok(j.knee.x > (hip.x + ankle.x) / 2, 'knee should bend forward');
});

import { posedJoints } from '../src/rig.js';
test('a pinned hand stays on its target through the whole clip', () => {
  const anim = {
    anchor: { joint: 'toe', x: 30, y: 180 },
    pins: [{ limb: 'arm', target: [140, 176], bend: 'back' }],
    keyframes: [
      { t: 0, pose: { trunk: 71, head: 80, uArm: 188, fArm: 188, thigh: 251, shin: 251, foot: 180 } },
      { t: 0.5, pose: { trunk: 84, head: 90, uArm: 255, fArm: 150, thigh: 264, shin: 264, foot: 180 } },
    ],
  };
  const kfs = normalizeKeyframes(anim.keyframes);
  for (let t = 0; t < 1; t += 0.1) {
    const j = posedJoints(anim, kfs, t);
    near(j.wrist.x, 140, 0.05); near(j.wrist.y, 176, 0.05);
    // elbow sits on the feet side (−x) of the shoulder→hand line
    const { shoulder: S, wrist: H, elbow: E } = j;
    const lineX = S.x + (H.x - S.x) * ((E.y - S.y) / (H.y - S.y));
    assert.ok(E.x <= lineX + 0.01, `elbow should bend back toward the feet at t=${t.toFixed(1)}`);
  }
});
