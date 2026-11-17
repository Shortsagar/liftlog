import { idbBackend, openStore, localBackend } from '../js/db.js';
import { exportAll, importAll, validateBackup } from '../js/backup.js';
import { h, modal } from '../js/ui.js';
import { mountDemo } from '../js/demo.js';
import { byId } from '../data/exercises.js';
import { disposeTree } from '../js/lifecycle.js';
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
const wait=async (fn,msg)=>{for(let i=0;i<200;i++){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,25));}throw Error(msg);};
export async function runChecks(){
  const results=[];
  const db=await openStore(await idbBackend('liftlog-integration'));
  await db.put('sessions',{id:'original',date:1,name:'Original',exercises:[]});
  await db.kvSet('draft',{id:'draft'});
  try {await db.atomic(['sessions','kv'],tx=>{tx.clear('sessions');tx.put('kv',{id:'draft',value:null});throw Error('injected');});}catch(e){assert(e.message==='injected','Wrong transaction failure');}
  assert((await db.all('sessions'))[0].id==='original','IDB rollback lost session');
  assert((await db.kvGet('draft')).id==='draft','IDB rollback lost draft');
  results.push('native IndexedDB abort rolls back both stores');
  await db.put('sessions',{id:'other',date:2,name:'Other',exercises:[]});
  const seen=await db.atomic(['sessions','kv'],tx=>{
    let threw=false;try{tx.all('sessions');}catch{threw=true;}
    tx.put('sessions',{id:'added',date:3,name:'Added',exercises:[]});
    return {threw,draft:tx.get('kv','draft')?.value?.id,other:tx.get('sessions','other')};
  },{keys:{sessions:[],kv:['draft']}});
  assert(seen.threw&&seen.draft==='draft'&&seen.other===undefined,'Partial transaction read more than requested');
  assert((await db.all('sessions')).length===3,'Partial transaction write lost');
  await db.del('sessions','other');await db.del('sessions','added');
  results.push('native IndexedDB partial-key transactions read only requested records');
  await db.kvSet('draft',null);
  const backup=await exportAll(db);assert(validateBackup(backup)===null,'Export invalid');
  await db.clear();await importAll(db,backup);db.close();
  const reopened=await openStore(await idbBackend('liftlog-integration'));
  assert((await reopened.all('sessions'))[0].id==='original','Restore not durable');reopened.close();
  results.push('native IndexedDB export/import persists across reopen');
  let failLocal=false;
  const ls={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>{if(failLocal)throw Error('quota');localStorage.setItem(k,v);}};
  const local=await openStore(localBackend(ls,'integration-local:'));
  await local.put('sessions',{id:'original'});failLocal=true;
  try{await local.clear();throw Error('Expected quota error');}catch(e){assert(e.message==='quota','Wrong localStorage failure');}
  failLocal=false;await local.put('sessions',{id:'new'});
  assert((await local.all('sessions')).length===2,'Web Lock or snapshot failed after quota rejection');
  results.push('browser localStorage rollback and Web Lock release after failure');

  const main=h('main',{},h('button',{},'Opener')), overlay=h('div',{id:'overlay-root'});
  document.body.append(main,overlay);const opener=main.firstChild;opener.focus();
  const close=modal(h('button',{},'Inside'),{title:'Focus test'});
  assert(main.inert,'Modal background is not inert');
  assert(overlay.contains(document.activeElement),'Modal did not receive focus');
  close();assert(!main.inert&&document.activeElement===opener,'Modal did not restore focus');
  results.push('modal focus and background isolation');
  const demo=h('div');document.body.append(demo);mountDemo(demo,byId('squat'));
  const fig=demo.querySelector('svg.figure').__fig;fig.pause();let destroyed=false;
  const destroy=fig.destroy;fig.destroy=()=>{destroyed=true;destroy();};
  disposeTree(demo);demo.remove();assert(destroyed,'Paused demo not disposed');
  results.push('paused compact animation cleanup');main.remove();overlay.remove();

  const frame=document.createElement('iframe');frame.style='width:430px;height:800px';document.body.append(frame);
  let doc;
  const open=async path=>{const old=frame.contentDocument;frame.src=path;await wait(()=>{try{return frame.contentDocument!==old && frame.contentDocument?.querySelector('#tabs a');}catch{return false;}},'App did not load');doc=frame.contentDocument;};
  await open('/#/today');
  // First install can reload once after the service worker takes control.
  await wait(()=>frame.contentWindow.navigator.serviceWorker.controller,'No service worker controller');
  await new Promise(r=>setTimeout(r,500));doc=frame.contentDocument;
  const button=label=>[...doc.querySelectorAll('button')].find(b=>b.textContent.trim()===label);
  button('Start empty workout').click();await wait(()=>doc.querySelector('.log'),'Logging view did not open');
  const title=doc.querySelector('[aria-label="Workout name"]');title.value='Browser workout';title.dispatchEvent(new Event('input',{bubbles:true}));
  button('Add exercise').click();await wait(()=>doc.querySelector('.pick-item'),'Picker did not open');
  [...doc.querySelectorAll('.pick-item')].find(b=>b.textContent.includes('Barbell Bench Press')).click();
  await wait(()=>doc.querySelector('.ex-card'),'Exercise not added');
  const weight=doc.querySelector('input[data-field="w"]');weight.value='135';weight.dispatchEvent(new Event('input',{bubbles:true}));
  for(const check of doc.querySelectorAll('.check'))check.click();
  await wait(()=>[...doc.querySelectorAll('[role="status"]')].some(e=>e.textContent==='Saved'),'Draft did not save');
  const state = await frame.contentWindow.eval("import('/js/state.js')");
  const atomic = state.app.db.atomic;
  state.app.db.atomic = async()=>{throw Error('Injected storage failure');};
  title.value='Unsaved workout';title.dispatchEvent(new Event('input',{bubbles:true}));
  await wait(()=>doc.body.textContent.includes('Not saved'),'Missing save failure state');
  doc.querySelector('#tabs a[href="#/settings"]').click();
  await wait(()=>frame.contentWindow.location.hash==='#/log','Failed save did not block navigation');
  assert(doc.querySelector('[aria-label="Workout name"]').value==='Unsaved workout','Failed navigation discarded unsaved edits');
  state.app.db.atomic=atomic;
  title.value='Browser workout';title.dispatchEvent(new Event('input',{bubbles:true}));
  button('Retry save').click();
  await wait(()=>[...doc.querySelectorAll('[role="status"]')].some(e=>e.textContent==='Saved'),'Save retry failed');
  results.push('storage failure is visible, blocks navigation and recovers on retry');
  frame.contentWindow.location.reload();
  await wait(()=>frame.contentDocument!==doc && frame.contentDocument?.querySelector('.log'),'Draft did not survive reload');doc=frame.contentDocument;
  assert(doc.querySelector('[aria-label="Workout name"]').value==='Browser workout','Workout title lost');
  assert(doc.querySelector('input[data-field="w"]').value==='135','Weight lost');
  assert(doc.querySelectorAll('.check[aria-pressed="true"]').length===3,'Completed sets lost');
  results.push('real UI logging, propagation, draft save and reload recovery');
  button('Finish workout').click();await wait(()=>doc.body.textContent.includes('Workout saved'),'Finish failed');
  assert(!doc.querySelector('.toast')?.textContent.includes('failed'),'Save error');
  results.push('real UI finish persists workout and clears draft');
  frame.contentWindow.location.hash='#/log';await wait(()=>doc.body.textContent.includes('No workout in progress'),'Draft not cleared');
  frame.contentWindow.location.hash='#/plan/stronglifts-5x5';await wait(()=>doc.body.textContent.includes('Customize'),'Plan detail failed');
  doc.querySelector('a[href*="plan-edit/copy:"]').click();await wait(()=>doc.querySelector('[aria-label="Week to edit"]'),'Week editor missing');
  const week=doc.querySelector('[aria-label="Week to edit"]');week.value='1';week.dispatchEvent(new Event('change',{bubbles:true}));
  assert(doc.querySelector('[aria-label="Day 1 name"]').value==='Workout B','Alternating week lost');
  results.push('5×5 Customize preserves second-week schedule');
  // Navigation to a developer page must reach that page, even under SW control.
  frame.src='/tools/anim-preview.html';await wait(()=>frame.contentDocument?.querySelector('h1')?.textContent==='Animation preview (dev)','SW intercepted developer preview');
  results.push('service worker allows developer-page navigation');
  // A second installation must neither inherit current root data nor delete its cache.
  await open('/second/#/today');
  await wait(()=>frame.contentWindow.navigator.serviceWorker.controller?.scriptURL.includes('/second/'),'Second installation did not activate');
  await new Promise(r=>setTimeout(r,300));doc=frame.contentDocument;
  assert(!doc.body.textContent.includes('Browser workout'),'Second installation leaked root history');
  const names=await caches.keys();
  assert(names.some(k=>k.startsWith(`liftlog-${encodeURIComponent(location.origin+'/')}-`)),'Second installation removed root cache');
  assert(names.some(k=>k.startsWith(`liftlog-${encodeURIComponent(location.origin+'/second/')}-`)),'Second installation cache missing');
  results.push('separate installation databases and caches stay isolated');
  frame.remove();
  return results;
}
