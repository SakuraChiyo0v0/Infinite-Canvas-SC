"""Offline provenance contracts; extract handlers without importing main or starting services."""
import ast
import asyncio
import json
import os
from pathlib import Path
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import creation_provenance as provenance

ROOT = Path(__file__).resolve().parents[1]
MAIN = ast.parse((ROOT / "main.py").read_text(encoding="utf-8"))
ROLE = {"id": "role-a", "name": "角色 A", "description": "围巾", "references": [{"url": "/assets/role.png"}]}
CONTEXT = {"resultId": "parent", "character": ROLE, "source": {"libraryId": "lib", "itemId": "template", "name": "模板"}}


class HttpError(Exception):
    def __init__(self, status_code, detail):
        self.status_code, self.detail = status_code, detail


def handler(name, namespace):
    node = next(item for item in MAIN.body if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)) and item.name == name)
    node = ast.parse(ast.unparse(node)).body[0]
    node.decorator_list = []
    for arg in node.args.args:
        arg.annotation = None
    node.returns = None
    exec(compile(ast.fix_missing_locations(ast.Module(body=[node], type_ignores=[])), str(ROOT / "main.py"), "exec"), namespace)
    return namespace[name]


class ProvenanceTests(unittest.TestCase):
    def test_whitelist_drops_credentials_and_configuration_at_every_level(self):
        value = {**CONTEXT, "api_key": "secret", "settings": {"token": "secret"},
                 "character": {**ROLE, "api_key": "secret"}, "source": {"name": "template", "token": "secret"},
                 "references": [{"url": "https://example.test/a.png?token=secret&width=40", "api_key": "secret"},
                                {"url": "https://user:pass@example.test/a.png"}, {"url": "file:///C:/secret.png"}]}
        clean = provenance.sanitize_provenance(value)
        serialized = json.dumps(clean)
        self.assertNotIn("secret", serialized)
        self.assertNotIn("api_key", serialized)
        self.assertEqual(clean["character"]["id"], "role-a")
        self.assertEqual(clean["references"], [{"url": "https://example.test/a.png?width=40", "name": "", "kind": "image"}])
        self.assertIsNone(provenance.sanitize_provenance(None))

    def test_actual_request_overrides_claimed_parameters(self):
        result = provenance.generated_provenance({**CONTEXT, "model": "wrong", "prompt": "wrong"}, result_id="new",
                prompt="actual", provider="actual-provider", model="actual-model", size="1024x1536", quality="high",
                n=2, references=[{"url": "/assets/input.png"}], created_at=123, operation="edit")
        self.assertEqual(result["parentResultId"], "parent")
        self.assertEqual(result["model"], "actual-model")
        self.assertEqual(result["prompt"], "actual")
        self.assertEqual(result["character"]["id"], "role-a")
        self.assertEqual(result["resultId"], "new")

    def test_bounded_untrusted_context(self):
        clean = provenance.sanitize_provenance({"prompt": "x" * 100000, "n": float("inf"), "createdAt": "bad",
                                             "references": [{"url": "/assets/a.png"}] * 1000})
        self.assertEqual(len(clean["prompt"]), 65536)
        self.assertEqual(len(clean["references"]), 40)
        self.assertNotIn("n", clean)
        self.assertNotIn("createdAt", clean)

    def test_local_history_preserves_comfy_params_and_actual_output_size(self):
        params = {"278": {"image": "original.png"}, "152": {"width": 900}}
        result = {"params": params, "items": [{"url": "/output/result.png", "kind": "image", "natural_w": 1536, "natural_h": 1024}],
                  "prompt": "本次要求", "workflow_json": "Flux2-Klein.json", "prompt_id": "job", "timestamp": 42}
        value = provenance.annotate_local_result(result, CONTEXT, [{"url": "/api/view?filename=original.png&type=input"}], 900, 900)
        self.assertIs(value["params"], params)
        self.assertEqual(value["provenance"]["character"]["id"], "role-a")
        self.assertEqual(value["provenance"]["size"], "1536x1024")
        self.assertEqual(value["provenance"]["references"][0]["url"], "/api/view?filename=original.png&type=input")
        self.assertEqual(value["image_items"][0]["provenance"]["parentResultId"], "parent")

    def test_optional_fields_are_present_in_both_request_types_and_asset_inputs(self):
        for name in ("GenerateRequest", "OnlineImageRequest", "AssetLibraryAddRequest", "LocalAssetUrlImportItem"):
            node = next(item for item in MAIN.body if isinstance(item, ast.ClassDef) and item.name == name)
            field = next(item for item in node.body if isinstance(item, ast.AnnAssign) and item.target.id == "provenance")
            self.assertIsNone(field.value.value)
        generate = next(item for item in MAIN.body if isinstance(item, ast.FunctionDef) and item.name == "generate")
        self.assertTrue(any(isinstance(item, ast.Call) and isinstance(item.func, ast.Name) and item.func.id == "annotate_local_result" for item in ast.walk(generate)))

    def test_local_media_white_list_and_resolved_roots(self):
        with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as outside:
            image = Path(root) / "image.png"
            image.write_bytes(b"fixture")
            other = Path(outside) / "image.png"
            other.write_bytes(b"outside")
            resolve = lambda _: str(image)
            self.assertEqual(provenance.local_media_source("/assets/image.png", resolve, [root]), str(image.resolve()))
            self.assertEqual(provenance.local_media_source("/api/storage-files/local/image.png", resolve, [root]), str(image.resolve()))
            for url in ("/assets/../secret.png", "/assets/%2e%2e/secret.png", "/assets/C:/secret.png",
                        "/assets/%5csecret.png", "file:///C:/secret.png", "//server/share.png", "/api/storage-files/private/file.png"):
                self.assertIsNone(provenance.local_media_source(url, resolve, [root]), url)
            self.assertIsNone(provenance.local_media_source("/assets/image.png", lambda _: str(other), [root]))
            document = Path(root) / "secret.json"
            document.write_text("{}")
            self.assertIsNone(provenance.local_media_source("/assets/secret.json", lambda _: str(document), [root]))


class HandlerTests(unittest.IsolatedAsyncioTestCase):
    async def test_generation_history_and_each_output_preserve_sanitized_identity(self):
        history = []
        async def generate(*_args, **_kwargs):
            return "image-bytes", {"data": "fixture"}
        async def save(*_args, **_kwargs):
            return "/output/test.png"
        env = {"get_api_provider": lambda _: {"id": "p", "image_models": ["m"]}, "IMAGE_MODEL": "m",
               "selected_model": lambda a, b: a or b, "snap_size_to_multiple": lambda size, _: size,
               "image_references": lambda refs: refs, "generate_ai_image": generate, "extract_images": lambda _: ["fixture"],
               "save_ai_image_to_output": save, "image_output_meta": lambda url, _: {"url": url},
               "HTTPException": HttpError, "asyncio": asyncio, "time": time, "uuid": uuid, "json": json,
               "httpx": SimpleNamespace(HTTPStatusError=type("StatusError", (Exception,), {}), HTTPError=type("NetworkError", (Exception,), {})),
               "extract_task_id": lambda _: "upstream", "save_to_history": history.append, "GLOBAL_LOOP": None,
               "sanitize_provenance": provenance.sanitize_provenance, "generated_provenance": provenance.generated_provenance}
        build = handler("build_online_image_result", env)
        payload = SimpleNamespace(provider_id="p", model="m", size="1024x1536", n=2, operation="generate", reference_images=[],
                    prompt="test", quality="high", aspect_ratio="", resolution="", history_type="online", provenance={**CONTEXT, "token": "secret"})
        result = await build(payload)
        self.assertEqual(len(history), 1)
        self.assertEqual(len(result["image_items"]), 2)
        ids = {item["provenance"]["resultId"] for item in result["image_items"]}
        self.assertEqual(len(ids), 2)
        self.assertEqual(result["provenance"]["character"]["id"], "role-a")
        self.assertEqual(result["params"]["provenance"]["source"]["itemId"], "template")
        self.assertNotIn("secret", json.dumps(result))
        payload.provenance = None
        legacy = await build(payload)
        self.assertNotIn("character", legacy["provenance"])

    async def test_asset_single_and_batch_handlers_keep_context_without_extra_fields(self):
        category = {"type": "image", "items": []}
        async def classify(*_):
            return None
        env = {"load_asset_library": lambda: {}, "find_asset_category_in_library": lambda *_: category,
               "output_file_from_url": lambda _: "/tmp/fixture.png", "make_asset_library_item": lambda *_, **__: ("", {"kind": "image", "url": "/assets/saved.png"}),
               "classify_asset_image_best_effort": classify, "save_asset_library": lambda _: None,
               "sanitize_provenance": provenance.sanitize_provenance, "os": os, "HTTPException": HttpError}
        add = handler("add_asset_library_item", env)
        batch = handler("batch_add_asset_library_items", env)
        item = SimpleNamespace(url="/output/result.png", name="result", category_id="cat", library_id="lib", provenance={**CONTEXT, "settings": {"api_key": "secret"}})
        result = await add(item)
        self.assertEqual(result["item"]["provenance"]["character"]["id"], "role-a")
        self.assertNotIn("settings", result["item"]["provenance"])
        result = await batch(SimpleNamespace(items=[item], category_id="cat", library_id="lib"))
        self.assertEqual(result["items"][0]["provenance"]["source"]["itemId"], "template")

    async def test_local_rename_move_delete_follow_only_the_dedicated_sidecar(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            def path(value):
                target = (root / value).resolve()
                if not target.is_relative_to(root.resolve()):
                    raise HttpError(400, "bad path")
                return value, str(target)
            image = root / "old.png"
            image.write_bytes(b"fixture")
            caption = root / "old.txt"
            classification = root / "old.classification.json"
            caption.write_text("caption"); classification.write_text('{"category":"kept"}')
            provenance.write_provenance(image, CONTEXT)
            env = {"ensure_same_origin_request": lambda _: None, "_local_upload_safe_path": path,
                   "_local_upload_abs": path, "_local_upload_safe_folder": path,
                   "_local_upload_kind_ext": lambda rel, _: ("image", ".png"), "_local_upload_safe_file_stem": lambda name: name,
                   "_local_upload_caption_path": lambda rel: str(root / Path(rel).with_suffix(".txt")),
                   "_local_upload_classification_path": lambda rel: str(root / Path(rel).with_suffix(".classification.json")),
                   "_local_upload_tree_and_items": lambda: ({}, []), "_local_upload_item": lambda rel: {"file": rel},
                   "provenance_path": provenance.provenance_path, "move_provenance": provenance.move_provenance,
                   "delete_provenance": provenance.delete_provenance, "os": os, "uuid": uuid, "HTTPException": HttpError}
            rename = handler("rename_local_asset_item", env)
            move = handler("move_local_assets", env)
            delete = handler("delete_local_assets", env)
            await rename(SimpleNamespace(path="old.png", name="renamed"), None)
            self.assertEqual(provenance.read_provenance(root / "renamed.png")["character"]["id"], "role-a")
            self.assertFalse(Path(provenance.provenance_path(image)).exists())
            (root / "sub").mkdir()
            await move({"names": ["renamed.png"], "folder": "sub"}, None)
            moved = root / "sub/renamed.png"
            self.assertEqual(provenance.read_provenance(moved)["source"]["itemId"], "template")
            self.assertEqual((root / "sub/renamed.txt").read_text(), "caption")
            self.assertEqual(json.loads((root / "sub/renamed.classification.json").read_text()), {"category": "kept"})
            await delete({"names": ["sub/renamed.png"]}, None)
            self.assertFalse(moved.exists())
            self.assertFalse(Path(provenance.provenance_path(moved)).exists())


if __name__ == "__main__":
    unittest.main()
