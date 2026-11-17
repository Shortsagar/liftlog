// Run after cloning: npm run privacy:setup
import { execFileSync } from 'node:child_process';
const root = new URL('..', import.meta.url);
for (const [key, value] of Object.entries({
  'user.name': 'shortsagar',
  'user.email': '314394435+Shortsagar@users.noreply.github.com',
  'user.useConfigOnly': 'true',
  'core.hooksPath': '.githooks',
})) execFileSync('git', ['config', '--local', key, value], { cwd: root });
console.log('Privacy identity and commit/push guards enabled for this clone.');
