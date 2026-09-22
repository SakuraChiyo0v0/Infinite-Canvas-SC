import ast
import os
from pathlib import Path
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch
import httpx

source = ast.parse(Path(__file__).resolve().parents[1].joinpath('main.py').read_text(encoding='utf-8-sig'))
node = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == 'configure_loopback_proxy_bypass')
namespace = {'os': os}
exec(compile(ast.Module(body=[node], type_ignores=[]), 'main.py', 'exec'), namespace)
configure = namespace['configure_loopback_proxy_bypass']

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(self.server.marker)
    def log_message(self, *args):
        pass

class ProxyBypassTests(unittest.TestCase):
    def test_preserves_exclusions_and_is_idempotent(self):
        with patch.dict(os.environ, {'NO_PROXY':'existing.invalid', 'HTTPS_PROXY':'http://proxy.invalid:1234'}, clear=True):
            configure()
            first = os.environ['NO_PROXY']
            configure()
            self.assertEqual(first, os.environ['NO_PROXY'])
            self.assertIn('existing.invalid', first)
            self.assertIn('::1', first)
            self.assertEqual(os.environ['HTTPS_PROXY'], 'http://proxy.invalid:1234')

    def test_local_direct_external_still_proxied(self):
        servers = []
        try:
            for marker in [b'direct', b'proxy']:
                s = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
                s.marker = marker
                threading.Thread(target=s.serve_forever, daemon=True).start()
                servers.append(s)
            local, proxy = servers
            with patch.dict(os.environ, {'HTTP_PROXY': f'http://127.0.0.1:{proxy.server_port}', 'NO_PROXY': '', 'no_proxy': ''}):
                configure()
                with httpx.Client(timeout=3) as client:
                    for host in ['localhost','127.0.0.1']:
                        self.assertEqual(client.get(f'http://{host}:{local.server_port}/').content, b'direct')
                    self.assertEqual(client.get('http://external.invalid/').content, b'proxy')
        finally:
            for s in servers:
                s.shutdown()
                s.server_close()

if __name__ == '__main__':
    unittest.main()
