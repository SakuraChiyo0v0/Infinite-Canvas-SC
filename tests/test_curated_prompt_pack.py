"""Bundled prompts install once without replacing user libraries or edits."""
import json
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


class CuratedPromptPackTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'prompt_libraries.json'
        self.paths = patch.multiple(main, DATA_DIR=self.temp.name, PROMPT_LIBRARY_PATH=str(self.path))
        self.paths.start()

    def tearDown(self):
        self.paths.stop()
        self.temp.cleanup()

    def pack(self, data):
        return next(lib for lib in data['libraries'] if lib['id'] == main.CURATED_PROMPT_PACK_ID)

    def test_fresh_install_content_is_complete_and_classified(self):
        data = main.load_prompt_libraries()
        pack = self.pack(data)
        self.assertEqual(len(pack['items']), 30)
        self.assertEqual(len({item['id'] for item in pack['items']}), 30)
        category_ids = {category['id'] for category in pack['categories']}
        self.assertEqual(len(category_ids), 6)
        self.assertEqual(Counter(item['category'] for item in pack['items']), dict.fromkeys(category_ids, 5))
        for item in pack['items']:
            self.assertGreater(len(item['positive']), 100)
            self.assertEqual(item['negative'], '')
            self.assertIn('https://', item['scene'])
            self.assertTrue(item['scene'].startswith(('生图；', '改图；')))
            self.assertLessEqual(len(item['scene']), 500)
            self.assertEqual(item['params'], {})
        self.assertEqual(data['active_library_id'], 'system')
        self.assertEqual(data, main.load_prompt_libraries())

    def test_existing_libraries_and_selection_are_unchanged(self):
        original = main.normalize_prompt_libraries({
            'active_library_id': 'my_library', 'updated_at': 10,
            'libraries': [
                {'id': 'system', 'name': '自定义系统名', 'categories': [{'id': 'view', 'name': '我的视角'}], 'items': []},
                {'id': 'my_library', 'name': '人设', 'categories': [{'id': 'style', 'name': '风格'}],
                 'items': [{'id': 'user1', 'name': '原有马克笔', 'category': 'style',
                            'positive': '原内容不能改', 'negative': '保留旧限制', 'scene': '我的备注',
                            'created_at': 1, 'updated_at': 2}]},
            ],
        })
        original.pop('installed_prompt_packs')  # Older on-disk format.
        self.path.write_text(json.dumps(original), encoding='utf-8')
        migrated = main.load_prompt_libraries()
        self.assertEqual(migrated['libraries'][:2], original['libraries'])
        self.assertEqual(migrated['active_library_id'], 'my_library')
        first_bytes = self.path.read_bytes()
        self.assertEqual(migrated, main.load_prompt_libraries())
        self.assertEqual(self.path.read_bytes(), first_bytes)

    async def test_edit_and_item_deletion_survive_reload(self):
        data = main.load_prompt_libraries()
        pack = self.pack(data)
        first, second = pack['items'][:2]
        await main.update_prompt_library_item(first['id'], main.PromptLibraryItemRequest(
            library_id=pack['id'], name='我改的名字', positive='我修改的完整正文',
            category=first['category'], scene='我修改的备注'))
        await main.delete_prompt_library_item(second['id'])
        reloaded = self.pack(main.load_prompt_libraries())
        edited = next(item for item in reloaded['items'] if item['id'] == first['id'])
        self.assertEqual(edited['positive'], '我修改的完整正文')
        self.assertEqual(edited['scene'], '我修改的备注')
        self.assertEqual(len(reloaded['items']), 29)
        self.assertNotIn(second['id'], [item['id'] for item in reloaded['items']])

    async def test_deleted_library_does_not_return(self):
        main.load_prompt_libraries()
        await main.delete_prompt_library(main.CURATED_PROMPT_PACK_ID)
        data = main.load_prompt_libraries()
        self.assertNotIn(main.CURATED_PROMPT_PACK_ID, [lib['id'] for lib in data['libraries']])
        self.assertIn(main.CURATED_PROMPT_PACK_ID, data['installed_prompt_packs'])
        self.assertEqual(main.save_prompt_libraries(data), main.load_prompt_libraries())

    def test_existing_pack_without_receipt_is_not_overwritten(self):
        data = main.load_prompt_libraries()
        pack = self.pack(data)
        pack['items'] = []
        pack['name'] = '已改名'
        data['installed_prompt_packs'] = []
        main.save_prompt_libraries(data)
        installed = main.load_prompt_libraries()
        self.assertEqual(self.pack(installed)['items'], [])
        self.assertEqual(self.pack(installed)['name'], '已改名')
        self.assertEqual(installed['installed_prompt_packs'], [main.CURATED_PROMPT_PACK_ID])

    def test_missing_pack_preserves_data_and_can_retry(self):
        with patch.object(main, 'CURATED_PROMPT_PACK_PATH', str(Path(self.temp.name) / 'missing.json')):
            data = main.load_prompt_libraries()
        self.assertEqual(data['installed_prompt_packs'], [])
        self.assertEqual(len(data['libraries']), 1)
        self.assertEqual(len(self.pack(main.load_prompt_libraries())['items']), 30)


if __name__ == '__main__':
    unittest.main()
