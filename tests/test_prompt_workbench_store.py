import json
import os
import tempfile
import unittest
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from prompt_workbench_store import read_state, write_record, StateConflict


class WorkbenchStoreTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = os.path.join(self.directory.name, 'state.json')

    def test_roundtrip_and_conflict(self):
        value = {'text': '{{角色}}', 'values': {'角色': '猫'}, 'references': [{'url': '/assets/a.png'}], 'pending': {'taskId': 'job'}}
        write_record(self.path, 'drafts', 'a', value, 0)
        self.assertEqual(read_state(self.path)['drafts']['a']['value'], value)
        with self.assertRaises(StateConflict):
            write_record(self.path, 'drafts', 'a', {'text': 'stale'}, 0)
        self.assertEqual(read_state(self.path)['drafts']['a']['value'], value)

    def test_concurrent_records_and_tombstone(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda n: write_record(self.path, 'recipes', str(n), {'name': str(n)}, 0), range(20)))
        self.assertEqual(len(read_state(self.path)['recipes']), 20)
        write_record(self.path, 'recipes', '0', None, 1)
        with self.assertRaises(StateConflict):
            write_record(self.path, 'recipes', '0', {'name': 'revive'}, 1)

    def test_corrupt_file_not_overwritten(self):
        with open(self.path, 'w') as stream:
            stream.write('broken')
        with self.assertRaises(ValueError):
            write_record(self.path, 'covers', 'a', {'url': '/assets/a.png'}, 0)
        with open(self.path) as stream:
            self.assertEqual(stream.read(), 'broken')

    def test_validation(self):
        with self.assertRaises(ValueError):
            write_record(self.path, '../outside', 'a', {}, 0)
        with self.assertRaises(ValueError):
            write_record(self.path, 'drafts', 'a', {'text': 'x' * 2_000_001}, 0)


if __name__ == '__main__':
    unittest.main()
