import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publicAssets } from '../tools/public-assets.mjs';
import { MAX_BACKUP_BYTES, readBackupFile } from '../src/backup.js';
import { h } from '../src/ui.js';

test('oversized backups are rejected before reading attacker-controlled contents', async () => {
  let read = false;
  await assert.rejects(readBackupFile({size:MAX_BACKUP_BYTES+1,text(){read=true;throw Error('read');}}), /20 MB/);
  assert.equal(read,false);
  await assert.rejects(readBackupFile({size:2,text:async()=> '{}'}), /Not a LiftLog/);
});
test('public inventory excludes unexpected private files and rejects symlinked assets', () => {
  const root=mkdtempSync(join(tmpdir(),'liftlog-assets-'));
  try {
    mkdirSync(join(root,'tools'));mkdirSync(join(root,'js'));
    writeFileSync(join(root,'tools/public-assets.json'), '["js/app.js"]');
    for(const f of ['js/app.js','js/private-backup.json','sw.js','.nojekyll','_headers']) writeFileSync(join(root,f),'private fixture');
    assert.deepEqual(publicAssets(root),['js/app.js']);
    rmSync(join(root,'js/app.js'));symlinkSync(join(root,'js/private-backup.json'),join(root,'js/app.js'));
    assert.throws(()=>publicAssets(root),/symlink/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('DOM helper refuses raw HTML', () => {
  const previous=globalThis.document;
  globalThis.document={createElement:()=>({})};
  try {assert.throws(()=>h('div',{html:'<img src=x onerror=alert(1)>'}),/Raw HTML/);}
  finally {globalThis.document=previous;}
});
test('deployment policy blocks external scripts, framing and sensitive browser permissions', () => {
  const headers=readFileSync(new URL('../_headers',import.meta.url),'utf8');
  assert.match(headers,/script-src 'self';/);
  assert.match(headers,/frame-ancestors 'none'/);
  assert.match(headers,/Referrer-Policy: no-referrer/);
  assert.match(headers,/geolocation=\(\)/);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/http-equiv="Content-Security-Policy"/);
});
