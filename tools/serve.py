"""Serve app assets only. LAN access requires the explicit --lan option."""
import argparse
import http.server
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
FILES = {'index.html', 'manifest.webmanifest', 'sw.js', 'tools/anim-preview.html'}
DIRECTORIES = {'css', 'js', 'data', 'icons'}

class NoCache(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def allowed(self):
        relative = unquote(urlsplit(self.path).path).lstrip('/') or 'index.html'
        parts = Path(relative).parts
        if any(p.startswith('.') for p in parts):
            return False
        if relative not in FILES and (not parts or parts[0] not in DIRECTORIES):
            return False
        target = (ROOT / relative).resolve()
        return target.is_relative_to(ROOT) and target.is_file()

    def send_head(self):
        if not self.allowed():
            self.send_error(404, 'Not found')
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404, 'Not found')
        return None

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('port', nargs='?', type=int, default=8080)
    parser.add_argument('--lan', action='store_true', help='Allow devices on your network to access app assets')
    args = parser.parse_args()
    http.server.ThreadingHTTPServer(('0.0.0.0' if args.lan else '127.0.0.1', args.port), NoCache).serve_forever()
