import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI
from fastapi.testclient import TestClient
import character_library


class CharacterLibraryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'characters.json'
        self.image = Path(self.temp.name) / 'ref.png'
        self.image.write_bytes(b'fixture')
        app = FastAPI()
        app.include_router(character_library.router(lambda: str(self.path), lambda url: str(self.image) if url == '/assets/ref.png' else None))
        self.client = TestClient(app)
        self.profile = {'name': '测试角色', 'description': '固定角色背景', 'references': [{'url': '/assets/ref.png'}]}

    def tearDown(self):
        self.temp.cleanup()

    def test_create_edit_conflict_archive_restore(self):
        self.assertEqual(self.client.get('/api/characters').json()['characters'], [])
        created = self.client.post('/api/characters', json=self.profile).json()['character']
        self.assertEqual(created['cover'], '/assets/ref.png')
        route = '/api/characters/' + created['id']
        updated = self.client.put(route, json={**created, 'name': '新名称'}).json()['character']
        self.assertEqual(updated['revision'], 2)
        self.assertEqual(self.client.put(route, json=created).status_code, 409)
        archived = self.client.put(route, json={**updated, 'archived': True}).json()['character']
        self.assertEqual(self.client.get('/api/characters').json()['characters'], [])
        self.assertEqual(self.client.get('/api/characters?include_archived=true').json()['characters'][0]['name'], '新名称')
        self.assertTrue(self.image.exists(), 'archiving must not remove shared reference images')
        self.client.put(route, json={**archived, 'archived': False})
        self.assertEqual(character_library.read(self.path)['characters'][0]['name'], '新名称')

    def test_reject_invalid_references_and_empty_profile(self):
        for url in ['https://example.com/a.png', '/assets/../private.png', '/assets/missing.png', '/assets/ref.png?x=1']:
            response = self.client.post('/api/characters', json={**self.profile, 'references': [{'url': url}]})
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.post('/api/characters', json={**self.profile, 'references': []}).status_code, 422)
        self.assertEqual(self.client.post('/api/characters', json={**self.profile, 'name': '  '}).status_code, 400)
        self.assertEqual(self.client.post('/api/characters', json={**self.profile, 'cover': '/assets/other.png'}).status_code, 400)

    def test_corrupt_file_is_not_overwritten(self):
        self.path.write_text('{broken', encoding='utf-8')
        with self.assertRaises(json.JSONDecodeError):
            self.client.post('/api/characters', json=self.profile)
        self.assertEqual(self.path.read_text(), '{broken')


if __name__ == '__main__':
    unittest.main()
