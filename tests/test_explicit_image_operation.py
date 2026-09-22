import base64
import glob
import os
import tempfile
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


DATA_URL_IMAGE = 'data:image/png;base64,' + base64.b64encode(b'fixture-image').decode('ascii')


class ExplicitImageOperationTests(unittest.IsolatedAsyncioTestCase):
    async def request(self, operation, refs=None, fail=False, model='ordinary-image', mode='openai'):
        calls = []
        provider = {'id': 'fixture', 'name': 'Fixture', 'base_url': 'https://fixture.invalid',
                    'protocol': 'openai', 'image_request_mode': mode, 'image_models': [model]}

        def respond(request):
            calls.append(request)
            if fail and len(calls) == 1:
                return httpx.Response(400, json={'error': {'message': 'Images API is not supported'}})
            return httpx.Response(200, json={'data': [{'url': 'https://fixture.invalid/output.png'}]})

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with tempfile.TemporaryDirectory() as folder:
            image = Path(folder) / 'input.png'
            image.write_bytes(b'fixture-image')
            with patch.object(main, 'get_api_provider', return_value=provider), \
                 patch.object(main, 'api_headers', return_value={}), \
                 patch.object(main, 'output_file_from_url', return_value=str(image)), \
                 patch.object(main, 'reference_to_data_url', return_value='data:image/png;base64,eA=='), \
                 patch.object(main.httpx, 'AsyncClient', return_value=client):
                try:
                    await main.generate_ai_image('test', '1024x1024', 'auto', model, refs,
                                                 'fixture', operation=operation)
                except (httpx.HTTPStatusError, main.HTTPException):
                    if not fail:
                        raise
        return calls

    async def test_generate_never_falls_back_to_edits(self):
        for model in ['ordinary-image', 'gpt-image-2']:
            for fail in [False, True]:
                calls = await self.request('generate', fail=fail, model=model)
                self.assertEqual([r.url.path for r in calls], ['/v1/images/generations'])
                self.assertIn('application/json', calls[0].headers['content-type'])

    async def test_edit_never_falls_back_to_generations(self):
        for model in ['ordinary-image', 'gpt-image-2']:
            for fail in [False, True]:
                calls = await self.request('edit', [{'url': '/input.png'}], fail, model)
                self.assertEqual([r.url.path for r in calls], ['/v1/images/edits'])
                self.assertIn('multipart/form-data', calls[0].headers['content-type'])
                self.assertIn(b'fixture-image', calls[0].content)

    async def test_legacy_auto_retains_fallback(self):
        calls = await self.request('', fail=True)
        self.assertEqual([r.url.path for r in calls], ['/v1/images/generations', '/v1/images/edits'])

    async def test_special_json_edit_keeps_adapter(self):
        calls = await self.request('edit', [{'url': '/input.png'}], mode='openai-json')
        self.assertEqual([r.url.path for r in calls], ['/v1/images/generations'])
        self.assertIn(b'extra_body', calls[0].content)
        self.assertIn(b'data:image/png', calls[0].content)

    async def test_edit_materializes_data_url_reference(self):
        """工具页提交的 data URL 参考图必须落成本地文件后以 multipart 上传，且临时文件要清理。"""
        calls = []
        provider = {'id': 'fixture', 'name': 'Fixture', 'base_url': 'https://fixture.invalid',
                    'protocol': 'openai', 'image_request_mode': 'openai', 'image_models': ['gpt-image-2']}

        def respond(request):
            calls.append(request)
            return httpx.Response(200, json={'data': [{'url': 'https://fixture.invalid/output.png'}]})

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        before = set(glob.glob(os.path.join(tempfile.gettempdir(), 'ref_*')))
        with patch.object(main, 'get_api_provider', return_value=provider), \
             patch.object(main, 'api_headers', return_value={}), \
             patch.object(main.httpx, 'AsyncClient', return_value=client):
            await main.generate_ai_image('test', '1024x1024', 'auto', 'gpt-image-2',
                                         [{'url': DATA_URL_IMAGE, 'kind': 'image'}], 'fixture', operation='edit')
        after = set(glob.glob(os.path.join(tempfile.gettempdir(), 'ref_*')))
        self.assertEqual([r.url.path for r in calls], ['/v1/images/edits'])
        self.assertIn('multipart/form-data', calls[0].headers['content-type'])
        self.assertIn(b'fixture-image', calls[0].content)
        self.assertEqual(after - before, set())

    async def test_edit_rejects_unreadable_reference(self):
        """参考图读不出来时必须直接报错，不能向上游发不带 image 的空请求。"""
        calls = []
        provider = {'id': 'fixture', 'name': 'Fixture', 'base_url': 'https://fixture.invalid',
                    'protocol': 'openai', 'image_request_mode': 'openai', 'image_models': ['gpt-image-2']}

        def respond(request):
            calls.append(request)
            return httpx.Response(200, json={'data': [{'url': 'https://fixture.invalid/output.png'}]})

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch.object(main, 'get_api_provider', return_value=provider), \
             patch.object(main, 'api_headers', return_value={}), \
             patch.object(main.httpx, 'AsyncClient', return_value=client):
            with self.assertRaises(main.HTTPException) as error:
                await main.generate_ai_image('test', '1024x1024', 'auto', 'gpt-image-2',
                                             [{'url': 'asset://missing', 'kind': 'image'}], 'fixture', operation='edit')
        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(calls, [])

    async def test_video_proxy_uploads_data_url_reference(self):
        """openai-video-proxy 模式的 data URL 参考图同样要作为文件上传。"""
        calls = []
        provider = {'id': 'fixture', 'name': 'Fixture', 'base_url': 'https://fixture.invalid',
                    'protocol': 'openai', 'image_request_mode': 'openai-video-proxy', 'image_models': ['gpt-image-2']}

        def respond(request):
            calls.append(request)
            return httpx.Response(200, json={'data': [{'url': 'https://fixture.invalid/output.png'}]})

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch.object(main, 'get_api_provider', return_value=provider), \
             patch.object(main, 'api_headers', return_value={}), \
             patch.object(main.httpx, 'AsyncClient', return_value=client):
            await main.generate_ai_image('test', '1024x1024', 'auto', 'gpt-image-2',
                                         [{'url': DATA_URL_IMAGE, 'kind': 'image'}], 'fixture', operation='edit')
        self.assertEqual([r.url.path for r in calls], ['/v1/videos'])
        self.assertIn(b'fixture-image', calls[0].content)

    async def test_runninghub_uploads_data_url_reference(self):
        """RunningHub 的参考图上传同样要接受 data URL，不能静默丢弃。"""
        calls = []
        provider = {'id': 'runninghub', 'name': 'RunningHub', 'base_url': 'https://fixture.invalid'}

        def respond(request):
            calls.append(request)
            return httpx.Response(200, json={'data': {'download_url': 'https://fixture.invalid/file.png'}})

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch.object(main, 'runninghub_api_key', return_value='test-key'):
            url = await main.runninghub_upload_reference(client, provider, {'url': DATA_URL_IMAGE})
        self.assertEqual(url, 'https://fixture.invalid/file.png')
        self.assertEqual(len(calls), 1)
        self.assertIn(b'fixture-image', calls[0].content)

    async def test_responses_keeps_data_url_reference(self):
        """RS(openai-responses) 模式下 data URL 参考图要落盘后再内联，不能整张丢掉。"""
        calls = []
        provider = {'id': 'fixture', 'name': 'Fixture', 'base_url': 'https://fixture.invalid',
                    'protocol': 'openai', 'image_request_mode': 'openai-responses', 'image_models': ['gpt-image-2']}

        def respond(request):
            calls.append(request)
            return httpx.Response(200, json={'data': [{'url': 'https://fixture.invalid/output.png'}]})

        client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with patch.object(main, 'get_api_provider', return_value=provider), \
             patch.object(main, 'api_headers', return_value={}), \
             patch.object(main.httpx, 'AsyncClient', return_value=client), \
             patch.object(main, 'upload_local_video_to_cloud',
                          side_effect=main.HTTPException(status_code=502, detail='图床不可用')):
            try:
                await main.generate_ai_image('test', '1024x1024', 'auto', 'gpt-image-2',
                                             [{'url': DATA_URL_IMAGE, 'kind': 'image'}], 'fixture', operation='edit')
            except main.HTTPException:
                pass
        self.assertEqual([r.url.path for r in calls], ['/v1/responses'])
        self.assertIn(b'data:image/', calls[0].content)
        self.assertIn(b'base64', calls[0].content)

    async def test_invalid_inputs_rejected_before_generation(self):
        with patch.object(main, 'get_api_provider', return_value={'id': 'fixture'}), \
             patch.object(main, 'generate_ai_image', new_callable=AsyncMock) as generate:
            for operation, refs in [('generate', [{'url': '/input.png'}]), ('edit', []), ('invalid', [])]:
                payload = main.OnlineImageRequest(prompt='test', operation=operation, reference_images=refs)
                with self.assertRaises(main.HTTPException) as error:
                    await main.build_online_image_result(payload)
                self.assertEqual(error.exception.status_code, 400)
            generate.assert_not_awaited()

    async def test_operation_forwarded_and_saved(self):
        provider = {'id': 'fixture', 'name': 'Fixture', 'image_models': ['fixture-model']}
        with patch.object(main, 'get_api_provider', return_value=provider), \
             patch.object(main, 'generate_ai_image', new_callable=AsyncMock,
                          return_value=('image', {})) as generate, \
             patch.object(main, 'save_ai_image_to_output', new_callable=AsyncMock,
                          return_value='/output/test.png'), \
             patch.object(main, 'save_to_history') as history, \
             patch.object(main, 'GLOBAL_LOOP', None):
            for operation, refs in [('generate', []), ('edit', [{'url': '/input.png'}])]:
                payload = main.OnlineImageRequest(prompt='test', operation=operation, reference_images=refs)
                await main.build_online_image_result(payload)
                self.assertEqual(generate.await_args.kwargs['operation'], operation)
                self.assertEqual(history.call_args.args[0]['params']['operation'], operation)


if __name__ == '__main__':
    unittest.main()
