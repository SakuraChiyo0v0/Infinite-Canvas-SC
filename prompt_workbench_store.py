"""Local creative state, separate from saved prompt templates."""
import json
import os
import tempfile
from threading import Lock

LOCK = Lock()
KINDS = {"drafts", "recipes", "covers"}


class StateConflict(ValueError):
    pass


def _read(path):
    if not os.path.exists(path):
        return {kind: {} for kind in KINDS}
    with open(path, encoding="utf-8") as source:
        state = json.load(source)
    if not isinstance(state, dict):
        raise ValueError("创作状态文件格式异常，未覆盖原文件")
    for kind in KINDS:
        if not isinstance(state.get(kind), dict):
            raise ValueError("创作状态文件格式异常，未覆盖原文件")
    return state


def read_state(path):
    with LOCK:
        return _read(path)


def write_record(path, kind, key, value, revision):
    if kind not in KINDS or not key or len(key) > 300:
        raise ValueError("无效的创作记录")
    if value is not None and not isinstance(value, dict):
        raise ValueError("记录内容必须是对象")
    if len(json.dumps(value, ensure_ascii=False).encode("utf-8")) > 2_000_000:
        raise ValueError("单条创作记录过大，请减少结果记录")
    with LOCK:
        state = _read(path)
        previous = state[kind].get(key, {})
        if revision != previous.get("revision", 0):
            raise StateConflict("此记录已被其他页面更新，请刷新后重试；当前草稿仍保留在浏览器备份中")
        # Tombstones retain revisions so a stale tab cannot recreate a deleted recipe.
        record = {"revision": revision + 1, "value": value}
        state[kind][key] = record
        os.makedirs(os.path.dirname(path), exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix=".prompt-state-", dir=os.path.dirname(path))
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as target:
                json.dump(state, target, ensure_ascii=False, indent=2)
                target.flush()
                os.fsync(target.fileno())
            os.replace(temporary, path)
        finally:
            if os.path.exists(temporary):
                os.remove(temporary)
        return record
