// Copies only the files the app needs into ./dist (for drag-and-drop hosting like Netlify Drop).
// Usage: node tools/dist.mjs   (or: npm run dist)
import { cpSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'dist');
execFileSync(process.execPath, [join(ROOT, 'tools/build-sw.mjs')], { stdio: 'inherit' }); // fresh version + file list
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', '.nojekyll']) copyFileSync(join(ROOT, f), join(OUT, f));
for (const d of ['css', 'js', 'data', 'icons']) cpSync(join(ROOT, d), join(OUT, d), { recursive: true });
console.log('dist/ ready — drag that folder onto https://app.netlify.com/drop');
