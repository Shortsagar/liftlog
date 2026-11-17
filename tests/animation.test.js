import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EXERCISES, byId} from '../data/exercises.js';
import {normalizeKeyframes, solvePose, posedJoints, forwardKinematicsFront, fitBox, DIMS} from '../js/rig.js';
import {opsFor} from '../js/figure.js';
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const joints = (a,t) => posedJoints(a,normalizeKeyframes(a.keyframes),t);

test('every exercise renders finite, stable drawing operations throughout its loop', () => {
  for(const ex of EXERCISES) {
    const kfs=normalizeKeyframes(ex.anim.keyframes);
    const initial=opsFor(ex,solvePose(ex.anim,kfs,0));
    for(let i=0;i<120;i++) {
      const ops=opsFor(ex,solvePose(ex.anim,kfs,i/120));
      assert.deepEqual(ops.map(o=>o.tag),initial.map(o=>o.tag),ex.id);
      for(const op of ops) for(const v of Object.values(op.a)) {
        if(typeof v==='number') assert.ok(Number.isFinite(v),ex.id);
        else assert.ok(!/NaN|Infinity/.test(v),ex.id);
      }
      assert.ok(ops.some(o=>o.cls==='m-neutral'),`${ex.id} has full body definition`);
    }
    if(ex.anim.view!=='front') {
      const first=joints(ex.anim,0), last=joints(ex.anim,1-1e-6);
      for(const name of Object.keys(first)) assert.ok(distance(first[name],last[name])<.01,`${ex.id} seamless ${name}`);
    }
  }
});

test('planted supports stay fixed for the complete repetition',()=>{
  for(const ex of EXERCISES) for(const pin of ex.anim.pins||[]) {
    if(!pin.target || pin.relativeTo || pin.target.some(v=>v==null))continue;
    const name=(pin.limb==='arm'?'wrist':'ankle')+(pin.side==='far'?'2':'');
    for(let i=0;i<120;i++) assert.ok(distance(joints(ex.anim,i/120)[name],{x:pin.target[0],y:pin.target[1]})<.01,`${ex.id} ${name}`);
  }
});

test('guided press paths reach their endpoints and Smith bars stay on rails',()=>{
  for(const ex of EXERCISES)for(const pin of ex.anim.pins||[])for(const frame of pin.track||[]) {
    assert.ok(distance(joints(ex.anim,frame.t).wrist,{x:frame.point[0],y:frame.point[1]})<.01,ex.id);
  }
  for(let i=0;i<120;i++) {
    assert.ok(Math.abs(joints(byId('smith-bench-press').anim,i/120).wrist.x-88)<.01);
    assert.ok(Math.abs(joints(byId('smith-squat').anim,i/120).shoulder.x-66)<.01);
  }
});

test('seated hip machines keep pelvis stationary and knees move in opposite directions',()=>{
  for(const id of ['hip-abduction','hip-adduction']) {
    const a=byId(id).anim,k=normalizeKeyframes(a.keyframes);
    const f=t=>forwardKinematicsFront(solvePose(a,k,t),a.anchor,DIMS,a.seated);
    assert.deepEqual(f(0).pelvis,f(.5).pelvis);
    const width=t=>f(t).right.knee.x-f(t).left.knee.x;
    assert.ok(id==='hip-abduction'?width(.5)>width(0):width(.5)<width(0));
  }
});

test('plank holds its support and hip thrust finishes with horizontal torso and vertical shins',()=>{
  const p=joints(byId('plank').anim,0);
  assert.ok(Math.abs(p.elbow.y-176)<.2);
  assert.ok(Math.abs(p.wrist.y-p.elbow.y)<.01);
  const h=joints(byId('hip-thrust').anim,.5);
  assert.ok(Math.abs(h.shoulder.y-h.hip.y)<.01);
  assert.ok(Math.abs(h.knee.x-h.ankle.x)<.01);
});

test('fitted frames include full overhead bars and seated bodies',()=>{
  for(const id of ['pull-up','assisted-pull-up']) {
    const a=byId(id).anim,b=fitBox(a),p=a.props[0];
    assert.ok(b.x<=p.x-60 && b.x+b.w>=p.x+60);
  }
});

test('relative grips remain attached and no joints jump between adjacent frames',()=>{
  for(const ex of EXERCISES.filter(e=>e.anim.view!=='front')) {
    for(let i=0;i<240;i++) {
      const a=joints(ex.anim,i/240),b=joints(ex.anim,(i+1)/240);
      for(const name of Object.keys(a)) assert.ok(distance(a[name],b[name])<5,`${ex.id} jumps at ${name}`);
      for(const pin of ex.anim.pins||[]) if(pin.relativeTo) {
        const root=a[pin.relativeTo];
        assert.ok(distance(a.wrist,{x:root.x+pin.target[0],y:root.y+pin.target[1]})<.01,ex.id);
      }
    }
  }
});
