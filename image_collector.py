"""Save collected images without overwriting existing files or rerunning generation."""
import hashlib
import os
import re
from io import BytesIO
from pathlib import Path
from threading import Lock

from fastapi import APIRouter, HTTPException
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

_save_lock = Lock()


class SaveRequest(BaseModel):
    url: str = Field(min_length=1, max_length=20000)
    folder: str = Field(min_length=1, max_length=4096)
    prefix: str = Field(default="image", max_length=80)
    batch: str = Field(min_length=1, max_length=80)
    sequence: int = Field(ge=1)
    entry_id: str = Field(min_length=1, max_length=160)


def filename_part(value, fallback):
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', value.strip()).strip('. ')
    return value[:80] or fallback


def save_image(payload, resolve_local, fetch_remote):
    folder = os.path.expanduser(payload.folder.strip())
    if not folder or not os.path.isabs(folder):
        raise HTTPException(400, "请输入后端所在电脑的绝对目录路径")
    try:
        local = resolve_local(payload.url)
        if local and os.path.isfile(local):
            content = Path(local).read_bytes()
        elif payload.url.startswith(('https://', 'http://')):
            remote = fetch_remote(payload.url)
            if not remote:
                raise HTTPException(400, "无法读取生成的图片")
            content = remote[0]
        else:
            raise HTTPException(404, "生成的图片文件不存在")
        with Image.open(BytesIO(content)) as img:
            ext = {'PNG': '.png', 'JPEG': '.jpg', 'WEBP': '.webp', 'GIF': '.gif',
                   'BMP': '.bmp', 'TIFF': '.tiff', 'AVIF': '.avif'}.get(img.format)
            img.verify()
        if not ext:
            raise HTTPException(400, "不支持的图片格式")
        root = Path(folder).resolve()
        root.mkdir(parents=True, exist_ok=True)
        token = hashlib.sha256(payload.entry_id.encode('utf-8')).hexdigest()[:16]
        stem = f"{filename_part(payload.prefix, 'image')}_{filename_part(payload.batch, 'batch')}_{payload.sequence:05d}_{token}"
        digest = hashlib.sha256(content).digest()
        # Exclusive creation also prevents another process from clobbering this file.
        with _save_lock:
            for suffix in range(10000):
                dest = root / f"{stem}{('-' + str(suffix)) if suffix else ''}{ext}"
                try:
                    handle = dest.open('xb')
                except FileExistsError:
                    if dest.is_file() and not dest.is_symlink() and hashlib.sha256(dest.read_bytes()).digest() == digest:
                        return {'ok': True, 'path': str(dest), 'name': dest.name, 'reused': True}
                    continue
                try:
                    with handle:
                        handle.write(content)
                        handle.flush()
                        os.fsync(handle.fileno())
                except OSError:
                    dest.unlink(missing_ok=True)
                    raise
                return {'ok': True, 'path': str(dest), 'name': dest.name, 'reused': False}
        raise HTTPException(409, "同名文件过多，请更换文件名前缀")
    except HTTPException:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, SyntaxError, ValueError) as exc:
        raise HTTPException(400, "结果不是可保存的有效图片") from exc
    except OSError as exc:
        raise HTTPException(400, f"保存失败，请检查图片和目录权限：{exc}") from exc
    except Exception as exc:
        raise HTTPException(400, "读取图片失败，请稍后重试保存") from exc


def router(resolve_local, fetch_remote):
    routes = APIRouter()

    @routes.post('/api/smart-canvas/collector-save')
    def save_collected_image(payload: SaveRequest):
        return save_image(payload, resolve_local, fetch_remote)

    return routes
