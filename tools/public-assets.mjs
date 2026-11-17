// Explicit public inventory: adding a file requires a deliberate review.
import { readFileSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
export function publicAssets(root) {
  const files = JSON.parse(readFileSync(join(root, 'tools/public-assets.json'), 'utf8'));
  for (const file of [...files, 'sw.js', '.nojekyll', '_headers']) {
    const parts = file.split('/');
    if (parts.some(p => !p || p === '..') || file.startsWith('/')) throw Error('Invalid public asset path');
    for (let i = 1; i <= parts.length; i++) {
      if (lstatSync(join(root, ...parts.slice(0, i))).isSymbolicLink()) throw Error(`Public asset must not be a symlink: ${file}`);
    }
    if (!lstatSync(join(root, file)).isFile()) throw Error(`Missing public asset: ${file}`);
  }
  return files;
}
