import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main
from prompt_library_order import move


def fixture():
    return {'updated_at': 1, 'active_library_id': 'system',
            'installed_prompt_packs': [main.CURATED_PROMPT_PACK_ID], 'libraries': [
        {'id': 'system', 'name': '系统', 'categories': [{'id': 'view', 'name': '视角'}, {'id': 'other', 'name': '其他'}],
         'items': [{'id': key, 'name': key, 'positive': '正文' + key, 'category': 'view', 'params': {'size': '1024x1024'}} for key in ['a', 'hidden', 'b']]},
        {'id': 'target', 'name': '目标', 'categories': [{'id': 'dest', 'name': '目标组'}], 'items': []}]}


def operation(kind='item', id='a', **kwargs):
    return dict(kind=kind, id=id, source_library_id='system', target_library_id='system', position='before', **kwargs)


class MoveTests(unittest.TestCase):
    def test_order_uses_anchors_not_filtered_indices(self):
        data = fixture()
        out, _ = move(data, operation(id='b', anchor_id='a'))
        self.assertEqual([i['id'] for i in out['libraries'][0]['items']], ['b', 'a', 'hidden'])
        self.assertEqual([i['id'] for i in data['libraries'][0]['items']], ['a', 'hidden', 'b'])
        out, _ = move(out, {**operation(id='b', anchor_id='hidden'), 'position': 'after'})
        self.assertEqual([i['id'] for i in out['libraries'][0]['items']], ['a', 'hidden', 'b'])

    def test_library_and_group_order(self):
        out, _ = move(fixture(), operation('library', 'system', anchor_id='target') | {'position': 'after'})
        self.assertEqual([lib['id'] for lib in out['libraries']], ['target', 'system'])
        out, _ = move(fixture(), operation('category', 'other', anchor_id='view'))
        self.assertEqual([g['id'] for g in out['libraries'][0]['categories']], ['other', 'view'])

    def test_item_cross_group_and_library_keeps_stable_state(self):
        data, _ = move(fixture(), operation(target_category_id='other'))
        self.assertEqual(data['libraries'][0]['items'][-1]['category'], 'other')
        data, _ = move(data, operation(target_category_id='dest') | {'target_library_id': 'target'})
        item = data['libraries'][1]['items'][0]
        self.assertEqual(item['workbench_key'], '["system","a"]')
        self.assertEqual(item['positive'], '正文a')
        self.assertEqual(item['params'], {'size': '1024x1024'})
        data, _ = move(data, operation(target_category_id='view') | {'source_library_id': 'target'})
        self.assertEqual(data['libraries'][0]['items'][-1]['workbench_key'], '["system","a"]')

    def test_drop_on_library_creates_unclassified_once(self):
        data = fixture()
        for id in ['a', 'b']:
            data, _ = move(data, operation(id=id, target_category_id='') | {'target_library_id': 'target'})
        self.assertEqual(len(data['libraries'][1]['categories']), 2)
        self.assertEqual(len({i['category'] for i in data['libraries'][1]['items']}), 1)

    def test_group_moves_contents_and_resolves_id_collision(self):
        data = fixture()
        data['libraries'][1]['categories'].append({'id': 'view', 'name': '另一个视角'})
        out, selection = move(data, operation('category', 'view') | {'target_library_id': 'target'})
        self.assertNotEqual(selection['category_id'], 'view')
        self.assertEqual(len(out['libraries'][0]['items']), 0)
        self.assertEqual([i['id'] for i in out['libraries'][1]['items']], ['a', 'hidden', 'b'])
        self.assertTrue(all(i['category'] == selection['category_id'] for i in out['libraries'][1]['items']))

    def test_invalid_move_does_not_mutate(self):
        data = fixture()
        for op in [operation(anchor_id='missing'), operation(target_category_id='missing'),
                   operation() | {'target_library_id': 'missing'}, operation(kind='invalid')]:
            before = copy.deepcopy(data)
            with self.assertRaises(ValueError):
                move(data, op)
            self.assertEqual(data, before)
        data['libraries'][1]['items'].append(copy.deepcopy(data['libraries'][0]['items'][0]))
        with self.assertRaises(ValueError):
            move(data, operation(target_category_id='dest') | {'target_library_id': 'target'})


class PersistenceTests(unittest.IsolatedAsyncioTestCase):
    async def test_endpoint_persistence_conflict_and_builtin_group_move(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.multiple(main, DATA_DIR=directory, PROMPT_LIBRARY_PATH=str(Path(directory) / 'prompts.json')):
                data = main.save_prompt_libraries(fixture())
                request = main.PromptLibraryMoveRequest(**(operation('category', 'view') | {
                    'target_library_id': 'target', 'expected_updated_at': data['updated_at']}))
                response = await main.move_prompt_library_content(request)
                loaded = main.load_prompt_libraries()
                self.assertEqual(response['library']['libraries'], loaded['libraries'])
                self.assertEqual(loaded['libraries'][1]['categories'][-1]['id'], 'view')
                self.assertEqual(loaded['libraries'][1]['items'][0]['workbench_key'], '["system","a"]')
                with self.assertRaises(main.HTTPException) as error:
                    await main.move_prompt_library_content(request)
                self.assertEqual(error.exception.status_code, 409)
                self.assertEqual(main.load_prompt_libraries(), loaded)
                loaded['libraries'][0]['categories'] = []
                loaded['libraries'].reverse()
                main.save_prompt_libraries(loaded)
                self.assertEqual([lib['id'] for lib in main.load_prompt_libraries()['libraries']], ['target', 'system'])
                self.assertEqual(main.load_prompt_libraries()['libraries'][1]['categories'], [])
                # A separate process must see the exact saved order and stable state key.
                script = "import json,sys; d=json.load(open(sys.argv[1],encoding='utf-8')); assert [x['id'] for x in d['libraries']]==['target','system']; assert d['libraries'][1]['categories']==[]; assert d['libraries'][0]['items'][0]['workbench_key']=='[\"system\",\"a\"]'"
                subprocess.run([sys.executable, '-c', script, main.PROMPT_LIBRARY_PATH], check=True)


if __name__ == '__main__':
    unittest.main()
