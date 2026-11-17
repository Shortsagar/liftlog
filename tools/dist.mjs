import { publicAssets } from './public-assets.mjs';
// Copies only the files the app needs into ./dist (for drag-and-drop hosting like Netlify Drop).
// Usage: node tools/dist.mjs   (or: npm run dist)
import { rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'dist');
execFileSync(process.execPath, [join(ROOT, 'tools/build-sw.mjs')], { stdio: 'inherit' }); // fresh version + file list
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of [...publicAssets(ROOT), 'sw.js', '.nojekyll', '_headers']) {
  mkdirSync(dirname(join(OUT, f)), { recursive: true });
  copyFileSync(join(ROOT, f), join(OUT, f));
}
console.log('dist/ ready — drag that folder onto https://app.netlify.com/drop');
