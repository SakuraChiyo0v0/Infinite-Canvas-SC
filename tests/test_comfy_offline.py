import ast
from pathlib import Path
import threading
import unittest
from unittest.mock import Mock
import urllib.request

source = ast.parse(Path(__file__).resolve().parents[1].joinpath('main.py').read_text(encoding='utf-8-sig'))
node = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == 'reserve_best_backend')

class ComfyOfflineTests(unittest.TestCase):
    def test_no_reservation_when_all_backends_are_offline(self):
        client = Mock()
        client.request.urlopen.side_effect = OSError('offline')
        load = {'127.0.0.1:8188': 0}
        namespace = {'List': list, 'COMFYUI_INSTANCES': list(load), 'urllib': client,
                     'BACKEND_LOCAL_LOAD': load, 'LOAD_LOCK': threading.Lock(), 'print': lambda *args: None}
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'main.py', 'exec'), namespace)
        with self.assertRaisesRegex(RuntimeError, '本地 ComfyUI 未连接'):
            namespace['reserve_best_backend']()
        self.assertEqual(load['127.0.0.1:8188'], 0)

if __name__ == '__main__':
    unittest.main()
