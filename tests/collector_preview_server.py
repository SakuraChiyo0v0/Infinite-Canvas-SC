"""Isolated UI fixture: real canvas + save API, synthetic generation, no user data.

Run: python tests/collector_preview_server.py
Open: http://127.0.0.1:8891/static/smart-canvas.html?id=connected
Other fixtures: plain, parallel, single. Files are confined to a temporary folder.
"""
import copy
import sys
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
import uvicorn

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import image_collector

temp = tempfile.TemporaryDirectory(prefix='collector-ui-')
folder = Path(temp.name)
image = folder / 'fixture.png'
Image.new('RGB', (256, 256), '#a8b8db').save(image)
app = FastAPI()
app.mount('/static', StaticFiles(directory=ROOT / 'static'), name='static')
app.include_router(image_collector.router(lambda url: str(image) if url.startswith('/fixtures/') else None, lambda url: None))
canvases = {}
tasks = []
settings = {'engine':'api','apiKind':'image','provider_id':'fixture','model':'fixture-image','count':1,'resolution':'1k','ratio':'square'}


def fixture(name):
    source = {'id':'source','type':'smart-image','x':470,'y':130,'images':[],
              'promptDraftText':'A blue square', 'promptDraftHtml':'A blue square','runSettings':copy.deepcopy(settings)}
    loop = {'id':'loop','type':'smart-loop','x':60,'y':130,'count':3,'mode':'parallel' if name == 'parallel' else 'serial',
            'showPrompt':False,'imageInput':False,'loopStart':1,'imageBatchSize':1}
    collector = {'id':'collector','type':'smart-collector','x':850,'y':130,'folder':str(folder / name),
                 'prefix':'fixture','entries':[],'images':[]}
    nodes = [source, collector] if name == 'single' else [loop, source, collector]
    edges = [] if name == 'single' else [{'from':'loop','to':'source','kind':'input'}]
    if name != 'plain':
        edges.append({'from':'source','to':'collector','kind':'input'})
    return {'id':name,'title':f'收集节点验证 · {name}','kind':'smart','project':'default',
            'nodes':nodes,'connections':edges,'settings':copy.deepcopy(settings),'viewport':{'x':0,'y':0,'scale':0.8},'logs':[],'updated_at':1}


@app.get('/api/config')
def config():
    return {'api_providers':[{'id':'fixture','name':'本地测试','enabled':True,'has_key':True,
                             'image_models':['fixture-image'],'chat_models':[],'video_models':[]}], 'comfy_instances':[]}


@app.get('/api/canvases/{name}')
def get_canvas(name):
    return {'canvas':canvases.setdefault(name, fixture(name))}


@app.put('/api/canvases/{name}')
async def save_canvas(name, request: Request):
    value = await request.json()
    canvases[name] = {**canvases.get(name, fixture(name)), **value, 'updated_at':int(time.time()*1000)}
    return {'canvas':canvases[name]}


@app.post('/api/canvas-image-tasks')
async def generate(request: Request):
    tasks.append(await request.json())
    return {'task_id':str(len(tasks))}


@app.get('/api/canvas-image-tasks/{task_id}')
def task_result(task_id):
    return {'status':'succeeded','result':{'images':[f'/fixtures/{task_id}.png']}}


@app.get('/fixtures/{name}')
def preview(name):
    return FileResponse(image)


@app.get('/debug')
def debug():
    return {'tasks':len(tasks),'canvases':canvases,'files':[str(p) for p in folder.rglob('*.png') if p != image]}


@app.get('/api/{path:path}')
def empty(path):
    return {'library':{'libraries':[]},'templates':[],'items':[],'workflows':[]}


if __name__ == '__main__':
    try:
        uvicorn.run(app, host='127.0.0.1', port=8891, log_level='warning')
    finally:
        temp.cleanup()
