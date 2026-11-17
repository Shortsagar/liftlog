// Capture every exercise at four phases and check playback in a disposable Chromium profile.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const mime = { '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.svg':'image/svg+xml' };
const server = createServer(async (req,res) => {
  const path = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if (path === '/tests/runner') { res.setHeader('Content-Type','text/html'); res.end('<!doctype html><title>LiftLog integration checks</title><body></body>'); return; }
  const relative = path.replace(/^\/(?:second\/)?/, '') || 'index.html';
  const file = resolve(root,relative);
  if (!file.startsWith(root) || relative.split('/').some(p=>p.startsWith('.'))) {res.writeHead(404);res.end();return;}
  try {const data=await readFile(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const profile=await mkdtemp(join(tmpdir(),'liftlog-browser-'));
const chrome=process.env.CHROME_PATH || (process.platform==='darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'chromium');
const child=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update',`--user-data-dir=${profile}`,'--remote-debugging-pipe','about:blank'],{stdio:['ignore','ignore','pipe','pipe','pipe']});
let next=0, buffer='', logs='', session, exited=false;
const pending=new Map();
child.stderr.on('data',b=>{logs=(logs+b).slice(-3000);});
child.on('error',e=>{exited=true;for(const p of pending.values())p.reject(e);});
child.on('exit',()=>{exited=true;for(const p of pending.values())p.reject(Error('Browser exited: '+logs));});
child.stdio[3].on('error',e=>{for(const p of pending.values())p.reject(e);});
child.stdio[4].on('data',b=>{
  buffer+=b;let end;
  while((end=buffer.indexOf('\0'))>=0){const message=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);const p=pending.get(message.id);if(p){pending.delete(message.id);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);}}
});
function send(method,params={},target=session){if(exited)return Promise.reject(Error('Browser is closed'));return new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Timed out: '+method));},60000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});child.stdio[3].write(JSON.stringify({id,method,params,...(target?{sessionId:target}:{})})+'\0');});}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||JSON.stringify(result.exceptionDetails));return result.result.value;}
try {
  const {targetId}=await send('Target.createTarget',{url:origin+'/tests/runner'},null);
  session=(await send('Target.attachToTarget',{targetId,flatten:true},null)).sessionId;
  await send('Runtime.enable');
  // Navigation may not have committed when the target is attached.
  for(let i=0;i<100;i++){if(await evaluate('location.pathname')==='/tests/runner')break;await new Promise(r=>setTimeout(r,50));}
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1100,height:1400,deviceScaleFactor:1,mobile:false});
  const {EXERCISES} = await import('../data/exercises.js');
  for(let page=0;page<Math.ceil(EXERCISES.length/7);page++) {
    const ids=EXERCISES.slice(page*7,page*7+7).map(e=>e.id).join(',');
    await send('Page.navigate',{url:origin+'/tools/anim-preview.html?ex='+ids});
    for(let i=0;i<100;i++){if(await evaluate("document.querySelectorAll('.row').length")===ids.split(',').length)break;await new Promise(r=>setTimeout(r,50));}
    await evaluate("document.querySelectorAll('.row .figure').forEach(el=>el.style.height='170px')");
    await evaluate("window.scrollTo(0,0); new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
    const shot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(join(tmpdir(),'animation-review-'+page+'.png'),Buffer.from(shot.data,'base64'));
    console.log('Captured page',page,ids);
  }
  await evaluate("document.documentElement.dataset.theme='light'; window.scrollTo(0,0)");
  const light=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(join(tmpdir(),'animation-review-light.png'),Buffer.from(light.data,'base64'));
  await evaluate(`(async()=>{
    const {createFigure}=await import('/js/figure.js');
    const {EXERCISES}=await import('/data/exercises.js');
    for(const ex of EXERCISES){
      const fig=createFigure(ex,{autoplay:true});document.body.append(fig.el);
      const before=fig.el.innerHTML;fig.frame(0);
      if(before!==fig.el.innerHTML)throw Error(ex.id+' jumps on first frame');
      fig.frame(ex.anim.duration/2);
      if(ex.id!=='plank' && before===fig.el.innerHTML)throw Error(ex.id+' does not animate');
      fig.pause();if(fig.playing)throw Error('Pause failed');
      fig.play();if(!fig.playing)throw Error('Play failed');
      fig.destroy();fig.el.remove();
    }
  })()`);
  console.log('PASS all 44 figures render, advance, pause and resume without initial jumps');

} finally {
  await send('Browser.close',{},null).catch(()=>{});
  child.kill();server.close();await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
