"""Current canvas persistence contract; log editing never deletes image files.

Replaces tests for the removed delete_canvas_log API. All files belong to a
temporary directory; no user canvas or image is modified by this suite.
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, AsyncMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


class CanvasPersistenceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.canvas_path = self.root / 'test.json'
        self.image = self.root / 'result.png'
        self.image.write_bytes(b'keep this output')
        self.reference = self.root / 'reference.png'
        self.reference.write_bytes(b'keep this input')
        self.data = {
            'id': 'test', 'title': 'Test', 'kind': 'smart', 'updated_at': 200,
            'nodes': [{'id':'source','type':'smart-image','images':[{'url':str(self.reference)}]},
                      {'id':'result','type':'smart-image','images':[{'url':str(self.image)}],
                       'promptDraftText':'keep prompt', 'runSettings':{'model':'test-model'}}],
            'connections': [{'from':'source','to':'result'}],
            'logs': [{'id':'log-1','outputs':[str(self.image)]}],
            'viewport': {'x':1,'y':2,'scale':1}, 'settings': {'engine':'api'},
        }
        self.canvas_path.write_text(json.dumps(self.data), encoding='utf-8')
        self.paths = patch.object(main, 'CANVAS_DIR', str(self.root))
        self.broadcast = patch.object(main.manager, 'broadcast_canvas_updated', new_callable=AsyncMock)
        self.paths.start()
        self.broadcast.start()

    def tearDown(self):
        self.broadcast.stop()
        self.paths.stop()
        self.temp.cleanup()

    def payload(self, **overrides):
        values = {key:self.data[key] for key in ('title','nodes','connections','logs','viewport','settings')}
        values['base_updated_at'] = 200
        values.update(overrides)
        return main.CanvasSaveRequest(**values)

    async def test_save_preserves_prompt_settings_refs_and_logs(self):
        result = (await main.update_canvas('test', self.payload()))['canvas']
        for key in ('nodes','connections','logs','viewport','settings'):
            self.assertEqual(result[key], self.data[key])
        self.assertEqual(main.load_canvas('test'), result)

    async def test_removing_log_does_not_delete_media_or_result_node(self):
        result = (await main.update_canvas('test', self.payload(logs=[])))['canvas']
        self.assertEqual(result['logs'], [])
        self.assertEqual(result['nodes'], self.data['nodes'])
        self.assertTrue(self.image.exists())
        self.assertTrue(self.reference.exists())

    async def test_stale_save_does_not_change_disk_or_media(self):
        before = self.canvas_path.read_bytes()
        with self.assertRaises(main.HTTPException) as caught:
            await main.update_canvas('test', self.payload(base_updated_at=100, nodes=[], logs=[]))
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(before, self.canvas_path.read_bytes())
        self.assertTrue(self.image.exists())

    async def test_version_advances_even_if_clock_is_unchanged_or_backward(self):
        for clock in (200, 100):
            current = main.load_canvas('test')['updated_at']
            with patch.object(main, 'now_ms', return_value=clock):
                result = (await main.update_canvas('test', self.payload(base_updated_at=current)))['canvas']
            self.assertEqual(result['updated_at'], current + 1)

    async def test_same_millisecond_second_editor_is_rejected(self):
        with patch.object(main, 'now_ms', return_value=200):
            await main.update_canvas('test', self.payload(title='first editor'))
            with self.assertRaises(main.HTTPException) as caught:
                await main.update_canvas('test', self.payload(title='stale editor'))
        self.assertEqual(caught.exception.status_code,409)
        self.assertEqual(main.load_canvas('test')['title'],'first editor')

    async def test_trash_restore_preserves_nodes_logs_and_files(self):
        await main.delete_canvas('test')
        with self.assertRaises(main.HTTPException):
            main.load_canvas('test')
        result = (await main.restore_canvas('test'))['canvas']
        self.assertNotIn('deleted_at',result)
        for key in ('nodes','logs','connections'):
            self.assertEqual(result[key],self.data[key])
        self.assertTrue(self.image.exists())
        self.assertTrue(self.reference.exists())

if __name__ == '__main__':
    unittest.main()
