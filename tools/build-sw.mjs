import { publicAssets } from './public-assets.mjs';
// Refreshes sw.js: the PRECACHE file list and a VERSION hash of all app files.
// Run after changing any app file:  node tools/build-sw.mjs   (or: npm run build-sw)
// A new VERSION makes phones download the update and show "Update ready".
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const files = publicAssets(ROOT);
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(ROOT, f)));
const normalizedSW = readFileSync(join(ROOT, 'sw.js'), 'utf8').replace(/const VERSION = '[^']*';/, "const VERSION = '';").replace(/const PRECACHE = \[[\s\S]*?\];/, 'const PRECACHE = [];');
hash.update(normalizedSW);
const version = hash.digest('hex').slice(0, 10);

const swPath = join(ROOT, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
sw = sw.replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = [\n  './',\n${files.map(f => `  './${f}',`).join('\n')}\n];`);
if (process.argv.includes('--check')) {
  if (sw !== readFileSync(swPath, 'utf8')) { console.error('sw.js is stale — run npm run build-sw'); process.exitCode = 1; }
} else {
  writeFileSync(swPath, sw);
  console.log(`sw.js: ${files.length} files, version ${version}`);
}
