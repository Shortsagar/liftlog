import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore, memoryBackend, localBackend } from '../src/db.js';
import { exportAll, importAll, validateBackup } from '../src/backup.js';
import { buildCustomPlan, validatePlanForm } from '../src/plans.js';
import { PLANS } from '../database/plans.js';
import { makeEntry } from '../src/workout.js';
import { lastPerformance, detectPRs } from '../src/model.js';
import { localDate } from '../src/validation.js';
import { latestRunner, onDispose, disposeTree } from '../src/lifecycle.js';
import { saveQueue } from '../src/save-queue.js';
import { app, initState } from '../src/state.js';
import { savePlan } from '../src/plan-store.js';
import { saveSession } from '../src/repo.js';

function storage() {
  const data = new Map();
  return { data, fail: false, getItem: k => data.get(k) ?? null, removeItem: k => data.delete(k), setItem(k,v) { if (this.fail) throw new Error('QuotaExceededError'); data.set(k,v); } };
}
const day = { name: 'A', exercises: [{ exId: 'squat', sets: 3, reps: '5' }] };
const plan = () => buildCustomPlan({ id: 'custom-test', name: 'Test', weeks: 8, days: [day] });
const blank = () => ({ app: 'liftlog', version: 1, exportedAt: 123, sessions: [], plans: [], bodyweight: [], kv: [] });
for (const kind of ['memory', 'localStorage']) {
  test(`${kind}: transaction failure rolls back all stores`, async () => {
    const db = await openStore(kind === 'memory' ? memoryBackend() : localBackend(storage()));
    await db.put('sessions', { id: 'original' }); await db.kvSet('draft', { id: 'draft' });
    await assert.rejects(db.atomic(['sessions', 'kv'], tx => { tx.clear('sessions'); tx.put('kv', { id: 'draft', value: null }); throw Error('abort'); }));
    assert.equal((await db.all('sessions'))[0].id, 'original');
    assert.equal((await db.kvGet('draft')).id, 'draft');
  });
}
test('localStorage quota failure during import preserves original data', async () => {
  const ls = storage(), db = await openStore(localBackend(ls));
  await db.put('sessions', { id: 'original' }); ls.fail = true;
  await assert.rejects(importAll(db, blank()), /Quota/);
  assert.equal((await db.all('sessions'))[0].id, 'original');
});
test('localStorage legacy migration preserves special ids and refuses corrupt stores', async () => {
  const ls = storage(); ls.data.set('liftlog:sessions', '{"a":{"id":"a"}}');
  const db = await openStore(localBackend(ls)); await db.put('sessions', { id: '__proto__' });
  assert.deepEqual((await db.all('sessions')).map(s => s.id), ['a','__proto__']);
  const bad = storage(); bad.data.set('liftlog:sessions','broken');
  await assert.rejects(localBackend(bad).put('sessions', { id: 'b' }));
  assert.equal(bad.data.get('liftlog:sessions'), 'broken');
});
test('backup rejects malformed nested records, duplicate ids, versions, settings and progress', () => {
  const mutations = [b => b.version = 0, b => b.sessions.push({id:'x',date:1,name:'X',exercises:'bad'}),
    b => b.bodyweight.push({id:'x',date:null,kg:70}), b => b.plans.push({id:'x',name:'X',weeks:[]}),
    b => b.kv.push({id:'settings',value:{unit:'oz'}}), b => b.kv.push({id:'draft',value:{id:'x'}}),
    b => b.kv.push({id:'activePlan',value:{planId:'upper-lower',week:99,day:0,done:[]}}),
    b => b.bodyweight.push({id:'x',date:1,kg:70},{id:'x',date:2,kg:71})];
  for (const change of mutations) { const b = blank(); change(b); assert.notEqual(validateBackup(b), null); }
});
test('backup excludes installation metadata and restore retains destination metadata', async () => {
  const db = await openStore(memoryBackend()); await db.kvSet('__scopeOwner','/one/');
  const backup = await exportAll(db); assert.deepEqual(backup.kv, []);
  await importAll(db, blank()); assert.equal(await db.kvGet('__scopeOwner'), '/one/');
});
test('plan copy retains alternating weeks and rejects unbounded set counts', () => {
  const source = PLANS.find(p => p.id === 'stronglifts-5x5');
  const copy = buildCustomPlan({id:'copy',name:'Copy',weeks:12,days:source.weeks[0].days,templateWeeks:source.weeks});
  assert.deepEqual(copy.weeks, source.weeks);
  for (const sets of [Infinity, NaN, 0, -1, 1.5, 101, 1e9]) {
    const days = [{ ...day, exercises: [{exId:'squat',sets,reps:'5'}] }];
    assert.ok(validatePlanForm({name:'X',weeks:8,days}).length);
    assert.throws(() => makeEntry('squat',{sets,reps:'5'},[]));
  }
  assert.ok(validatePlanForm({name:'X',weeks:1.5,days:[day]}).length);
});
test('sample performances never prefill or suppress real personal records', () => {
  const session = (id,w,sample=false) => ({id,date:w,sample,exercises:[{exId:'squat',sets:[{w,r:5,done:true}]}]});
  const sample = session('sample',200,true), real = session('real',60);
  assert.equal(lastPerformance([sample], 'squat'), null);
  assert.equal(makeEntry('squat',null,[sample]).sets[0].w,null);
  assert.equal(lastPerformance([sample,real], 'squat')[0].w,60);
  assert.equal(detectPRs(session('new',65),[sample,real]).length,2);
});
test('editing an active schedule creates a revision and preserves draft and progress', async () => {
  await initState(memoryBackend()); const original = plan(); await savePlan(original);
  const active = {planId:original.id,week:5,day:0,done:[]};
  await app.db.kvSet('activePlan',active); await app.db.kvSet('draft',{id:'d',planRef:{planId:original.id,week:5,day:0}});
  const revised = await savePlan({...original,weeks:original.weeks.slice(0,2)});
  assert.notEqual(revised.id,original.id);
  assert.equal((await app.db.get('plans',original.id)).weeks.length,8);
  assert.deepEqual(await app.db.kvGet('activePlan'),active);
  assert.equal((await app.db.kvGet('draft')).planRef.planId,original.id);
});
test('finish commits session, progression and draft removal together', async () => {
  await initState(memoryBackend()); const p=plan(); await savePlan(p);
  await app.db.kvSet('activePlan',{planId:p.id,week:0,day:0,done:[]});
  const session={id:'s',planRef:{planId:p.id,week:0,day:0}};
  await app.db.kvSet('draft',session); await app.db.kvSet('rest',{endsAt:999,total:90});
  await saveSession(session);
  assert.equal(await app.db.kvGet('draft'),null); assert.equal(await app.db.kvGet('rest'),null);
  assert.equal((await app.db.kvGet('activePlan')).week,1);
  assert.equal((await app.db.all('sessions')).length,1);
  await assert.rejects(saveSession(session),/another window/);
});
test('date parser rejects empty, impossible and future dates', () => {
  const now = new Date(2026,10,16,12).getTime();
  for (const s of ['', '2026-02-30','2026-11-17','bad']) assert.equal(localDate(s,now), null);
  assert.equal(localDate('2026-11-16',now),new Date(2026,10,16,8).getTime());
});
test('latest navigation cannot mount an obsolete render', async () => {
  const run=latestRunner(); let release, started; const ready=new Promise(r=>started=r), pause=new Promise(r=>release=r); const mounted=[];
  const first=run(async current=>{started(); await pause; if(current())mounted.push('old');}); await ready;
  const second=run(async current=>{if(current())mounted.push('new');}); release(); await Promise.all([first,second]);
  assert.deepEqual(mounted,['new']);
});
test('save queue snapshots edits, preserves order and recovers from rejection', async () => {
  let fail=true; const values=[], statuses=[];
  const q=saveQueue(async v=>{if(fail)throw Error('full'); values.push(v);},s=>statuses.push(s));
  await assert.rejects(q.save({v:1})); fail=false;
  const value={v:2}; const saved=q.save(value); value.v=3; await saved;
  await q.save(value); await q.flush(); assert.deepEqual(values,[{v:2},{v:3}]); assert.equal(statuses.at(-1),'Saved');
});
test('view resource disposal traverses children and runs once', () => {
  const leaf={children:[]},root={children:[leaf]}; let count=0;
  onDispose(leaf,()=>count++); disposeTree(root); disposeTree(root); assert.equal(count,1);
});

import { migrateLegacy } from '../src/db.js';
test('legacy migration is claimed once, preserves existing scoped records and resumes safely', async () => {
  const legacy=memoryBackend(), first=memoryBackend(), second=memoryBackend();
  await legacy.put('sessions',{id:'old',name:'Legacy'});
  await first.put('sessions',{id:'old',name:'Newer scoped copy'});
  await migrateLegacy(first,legacy,'/first/');
  assert.equal((await first.get('sessions','old')).name,'Newer scoped copy');
  await migrateLegacy(second,legacy,'/second/');
  assert.deepEqual(await second.all('sessions'),[]);
  assert.equal((await legacy.get('sessions','old')).name,'Legacy');
  await first.del('sessions','old');await migrateLegacy(first,legacy,'/first/');
  assert.deepEqual(await first.all('sessions'),[]);
});

test('reset keeps migration markers so legacy history cannot reappear', async () => {
  const db=await openStore(memoryBackend());
  await db.kvSet('__scopeMigrated',true); await db.kvSet('settings',{unit:'kg'});await db.put('sessions',{id:'old'});
  await db.resetUserData();
  assert.deepEqual(await db.all('sessions'),[]);
  assert.equal(await db.kvGet('__scopeMigrated'),true);
  assert.equal(await db.kvGet('settings'),undefined);
});
test('failed workout completion preserves the draft, history and plan pointer', async () => {
  await initState(memoryBackend());const p=plan();await savePlan(p);
  const active={planId:p.id,week:0,day:0,done:[]};await app.db.kvSet('activePlan',active);
  const session={id:'s',planRef:{planId:p.id,week:0,day:0}};await app.db.kvSet('draft',session);
  const atomic=app.db.atomic;
  app.db.atomic=(stores,fn)=>atomic(stores,tx=>{fn(tx);throw Error('injected commit failure');});
  await assert.rejects(saveSession(session),/injected/);
  assert.deepEqual(await app.db.kvGet('draft'),session);
  assert.deepEqual(await app.db.kvGet('activePlan'),active);
  assert.deepEqual(await app.db.all('sessions'),[]);
});
