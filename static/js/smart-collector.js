/* Optional image output sink. Generation keeps using the existing task pipeline. */
const collectorSaves = new Map();
const collectorPages = new Map();
const collectorExpanded = new Set();

function isCollector(node){ return node?.type === 'smart-collector'; }
function collectorTargets(source){
    const ids = source?.collectorTargets || (canvas?.connections || [])
        .filter(c => c.from === source?.id && ['input', 'flow'].includes(c.kind || 'flow')).map(c => c.to);
    return nodes.filter(n => isCollector(n) && ids.includes(n.id));
}
function collectorForImageRun(source){
    const config = smartSettingsForNode(source) || settings;
    return config?.apiKind !== 'video' && collectorTargets(source).length > 0;
}
function createCollectorNode(x, y){
    pushUndo();
    const node = {id:uid('collector'), type:'smart-collector', x, y, title:'收集并保存',
        folder:'', prefix:'image', entries:[], generationErrors:[], images:[], created_at:Date.now()};
    nodes.push(node);
    selectedId = node.id;
    render();
    scheduleSave();
    return node;
}
function createCollectorJob(source, expectedCount=1, meta=null){
    const job = {id:uid('collector-job'), type:'smart-image', collectorJob:true,
        collectorTargets:collectorTargets(source).map(n => n.id), collectorSourceId:source.id,
        collectorBatch:new Date().toISOString().replace(/\D/g, '').slice(0, 14),
        x:source.x, y:source.y, images:[], pending:expectedCount, running:false,
        created_at:Date.now(), runStartedAt:nowMs(), runSettings:cloneSmartSettings(smartSettingsForNode(source) || settings)};
    nodes.push(job);
    if(meta) attachRunMeta(job, meta);
    return job;
}
function collectorFinishJob(job, error=''){
    if(!job?.collectorJob || smartPendingTasks(job).length || job.jimengPending) return;
    if(job.collectorFinished) return;
    job.collectorFinished = true;
    if(error){
        collectorTargets(job).forEach(n => {
            n.generationErrors = [...(n.generationErrors || []), {id:job.id, message:String(error), at:Date.now()}].slice(-20);
        });
    }
    nodes = nodes.filter(n => n.id !== job.id);
    if(selectedId === job.id) selectedId = job.collectorSourceId || '';
    scheduleSave();
}
function collectGeneratedImages(source, images, kind='image'){
    if(!source || !images?.length) return;
    const targets = collectorTargets(source);
    if(!targets.length){
        // If the collector was deleted while generating, preserve the result on the canvas.
        if(source.collectorJob){
            delete source.collectorJob;
            source.x = (Number(source.x) || 0) + 360;
        }
        return;
    }
    const valid = images.filter(img => img?.url && !img.loopInputPreview && mediaKindForItem({...img, kind:img.kind || kind}) === 'image');
    if(!valid.length){
        if(source.collectorJob) delete source.collectorJob;
        return;
    }
    targets.forEach(target => {
        target.entries ||= [];
        valid.forEach(img => {
            const key = `${source.id}|${img.url}`;
            if(target.entries.some(e => e.key === key)) return;
            const entry = {id:uid('collected'), key, url:img.url, name:img.name || '', status:'pending',
                batch:source.collectorBatch || new Date().toISOString().replace(/\D/g, '').slice(0,14),
                sequence:target.entries.reduce((max, e) => Math.max(max, Number(e.sequence) || 0), 0) + 1,
                createdAt:Date.now()};
            target.entries.push(entry);
            saveCollectorEntry(target, entry);
        });
    });
    scheduleSave();
}
function saveCollectorEntry(target, entry){
    if(entry.status === 'saved') return Promise.resolve();
    if(collectorSaves.has(entry.id)) return collectorSaves.get(entry.id);
    const nodeId = target.id;
    entry.status = 'saving';
    entry.error = '';
    const promise = (async () => {
        try {
            if(!target.folder?.trim()) throw new Error('请填写保存目录，再点击重试保存');
            const response = await fetch('/api/smart-canvas/collector-save', {method:'POST',
                headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:entry.url,
                    folder:target.folder, prefix:target.prefix || 'image', batch:entry.batch,
                    sequence:entry.sequence, entry_id:entry.id})});
            const data = await response.json();
            if(!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : '保存失败');
            const current = nodes.find(n => n.id === nodeId)?.entries?.find(e => e.id === entry.id) || entry;
            Object.assign(current, {status:'saved', path:data.path, savedName:data.name, error:'', updatedAt:Date.now()});
        } catch(error){
            const current = nodes.find(n => n.id === nodeId)?.entries?.find(e => e.id === entry.id) || entry;
            Object.assign(current, {status:'failed', error:error.message || '保存失败', updatedAt:Date.now()});
        } finally {
            scheduleSave();
        }
    })();
    collectorSaves.set(entry.id, promise);
    promise.finally(() => {collectorSaves.delete(entry.id); refreshCollectorNode(nodeId);});
    return promise;
}
async function retryCollector(node){
    for(const entry of node.entries || []){
        if(entry.status !== 'saved') await saveCollectorEntry(node, entry);
    }
    refreshCollectorNode(node.id);
}
function resumeCollectors(){
    nodes.filter(isCollector).forEach(node => {
        (node.entries || []).forEach(entry => {
            if(['pending','saving'].includes(entry.status)) saveCollectorEntry(node, entry);
        });
    });
    nodes.filter(n => n.collectorJob).forEach(job => {
        if(job.images?.length) collectGeneratedImages(job, job.images);
        if(!smartPendingTasks(job).length && !job.jimengPending) collectorFinishJob(job);
    });
}
function mergeCollectorNode(local, remote){
    const entries = new Map();
    [...(remote.entries || []), ...(local.entries || [])].forEach(e => {
        const old = entries.get(e.id);
        if(!old || (e.status === 'saved' && old.status !== 'saved') ||
            (old.status !== 'saved' && Number(e.updatedAt || 0) >= Number(old.updatedAt || 0))) entries.set(e.id, e);
    });
    return {...remote, ...local, entries:[...entries.values()]};
}
function collectorBodyHtml(node){
    const entries = node.entries || [];
    const saved = entries.filter(e => e.status === 'saved').length;
    const failed = entries.filter(e => e.status === 'failed').length;
    const jobs = nodes.filter(n => n.collectorJob && n.collectorTargets?.includes(node.id));
    const expanded = collectorExpanded.has(node.id);
    const pageCount = Math.max(1, Math.ceil(entries.length / 12));
    const page = Math.min(collectorPages.get(node.id) || 0, pageCount - 1);
    const visible = expanded ? entries.slice().reverse().slice(page*12, page*12+12) : entries.slice(-6).reverse();
    return `<div class="collector-body">
        <label>保存目录<input data-collector-field="folder" value="${escapeHtml(node.folder || '')}" placeholder="例如 D:\\图片\\批量出图" aria-label="保存目录"></label>
        <label>文件名前缀<input data-collector-field="prefix" value="${escapeHtml(node.prefix || 'image')}" maxlength="80" aria-label="文件名前缀"></label>
        <div class="collector-help">目录位于运行服务的电脑 · 生成完成后自动保存</div>
        <div class="collector-status">已保存 ${saved} / ${entries.length} 张${failed ? ` · 保存失败 ${failed}` : ''}${jobs.length ? ` · 生成中 ${jobs.length}` : ''}</div>
        <div class="collector-actions"><button data-collector-action="retry" ${entries.some(e => e.status !== 'saved') ? '' : 'disabled'}>重试保存</button><button data-collector-action="expand">${expanded ? '收起记录' : '查看全部'}</button></div>
        ${entries.find(e => e.status === 'failed') ? `<div class="collector-error">${escapeHtml(entries.find(e => e.status === 'failed').error || '保存失败')}</div>` : ''}
        ${node.generationErrors?.length ? `<div class="collector-error">生成失败：${escapeHtml(node.generationErrors.at(-1).message)}</div>` : ''}
        ${jobs.map(job => {
            const task = smartRecoverableImageTask(job);
            return task ? `<button data-collector-query="${escapeHtml(job.id)}" data-task="${escapeHtml(task.taskId)}">查询未完成任务</button>` : '';
        }).join('')}
        <div class="collector-results">${visible.map(e => `<a class="collector-result" href="${escapeHtml(safeCollectorUrl(e.url))}" target="_blank" rel="noopener" title="${escapeHtml(e.path || e.error || e.name)}"><img loading="lazy" src="${escapeHtml(safeCollectorUrl(e.url))}" alt="结果 ${e.sequence}"><span>${e.sequence} · ${e.status === 'saved' ? '已保存' : e.status === 'failed' ? '失败' : '保存中'}</span>${expanded ? `<small>${escapeHtml(e.path || e.error || e.name)}</small>` : ''}</a>`).join('') || '<div class="collector-empty">连接生成节点，新图片会收集到这里</div>'}</div>
        ${expanded ? `<div class="collector-pages"><button data-collector-action="prev" ${page ? '' : 'disabled'}>上一页</button><span>${page+1} / ${pageCount}</span><button data-collector-action="next" ${page+1 < pageCount ? '' : 'disabled'}>下一页</button></div>` : ''}
    </div>`;
}
function safeCollectorUrl(url){
    return /^(\/[^/]|https?:\/\/)/i.test(String(url || '')) ? url : '';
}
function bindCollectorControls(el, node){
    const body = el.querySelector('.collector-body');
    if(!body) return;
    ['mousedown','click','dblclick','wheel'].forEach(type => body.addEventListener(type, e => e.stopPropagation()));
    body.querySelectorAll('[data-collector-field]').forEach(input => {
        input.oninput = () => {node[input.dataset.collectorField] = input.value; scheduleSave();};
    });
    body.querySelectorAll('[data-collector-action]').forEach(button => button.onclick = () => {
        const action = button.dataset.collectorAction;
        if(action === 'retry') {retryCollector(node); return;}
        if(action === 'expand') collectorExpanded.has(node.id) ? collectorExpanded.delete(node.id) : collectorExpanded.add(node.id);
        if(action === 'prev' || action === 'next') collectorPages.set(node.id, Math.max(0, (collectorPages.get(node.id)||0) + (action === 'next' ? 1 : -1)));
        refreshCollectorNode(node.id);
    });
    body.querySelectorAll('[data-collector-query]').forEach(button => button.onclick = () => querySmartImageTaskNow(button.dataset.collectorQuery, button.dataset.task));
}
function refreshCollectorNode(id){
    const node = nodes.find(n => n.id === id);
    const el = world.querySelector(`.image-node[data-id="${CSS.escape(id)}"]`);
    if(!node || !el || el.querySelector('input:focus')) return;
    el.querySelector('.node-body').innerHTML = collectorBodyHtml(node);
    bindCollectorControls(el, node);
}
