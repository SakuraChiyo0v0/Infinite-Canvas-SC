import ast
from pathlib import Path
import re
import unittest

source = ast.parse(Path(__file__).resolve().parents[1].joinpath('main.py').read_text(encoding='utf-8-sig'))
node = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == 'web_image_aspect_prompt')
namespace = {'re': re}
exec(compile(ast.Module(body=[node], type_ignores=[]), 'main.py', 'exec'), namespace)
prompt_for = namespace['web_image_aspect_prompt']

class WebImageAspectTests(unittest.TestCase):
    def test_standard_api_prompt_is_untouched(self):
        self.assertEqual(prompt_for('original', 'gpt-image-2', '688x1024'), 'original')

    def test_snapped_portrait_becomes_composition_not_pixel_promise(self):
        result = prompt_for('original', 'ChatGPT 网页版/gpt-image-2.5', '688x1024')
        self.assertTrue(result.startswith('original\n\n'))
        self.assertIn('2:3 aspect ratio', result)
        self.assertNotIn('688', result)

    def test_explicit_ratio_wins(self):
        self.assertIn('9:16 aspect ratio', prompt_for('original', 'chatgpt-web/gpt-image-2', '1024x1024', '9:16'))

    def test_auto_and_invalid_size_are_untouched(self):
        for size in ['auto', '0x0', '-1x3', '']:
            self.assertEqual(prompt_for('original', 'ChatGPT 网页版/gpt-image-2', size), 'original')

if __name__ == '__main__':
    unittest.main()
