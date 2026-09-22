"""Bounded optional creation context and dedicated local sidecars. No service dependencies."""
import math
import json
import os
import tempfile
from pathlib import Path
from urllib.parse import unquote
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode


def _text(value, limit=512):
    return value[:limit] if isinstance(value, str) else ""


def _url(value):
    value = _text(value, 4096)
    parsed = urlsplit(value)
    if parsed.username or parsed.password:
        return ""
    if not (value.startswith(("/assets/", "/output/", "/api/storage-files/", "/api/view?"))
            or parsed.scheme in ("http", "https") and parsed.netloc):
        return ""
    secret_keys = {"token", "access_token", "api_key", "apikey", "password", "authorization", "secret"}
    query = urlencode([(key, val) for key, val in parse_qsl(parsed.query, keep_blank_values=True)
                       if key.lower() not in secret_keys])
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, ""))


def _references(value, limit=40):
    if not isinstance(value, list):
        return []
    result = []
    for item in value[:limit]:
        if not isinstance(item, dict):
            continue
        try:
            url = _url(item.get("url"))
        except ValueError:
            continue
        if url:
            result.append({"url": url, "name": _text(item.get("name")), "kind": "image"})
    return result


def sanitize_provenance(value):
    if not isinstance(value, dict) or not value:
        return None
    result = {"version": 1}
    for key in ("resultId", "parentResultId", "model", "provider", "size", "quality", "operation", "instruction"):
        if isinstance(value.get(key), str):
            result[key] = _text(value[key], 4096 if key == "instruction" else 512)
    if isinstance(value.get("prompt"), str):
        result["prompt"] = _text(value["prompt"], 65536)
    for key in ("createdAt", "n"):
        number = value.get(key)
        if isinstance(number, (int, float)) and not isinstance(number, bool) and math.isfinite(number):
            result[key] = max(0, min(number, 1e15 if key == "createdAt" else 100))
    result["references"] = _references(value.get("references"))
    source = value.get("source")
    if isinstance(source, dict):
        result["source"] = {key: _text(source[key]) for key in ("libraryId", "itemId", "name", "canvasId", "nodeId")
                            if isinstance(source.get(key), str)}
    character = value.get("character")
    if isinstance(character, dict) and _text(character.get("id")):
        result["character"] = {"id": _text(character["id"], 128), "name": _text(character.get("name")),
                               "description": _text(character.get("description"), 16000),
                               "references": _references(character.get("references"), 8)}
    return result


def generated_provenance(value, *, result_id, prompt, provider, model, size, quality, n, references, created_at, operation=''):
    """Input context supplies identity only; actual request supplies execution facts."""
    parent = sanitize_provenance(value) or {}
    actual = {**parent, "resultId": result_id,
              "parentResultId": parent.get("parentResultId") or parent.get("resultId") or "",
              "prompt": prompt, "provider": provider, "model": model, "size": size,
              "quality": quality, "n": n, "references": references,
              "operation": operation or ("edit" if references else "generate"), "createdAt": created_at}
    return sanitize_provenance(actual)


def annotate_local_result(result, value, references, width=1024, height=1024):
    """Keep the legacy Comfy params map intact; attach context to actual image results."""
    context = sanitize_provenance(value)
    result["input_provenance"] = context
    images = [item for item in result.get("items", []) if item.get("kind") == "image" and item.get("url")]
    for index, item in enumerate(images):
        w, h = item.get("natural_w") or width, item.get("natural_h") or height
        item["provenance"] = generated_provenance(context,
            result_id=f"local:{result.get('prompt_id', result.get('timestamp'))}:{index}",
            prompt=result.get("prompt", ""), provider="local-comfy", model=result.get("workflow_json", ""),
            size=f"{w}x{h}", quality="", n=len(images), references=references,
            created_at=(result.get("timestamp") or 0) * 1000)
    result["image_items"] = images
    result["provenance"] = images[0]["provenance"] if images else None
    return result


def provenance_path(media_path):
    return str(media_path) + ".provenance.json"


def read_provenance(media_path):
    try:
        with open(provenance_path(media_path), "r", encoding="utf-8") as stream:
            return sanitize_provenance(json.load(stream))
    except (OSError, ValueError, TypeError):
        return None


def write_provenance(media_path, value):
    clean = sanitize_provenance(value)
    if not clean:
        return
    target = provenance_path(media_path)
    fd, temporary = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(target)), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(clean, stream, ensure_ascii=False)
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.remove(temporary)


def move_provenance(old_media_path, new_media_path):
    source, target = provenance_path(old_media_path), provenance_path(new_media_path)
    if os.path.isfile(source):
        if os.path.exists(target):
            raise FileExistsError("目标来源记录已存在")
        os.rename(source, target)


def delete_provenance(media_path):
    path = provenance_path(media_path)
    if os.path.isfile(path):
        os.remove(path)


def local_media_source(url, resolver, roots):
    """Use the existing media resolver, then enforce decoded path/root/media bounds."""
    if not isinstance(url, str) or not url.startswith(("/assets/", "/output/", "/api/storage-files/local/")):
        return None
    decoded = unquote(urlsplit(url).path)
    if "\\" in decoded or any(part in ("..", ".") or ":" in part for part in decoded.split("/")):
        return None
    candidate = resolver(url)
    if not candidate or not os.path.isfile(candidate):
        return None
    path = os.path.realpath(candidate)
    allowed = False
    for root in roots:
        try:
            if os.path.commonpath([os.path.realpath(root), path]) == os.path.realpath(root):
                allowed = True
        except ValueError:
            continue
    if not allowed or Path(path).suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".avif", ".mp4", ".webm", ".mov", ".m4v"}:
        return None
    return path
