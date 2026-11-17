// Refreshes sw.js: the PRECACHE file list and a VERSION hash of all app files.
// Run after changing any app file:  node tools/build-sw.mjs   (or: npm run build-sw)
// A new VERSION makes phones download the update and show "Update ready".
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const walk = dir => readdirSync(join(ROOT, dir)).sort().flatMap(f => {
  const p = `${dir}/${f}`;
  return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p];
});
const files = ['index.html', 'manifest.webmanifest', ...walk('css'), ...walk('js'), ...walk('data'), ...walk('icons')];
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(ROOT, f)));
const version = hash.digest('hex').slice(0, 10);

const swPath = join(ROOT, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
sw = sw.replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = [\n  './',\n${files.map(f => `  './${f}',`).join('\n')}\n];`);
writeFileSync(swPath, sw);
console.log(`sw.js: ${files.length} files, version ${version}`);
