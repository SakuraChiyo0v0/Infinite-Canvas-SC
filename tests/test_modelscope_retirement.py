import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main
from fastapi.testclient import TestClient


class ModelScopeRetirementTests(unittest.TestCase):
    def test_legacy_config_filtered_without_rewriting_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'providers.json'
            raw = json.dumps([
                {'id': 'modelscope', 'name': 'legacy', 'image_models': ['old']},
                {'id': 'custom', 'name': 'Custom', 'base_url': 'http://localhost:9', 'image_models': ['same']},
            ])
            path.write_text(raw, encoding='utf-8')
            with patch.object(main, 'API_PROVIDERS_FILE', str(path)):
                self.assertNotIn('modelscope', [p['id'] for p in main.load_api_providers()])
                self.assertIn('custom', [p['id'] for p in main.load_api_providers()])
            self.assertEqual(path.read_text(encoding='utf-8'), raw)

    def test_legacy_id_never_falls_back(self):
        with patch.object(main, 'load_api_providers', return_value=[{'id': 'other', 'enabled': True}]):
            for resolver in [main.get_api_provider, main.get_api_provider_exact]:
                with self.assertRaises(main.HTTPException) as error:
                    resolver('modelscope')
                self.assertEqual(error.exception.status_code, 410)
            with self.assertRaises(main.HTTPException) as error:
                main.resolve_chat_provider('modelscope', 'old', '')
            self.assertEqual(error.exception.status_code, 410)

    def test_removed_routes_and_shared_routes(self):
        # OpenAPI includes nested routers without depending on FastAPI's internal route wrappers.
        routes = set(main.app.openapi()['paths'])
        for path in ['/generate', '/api/ms/generate', '/api/angle/generate', '/api/angle/poll_status', '/api/config/token']:
            self.assertNotIn(path, routes)
        for path in ['/api/generate', '/api/online-image', '/api/canvas-comfy-tasks', '/api/check-update']:
            self.assertIn(path, routes)

    def test_reject_legacy_save_before_any_write(self):
        client = TestClient(main.app)
        with patch.object(main, 'save_api_providers') as save, patch.object(main, 'update_env_values') as env:
            response = client.put('/api/providers', json=[{'id':'modelscope', 'name':'legacy'}])
            self.assertEqual(response.status_code, 410)
            save.assert_not_called()
            env.assert_not_called()

    def test_other_provider_generation_preserves_selected_model_and_history(self):
        client = TestClient(main.app)
        provider = {'id':'custom', 'name':'Custom', 'image_models':['first','second'], 'enabled':True}
        generator = AsyncMock(return_value=({'url':'/fixture.png'}, {}))
        with patch.object(main, 'load_api_providers', return_value=[provider]), \
             patch.object(main, 'generate_ai_image', generator), \
             patch.object(main, 'save_ai_image_to_output', AsyncMock(return_value='/assets/test.png')), \
             patch.object(main, 'save_to_history') as history:
            response = client.post('/api/online-image', json={
                'prompt':'test', 'provider_id':'custom', 'model':'second',
                'size':'1024x1024', 'n':2, 'history_type':'zimage',
            })
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()['model'], 'second')
            self.assertEqual(response.json()['provider_id'], 'custom')
            self.assertEqual(len(response.json()['images']), 2)
            self.assertEqual(history.call_args.args[0]['type'], 'zimage')
            self.assertEqual(generator.await_count, 2)
            self.assertEqual(generator.await_args.args[3], 'second')
            self.assertEqual(generator.await_args.args[5], 'custom')
            retired = client.post('/api/online-image', json={'prompt':'test', 'provider_id':'modelscope'})
            self.assertEqual(retired.status_code, 410)
            self.assertEqual(generator.await_count, 2)


if __name__ == '__main__':
    unittest.main()
