"""Local character profiles with optimistic revisions and recoverable archiving."""
import json
import os
import tempfile
import threading
import time
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

LOCK = threading.Lock()


def read(path):
    if not os.path.exists(path):
        return {'characters': []}
    with open(path, encoding='utf-8') as source:
        data = json.load(source)
    if not isinstance(data, dict) or not isinstance(data.get('characters'), list):
        raise ValueError('角色文件格式异常，未覆盖原文件')
    return data


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.characters-', dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as target:
            json.dump(data, target, ensure_ascii=False, indent=2)
            target.flush()
            os.fsync(target.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.remove(temporary)


class Reference(BaseModel):
    url: str
    name: str = '设定图'


class Profile(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default='', max_length=20000)
    references: list[Reference] = Field(min_length=1, max_length=3)
    cover: str = ''
    revision: int = Field(default=0, ge=0)
    archived: bool = False


def router(path_for, file_for):
    api = APIRouter()

    @api.get('/api/characters')
    def list_characters(include_archived: bool = False):
        with LOCK:
            data = read(path_for())
        return {'characters': [c for c in data['characters'] if include_archived or not c.get('archived')]}

    def save(payload, character_id=None):
        name = payload.name.strip()
        if not name:
            raise HTTPException(400, '请填写角色名称')
        references = []
        for ref in payload.references:
            if not ref.url.startswith('/assets/') or any(token in ref.url for token in ('..', '?', '#', '\\')):
                raise HTTPException(400, '请使用已上传的本地设定图')
            path = file_for(ref.url)
            if not path or not os.path.isfile(path) or os.path.splitext(path)[1].lower() not in ('.png', '.jpg', '.jpeg', '.webp', '.gif'):
                raise HTTPException(400, '设定图不存在或格式不支持，请重新上传')
            if not any(r['url'] == ref.url for r in references):
                references.append({'url': ref.url, 'name': ref.name[:200]})
        cover = payload.cover or references[0]['url']
        if cover not in [r['url'] for r in references]:
            raise HTTPException(400, '请从设定图中选择封面')
        with LOCK:
            data = read(path_for())
            previous = next((c for c in data['characters'] if c['id'] == character_id), None)
            if character_id and previous is None:
                raise HTTPException(404, '角色不存在')
            if payload.revision != (previous or {}).get('revision', 0):
                raise HTTPException(409, '角色已被其他页面更新，请刷新后重试；表单内容尚未丢弃')
            now = int(time.time() * 1000)
            value = {'id': character_id or uuid.uuid4().hex, 'name': name, 'description': payload.description.strip(),
                     'references': references, 'cover': cover, 'revision': payload.revision + 1,
                     'archived': payload.archived, 'created_at': (previous or {}).get('created_at', now), 'updated_at': now}
            if previous:
                data['characters'][data['characters'].index(previous)] = value
            else:
                data['characters'].append(value)
            write(path_for(), data)
        return {'character': value}

    @api.post('/api/characters')
    def create_character(payload: Profile):
        return save(payload)

    @api.put('/api/characters/{character_id}')
    def update_character(character_id: str, payload: Profile):
        return save(payload, character_id)

    return api
