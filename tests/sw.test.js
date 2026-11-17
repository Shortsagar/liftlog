import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const swSrc = () => readFileSync(join(ROOT, 'sw.js'), 'utf8');
const precache = () => {
  const m = swSrc().match(/const PRECACHE = (\[[\s\S]*?\]);/);
  assert.ok(m, 'sw.js must define const PRECACHE = [...]');
  return Function(`return ${m[1]}`)();
};
function walk(dir) {
  return readdirSync(join(ROOT, dir)).flatMap(f => {
    const p = join(dir, f);
    return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p];
  });
}

test('every precached path exists on disk', () => {
  for (const p of precache()) {
    const file = p === './' ? 'index.html' : p.replace(/^\.\//, '');
    assert.ok(existsSync(join(ROOT, file)), `missing ${p}`);
  }
});

test('every app file is precached (so the app works offline)', () => {
  const list = new Set(precache().map(p => p.replace(/^\.\//, '')));
  const files = ['index.html', 'manifest.webmanifest', ...walk('js'), ...walk('css'), ...walk('data'), ...walk('icons')]
    .map(f => relative(ROOT, join(ROOT, f)));
  for (const f of files) assert.ok(list.has(f), `${f} is not in sw.js PRECACHE`);
});

test('manifest is installable: standalone, relative start_url, 192 + 512 icons', () => {
  const m = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  const sizes = m.icons.map(i => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(m.icons.some(i => (i.purpose || '').includes('maskable')));
  for (const i of m.icons) assert.ok(existsSync(join(ROOT, i.src)), `icon ${i.src} missing`);
});

import { execFileSync } from 'node:child_process';
test('sw.js VERSION is current (run `npm run build-sw` after editing app files)', () => {
  const before = swSrc();
  execFileSync(process.execPath, [join(ROOT, 'tools/build-sw.mjs'), '--check']);
  const after = swSrc();
  assert.equal(after, before, 'sw.js must not be modified by the freshness check');
});

import vm from 'node:vm';
test('service worker isolates cache cleanup and navigation by installation scope', async () => {
  const handlers = {}, deleted = [];
  const scope = 'https://example.test/app/';
  const own = `liftlog-${encodeURIComponent(scope)}-old`;
  vm.runInNewContext(swSrc(), {
    self: { registration: { scope }, location: { origin:'https://example.test' }, clients: { claim:async()=>{} }, addEventListener:(name,fn)=>handlers[name]=fn },
    caches: { keys:async()=>[own,'liftlog-other-install'], delete:async k=>deleted.push(k), open:async()=>({match:async()=> 'shell'}) }, URL,
  });
  let activation; handlers.activate({waitUntil:p=>activation=p}); await activation;
  assert.deepEqual(deleted,[own]);
  let response;
  handlers.fetch({request:{method:'GET',url:scope+'tools/anim-preview.html',mode:'navigate'},respondWith:p=>response=p});
  assert.equal(response,undefined);
  handlers.fetch({request:{method:'GET',url:scope,mode:'navigate'},respondWith:p=>response=p});
  assert.equal(await response,'shell');
});

test('activation removes the pre-scope cache of this installation only', async () => {
  const handlers = {}, deleted = [];
  const scope = 'https://example.test/app/';
  const entries = {
    'liftlog-12e3b44079': [scope + 'index.html', scope + 'js/app.js'],          // old format, this install
    'liftlog-aaaaaaaaaa': ['https://example.test/other/index.html'],           // old format, another install
  };
  vm.runInNewContext(swSrc(), {
    self: { registration: { scope }, location: { origin: 'https://example.test' }, clients: { claim: async () => {} }, addEventListener: (n, f) => handlers[n] = f },
    caches: {
      keys: async () => Object.keys(entries), delete: async k => deleted.push(k),
      open: async k => ({ keys: async () => (entries[k] || []).map(url => ({ url })) }),
    }, URL,
  });
  let done; handlers.activate({ waitUntil: p => done = p }); await done;
  assert.deepEqual(deleted, ['liftlog-12e3b44079']);
});
