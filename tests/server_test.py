import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('serve', Path(__file__).resolve().parent.parent / 'tools' / 'serve.py')
serve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(serve)

class ServerTests(unittest.TestCase):
    def allowed(self, path):
        handler = object.__new__(serve.NoCache)
        handler.path = path
        return handler.allowed()

    def test_app_assets(self):
        for path in ['/', '/index.html', '/js/app.js', '/css/app.css', '/sw.js', '/tools/anim-preview.html?ex=squat']:
            with self.subTest(path=path):
                self.assertTrue(self.allowed(path))

    def test_private_paths_and_directory_listing(self):
        for path in ['/.git/config', '/.remember/', '/%2egit/config', '/package.json', '/README.md', '/tests/db.test.js', '/js/', '/js/../.git/config', '/js/%2e%2e/package.json']:
            with self.subTest(path=path):
                self.assertFalse(self.allowed(path))

if __name__ == '__main__':
    unittest.main()
