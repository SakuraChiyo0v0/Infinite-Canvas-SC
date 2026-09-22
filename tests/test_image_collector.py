import concurrent.futures
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
import image_collector


class ImageCollectorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / 'original.png'
        Image.new('RGB', (8, 8), 'red').save(self.source)
        self.original = self.source.read_bytes()
        app = FastAPI()
        app.include_router(image_collector.router(
            lambda url: str(self.source) if url == '/assets/test.png' else None,
            lambda url: (self.original, 'image/png')))
        self.client = TestClient(app)
        self.payload = {'url':'/assets/test.png', 'folder':str(self.root / 'collected'),
                        'prefix':'角色', 'batch':'20260922', 'sequence':1, 'entry_id':'one'}

    def tearDown(self):
        self.temp.cleanup()

    def save(self, **changes):
        return self.client.post('/api/smart-canvas/collector-save', json={**self.payload, **changes})

    def test_save_original_bytes_and_idempotent_retry(self):
        first = self.save().json()
        self.assertEqual(Path(first['path']).read_bytes(), self.original)
        self.assertEqual(self.source.read_bytes(), self.original)
        again = self.save().json()
        self.assertEqual(first['path'], again['path'])
        self.assertTrue(again['reused'])
        self.assertEqual(len(list((self.root / 'collected').iterdir())), 1)

    def test_concurrent_results_and_duplicate_requests(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda i: self.save(entry_id=f'image-{i % 4}').json(), range(16)))
        self.assertEqual(len({r['path'] for r in results}), 4)
        self.assertTrue(all(Path(r['path']).read_bytes() == self.original for r in results))

    def test_existing_file_is_never_overwritten(self):
        first = self.save().json()
        Path(first['path']).write_bytes(b'keep me')
        second = self.save().json()
        self.assertNotEqual(first['path'], second['path'])
        self.assertEqual(Path(first['path']).read_bytes(), b'keep me')
        self.assertEqual(self.save().json()['path'], second['path'])

    def test_filename_cannot_escape_directory(self):
        data = self.save(prefix='../bad\\prefix:', batch='../../batch').json()
        self.assertEqual(Path(data['path']).parent, self.root / 'collected')

    def test_bad_folder_then_retry_without_generation(self):
        self.assertEqual(self.save(folder='relative/path').status_code, 400)
        self.assertEqual(self.save(folder=str(self.source)).status_code, 400)
        self.assertEqual(self.save().status_code, 200)

    def test_reject_missing_and_non_image(self):
        self.assertEqual(self.save(url='/assets/missing.png').status_code, 404)
        self.source.write_bytes(b'not an image')
        self.assertEqual(self.save().status_code, 400)
        self.assertFalse((self.root / 'collected').exists())

    def test_remote_image_and_true_extension(self):
        data = self.save(url='https://example.test/output.jpg').json()
        self.assertTrue(data['path'].endswith('.png'))
        self.assertEqual(Path(data['path']).read_bytes(), self.original)


if __name__ == '__main__':
    unittest.main()
