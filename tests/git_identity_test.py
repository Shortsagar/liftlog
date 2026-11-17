import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent

class IdentityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.env = {k:v for k,v in os.environ.items() if not k.startswith('GIT_')}
        self.env['GIT_CONFIG_NOSYSTEM'] = '1'
        self.env['GIT_CONFIG_GLOBAL'] = os.devnull
        self.git('init', '-q')
        self.git('config', 'user.name', 'shortsagar')
        self.git('config', 'user.email', '314394435+Shortsagar@users.noreply.github.com')
        shutil.copytree(ROOT / '.githooks', self.root / '.githooks')
        (self.root / 'tools').mkdir()
        shutil.copy(ROOT / 'tools/check-git-identity.py', self.root / 'tools')
        self.git('config', 'core.hooksPath', '.githooks')

    def git(self, *args, ok=True, env=None):
        result = subprocess.run(['git', *args], cwd=self.root, env=env or self.env, text=True, capture_output=True)
        if ok:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        return result

    def push_check(self, sha='HEAD', ok=True):
        sha = self.git('rev-parse', sha).stdout.strip()
        result = subprocess.run([str(self.root / '.githooks/pre-push')], cwd=self.root, env=self.env,
            input=f'refs/heads/main {sha} refs/heads/main {"0"*40}\n', text=True, capture_output=True)
        self.assertEqual(result.returncode == 0, ok, result.stderr)

    def test_approved_identity_can_commit_and_push(self):
        self.git('commit', '--allow-empty', '-m', 'Safe fixture')
        self.push_check()

    def test_author_override_is_blocked(self):
        self.git('commit', '--allow-empty', '--author=Private Person <private@example.test>', '-m', 'Fixture', ok=False)

    def test_committer_override_is_blocked(self):
        env = dict(self.env, GIT_COMMITTER_NAME='Private Person', GIT_COMMITTER_EMAIL='private@example.test')
        self.git('commit', '--allow-empty', '-m', 'Fixture', env=env, ok=False)

    def test_push_blocks_bad_ancestor_even_with_safe_tip(self):
        self.git('-c', 'core.hooksPath=/dev/null', 'commit', '--allow-empty', '--author=Private Person <private@example.test>', '-m', 'Old fixture')
        self.git('commit', '--allow-empty', '-m', 'Safe tip')
        self.push_check(ok=False)

    def test_push_blocks_private_annotated_tagger(self):
        self.git('commit', '--allow-empty', '-m', 'Safe fixture')
        self.git('-c', 'user.name=Private Person', '-c', 'user.email=private@example.test', 'tag', '-a', 'private-tag', '-m', 'Fixture')
        self.push_check('private-tag', ok=False)

if __name__ == '__main__':
    unittest.main()
