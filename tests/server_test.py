import importlib.util
from pathlib import Path
import unittest
import tempfile
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('serve', Path(__file__).resolve().parent.parent / 'tools' / 'serve.py')
serve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(serve)

class ServerTests(unittest.TestCase):
    def allowed(self, path):
        handler = object.__new__(serve.NoCache)
        handler.path = path
        return handler.allowed()

    def test_app_assets(self):
        for path in ['/', '/index.html', '/src/app.js', '/src/css/app.css', '/sw.js', '/tools/anim-preview.html?ex=squat']:
            with self.subTest(path=path):
                self.assertTrue(self.allowed(path))

    def test_private_paths_and_directory_listing(self):
        for path in ['/.git/config', '/.remember/', '/%2egit/config', '/package.json', '/README.md', '/tests/db.test.js', '/src/', '/src/../.git/config', '/src/%2e%2e/package.json', '/src/private-backup.json', '/Obsidian-Vault/Home.md', '/icons/.env', '/_headers', '/tools/public-assets.json']:
            with self.subTest(path=path):
                self.assertFalse(self.allowed(path))

    def test_symlink_asset_is_not_served(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'js').mkdir()
            (root / 'private.json').write_text('private')
            (root / 'js/app.js').symlink_to(root / 'private.json')
            with patch.object(serve, 'ROOT', root):
                self.assertFalse(self.allowed('/js/app.js'))

    def test_security_response_headers(self):
        handler = object.__new__(serve.NoCache)
        handler.path = '/index.html'
        headers = {}
        handler.send_header = lambda k, v: headers.update({k: v})
        with patch.object(serve.http.server.SimpleHTTPRequestHandler, 'end_headers'):
            handler.end_headers()
        self.assertIn("frame-ancestors 'none'", headers['Content-Security-Policy'])
        self.assertEqual(headers['X-Frame-Options'], 'DENY')
        self.assertEqual(headers['Referrer-Policy'], 'no-referrer')

if __name__ == '__main__':
    unittest.main()
