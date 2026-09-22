/* Canvas integration. Execution data stays in immutable plans and per-round maps. */
const visionRuns = new Map();
const visionTests = new Map();
function visionProviders(){
    return chatApiProviders().filter(p => !/codex|gemini[-_]?cli/i.test(`${p.id} ${p.type || ''} ${p.protocol || ''}`));
}
function addVisionJudgeNode(point){
    const p = point || defaultPoint(100,0), provider = visionProviders()[0];
    return addNode({id:uid('judge'),type:'visionJudge',judgeVersion:1,x:p.x,y:p.y,w:360,
        provider:provider?.id || '',model:provider?.chat_models?.[0] || '',mode:'review',
        instruction:'人物完整入镜、穿红色外套，并且不含明显文字。全部满足才通过。',
        branches:VisionRouting.reviewBranches(),visionRecords:[]});
}
function visionHasWorkflow(id){ return VisionRouting.containsJudge(nodes,connections,id); }
function visionConfigKey(node){ return JSON.stringify([node.provider,node.model,node.mode,node.instruction,VisionRouting.branches(node)]); }
function visionPlanKey(ns, es){
    return JSON.stringify([ns.map(n => {
        const c = {...serializableCanvasNode(n)};
        ['x','y','w','h','inputs','generatedOutputs','outputText','visionRecords','visionRound','visionRunState','visionStatus','visionError','visionStale','imageComparisons'].forEach(k => delete c[k]);
        if(c.type==='output' && es.some(e => e.to===c.id)) delete c.images;
        return c;
    }),es]);
}
function visionRunFor(id){ return [...visionRuns.values()].find(r => r.plan.byId.has(id)); }
function visionBusy(id){ return visionRunFor(id)?.status==='running' || visionTests.has(id); }
function visionCurrentRefs(node){
    const result=[];
    for(const e of connections.filter(e => e.to===node.id)){
        const source=nodes.find(n=>n.id===e.from);
        if(source?.type==='visionJudge'){
            const record=source.visionRecords?.at(-1);
            if(record?.branchId===e.fromPort && record.configKey===visionConfigKey(source)) result.push(...(record.refs || []));
        } else result.push(...mediaRefsFromNode(source).filter(r=>r.kind==='image'));
    }
    return result;
}
function visionRecordStale(node,record){
    if(!record) return false;
    if(node.visionStale || record.configKey!==visionConfigKey(node)) return true;
    if(visionBusy(node.id)) return false;
    return (record.inputKey || JSON.stringify(record.refs?.map(r=>r.url)))!==JSON.stringify(visionCurrentRefs(node).map(r=>r.url));
}
async function visionRequest(node, refs, signal){
    VisionRouting.validateJudge(node);
    if(refs.length!==1 || refs[0].kind!=='image') throw Error(`每轮需要 1 张图片，当前为 ${refs.length} 张；请调整输入或循环`);
    const response=await fetch('/api/canvas-vision-judge',{method:'POST',headers:{'Content-Type':'application/json'},signal,
        body:JSON.stringify({provider:node.provider,model:node.model,image:refs[0].url,mode:node.mode,instruction:node.instruction,branches:VisionRouting.branches(node)})});
    if(response.status===404) throw Error('当前服务尚未加载视觉判断接口，请重启本地服务后再试');
    if(!response.ok) throw Error(await responseErrorMessage(response,'视觉判断失败'));
    return {...VisionRouting.validateResult(await response.json(),node),refs:VisionRouting.clone(refs),text:'',configKey:visionConfigKey(node)};
}
async function testVisionJudge(id){
    const node=nodes.find(n=>n.id===id); if(!node || visionBusy(id)) return;
    commitVisionInputs(node);
    const controller=new AbortController(); visionTests.set(id,controller);
    const snapshot=VisionRouting.clone(node), refs=visionCurrentRefs(node);
    node.visionStatus='running'; node.visionError=''; refreshNodes([id]);
    try {
        const result=await visionRequest(snapshot,refs,controller.signal);
        if(visionTests.get(id)!==controller || controller.signal.aborted) return;
        node.visionRecords=[{...result,round:1,at:Date.now(),test:true,inputKey:JSON.stringify(refs.map(r=>r.url)),branchLabel:VisionRouting.branches(snapshot).find(b=>b.id===result.branchId)?.label}]; node.visionRound=0;
        node.visionStatus='done'; node.visionStale=visionConfigKey(node)!==visionConfigKey(snapshot);
    } catch(error){ node.visionStatus=controller.signal.aborted?'stopped':'failed'; node.visionError=controller.signal.aborted?'已停止；外部请求可能仍在处理':error.message; }
    finally { if(visionTests.get(id)===controller) visionTests.delete(id); refreshNodes([id]); scheduleSave(); }
}
function visionSnapshotSource(n, all){
    if(n.type==='image') return {refs:n.url?[{url:n.url,name:n.name || 'image',kind:mediaKindForNode(n)}]:[],text:''};
    if(n.type==='prompt') return {refs:[],text:n.text || ''};
    if(n.type==='group' || n.type==='promptGroup'){
        const parts=(n.items || []).map(id=>all.get(id)).filter(Boolean).map(x=>visionSnapshotSource(x,all));
        return {refs:parts.flatMap(x=>x.refs),text:parts.map(x=>x.text).filter(Boolean).join('\n\n')};
    }
    if(n.type==='output') return {refs:(n.images || []).map(x=>({url:outputUrlValue(x),kind:mediaKindForOutputItem(x)})).filter(x=>x.url),text:''};
    return {refs:[],text:''};
}
function visionInputSources(values){
    return values.flatMap(({edge,value})=>[
        ...(value.refs || []).map((ref,i)=>({id:`${edge.id}:image:${i}`,type:'image',refs:[ref],prompt:'',preview:ref.url,label:ref.name || '本轮图片'})),
        ...(value.text ? [{id:`${edge.id}:text`,type:'prompt',refs:[],prompt:value.text,label:'本轮提示词'}]:[])
    ]);
}
async function visionExecuteNode(node, values, round, run){
    const refs=values.flatMap(x=>x.value.refs || []), texts=values.map(x=>x.value.text).filter(Boolean);
    if(VisionRouting.staticTypes.includes(node.type)) return visionSnapshotSource(node,run.allNodes);
    if(node.type==='output') return values.length ? {refs,text:texts.join('\n\n')} : visionSnapshotSource(node,run.allNodes);
    if(node.type==='loop'){
        let text='';
        if(node.showPrompt){
            text=texts.length?texts[(round.index-1)%texts.length]:node.variablePrompt || '';
            for(const [token,value] of [['《计数》',round.index],['《总数》',round.total],['《进度》',`${round.index}/${round.total}`],[`[${tr('canvas.counterToken')}]`,round.index],[`[${tr('canvas.totalToken')}]`,round.total],[`[${tr('canvas.progressToken')}]`,`${round.index}/${round.total}`]]) text=text.replaceAll(token,String(value));
        }
        return {refs:node.imageInput?refs.slice(round.index-1,round.index-1+Math.max(1,Number(node.imageBatchSize)||1)):[],text};
    }
    if(node.type==='visionJudge') return visionRequest(node,refs,run.controller.signal);
    const copy=VisionRouting.clone(node);
    copy._visionRun=true; copy._visionSources=visionInputSources(values); copy._activeLoopCtx={index:round.index,total:round.total};
    copy.generatedOutputs=[]; copy.outputText=''; copy.running=false; copy.runStatus=''; copy.runError='';
    await runCascadeNodeByType(copy,{cascade:true,visionNode:copy,cascadeTargetId:run.id});
    if(copy.runStatus==='failed') throw Error(copy.runError || '节点执行失败');
    const result={refs:generatedImageRefs(copy),text:copy.outputText || ''};
    if(!result.refs.length && !result.text) throw Error(`节点 ${node.id} 未产出结果，请检查输入和配置`);
    return result;
}
function visionPublish(node,round,run){
    if(!visionRuns.has(run.id)) return;
    const live=nodes.find(n=>n.id===node.id); if(!live) return;
    const status=round.states[node.id], value=round.outputs[node.id];
    live.visionStatus=status; live.visionError=round.errors[node.id] || '';
    live.visionRunState={id:run.id,status:run.status,round:round.index};
    if(node.type==='visionJudge' && ['failed','interrupted','skipped'].includes(status)){
        const record={round:round.index,at:Date.now(),runId:run.id,status,configKey:visionConfigKey(node),model:node.model,
            reason:round.errors[node.id] || (status==='skipped'?'本轮未进入此分支':'本轮已中断'),suggestion:'',
            refs:run.plan.incoming.get(node.id).flatMap(e=>round.outputs[e.from]?.refs || [])};
        live.visionRecords=(live.visionRecords || []).filter(r=>r.round!==round.index);
        live.visionRecords.push(record);live.visionRecords.sort((a,b)=>a.round-b.round);
        live.visionRound=live.visionRecords.findIndex(r=>r.round===round.index);
    }
    if(status==='done' && value){
        if(node.type==='visionJudge'){
            const record={...value,round:round.index,at:Date.now(),runId:run.id,branchLabel:VisionRouting.branches(node).find(b=>b.id===value.branchId)?.label};
            live.visionRecords=(live.visionRecords || []).filter(r=>r.round!==round.index);
            live.visionRecords.push(record); live.visionRecords.sort((a,b)=>a.round-b.round);
            live.visionRound=live.visionRecords.findIndex(r=>r.round===round.index); live.visionStale=false;
        } else if(node.type==='output'){
            appendOutputImagesWithoutDuplicates(live,(value.refs || []).map(r=>r.kind==='image'?r.url:{url:r.url,kind:r.kind}));
        } else if(VisionRouting.runTypes.includes(node.type)){
            if(value.text) live.outputText=value.text;
            // The scheduler, not the legacy output synchronizer, owns downstream publication.
            live.generatedOutputs=[...(live.generatedOutputs || []),...(value.refs || []).map(r=>r.kind==='image'?r.url:{url:r.url,kind:r.kind})];
        }
    }
    refreshNodes([node.id]); renderLinks(); scheduleSave();
}
async function runVisionWorkflow(anchor, retry=false){
    try {
        if(visionBusy(anchor)) return;
        nodes.filter(n=>n.type==='visionJudge'&&!visionBusy(n.id)).forEach(commitVisionInputs);
        let run=retry?visionRunFor(anchor):null;
        if(retry && !run) throw Error('运行记录已中断或丢失，请启动新运行');
        if(run){
            const current=nodes.filter(n=>run.plan.byId.has(n.id));
            if(visionPlanKey(current,connections.filter(e=>run.plan.byId.has(e.from)&&run.plan.byId.has(e.to)))!==run.signature) throw Error('流程配置已改变，请启动新运行');
        } else {
            const p=VisionRouting.plan(nodes.map(serializableCanvasNode),connections.map(e=>({...e})),anchor);
            if(p.nodes.some(n=>visionBusy(n.id) || n.running || isCascadeActive(n.id))) throw Error('流程中有正在运行的节点，请先停止或等待完成');
            const snapshot=VisionRouting.clone(p.nodes), edgeSnapshot=VisionRouting.clone(connections.filter(e=>p.byId.has(e.from)&&p.byId.has(e.to)));
            const plan=VisionRouting.plan(snapshot,edgeSnapshot,anchor), loop=plan.loop;
            for(const judge of plan.nodes.filter(n=>n.type==='visionJudge')){
                const provider=visionProviders().find(p=>p.id===judge.provider);
                if(!provider || !(provider.chat_models || []).includes(judge.model)) throw Error('判断节点所选平台或模型已不可用，请重新选择');
            }
            run=VisionRouting.createRun(plan,{id:uid('vision-run'),rounds:loop?loopCount(loop):1,start:Math.max(1,Number(loop?.loopStart)||1),stride:loop?.imageInput?Math.max(1,Number(loop.imageBatchSize)||1):1,
                parallel:loop?.mode==='parallel'?cascadeParallelLimit(plan.order,loopCount(loop)):1});
            run.allNodes=new Map(nodes.map(n=>[n.id,VisionRouting.clone(serializableCanvasNode(n))]));
            run.signature=visionPlanKey(p.nodes,edgeSnapshot);
            for(const old of [...visionRuns.values()]) if(old.plan.nodes.some(n=>p.byId.has(n.id))) visionRuns.delete(old.id);
            visionRuns.set(run.id,run);
            for(const n of p.nodes){
                const live=nodes.find(x=>x.id===n.id);
                live.visionStatus='queued'; live.visionError='';
                live.visionRunState={id:run.id,status:'running'};
                if(n.type==='visionJudge'){ live.visionRecords=[]; live.visionStale=false; }
                if(VisionRouting.runTypes.includes(n.type)){ live.generatedOutputs=[]; if(n.type==='llm') live.outputText=''; }
            }
        }
        run.controller=new AbortController();
        createCascadeContext(run.id,run.plan.order,{mode:run.plan.loop?.mode || 'serial'});
        await VisionRouting.execute(run,visionExecuteNode,(n,r,current)=>{
            visionPublish(n,r,current);
            if(current.status==='failed') { current.controller.abort(); requestCascadeStop(current.id); }
        });
        const ctx=cascadeContextFor(run.id); if(ctx) ctx.status=run.status;
        cascadeContexts.delete(run.id); cascadeStopIds.delete(run.id);
        for(const n of run.plan.nodes){
            const live=nodes.find(x=>x.id===n.id); if(!live) continue;
            live.visionRunState={id:run.id,status:run.status};
            if(['queued','running'].includes(live.visionStatus)) live.visionStatus=run.status==='done'?'done':'interrupted';
            if(n.type==='visionJudge') for(const record of live.visionRecords || []) record.inputKey=JSON.stringify(visionCurrentRefs(live).map(r=>r.url));
        }
        refreshNodes(run.plan.order); scheduleSave();
        if(run.error) showErrorModal(run.error.message,'视觉分支流程失败');
    } catch(error){ showErrorModal(error.message,'无法运行视觉分支流程'); }
}
function stopVisionWorkflow(id){
    const test=visionTests.get(id); if(test) test.abort();
    const run=visionRunFor(id); if(!run || run.status!=='running') return;
    run.stopped=true; run.controller.abort(); requestCascadeStop(run.id);
}
function resetVisionRuntime(){
    visionTests.forEach(c=>c.abort()); visionTests.clear();
    visionRuns.forEach(r=>{r.stopped=true; r.controller?.abort(); requestCascadeStop(r.id);}); visionRuns.clear();
}
function visionStatusLabel(node){
    const status=node.visionRunState?.status==='running' && !visionRunFor(node.id) ? 'interrupted' : node.visionStatus;
    return ({queued:'等待',running:'判断 / 执行中',done:'完成',skipped:'已跳过',failed:'执行失败',stopped:'已停止',interrupted:'已中断'})[status] || '待运行';
}
function visionWorkflowButton(node){
    if(!visionHasWorkflow(node.id)) return '';
    const busy=visionBusy(node.id), run=visionRunFor(node.id);
    return `<div class="vision-flow-actions"><span>${escapeHtml(visionStatusLabel(node))}</span><button type="button" data-vision-run="${escapeAttr(node.id)}">${busy?'停止运行':'运行此流程'}</button>${run && ['failed','stopped'].includes(run.status)?`<button type="button" data-vision-retry="${escapeAttr(node.id)}">重试未完成步骤</button>`:''}</div>`;
}
function bindVisionActions(el){
    el.querySelectorAll('[data-vision-run]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.visionRun;visionBusy(id)?stopVisionWorkflow(id):runVisionWorkflow(id);});
    el.querySelectorAll('[data-vision-retry]').forEach(b=>b.onclick=e=>{e.stopPropagation();runVisionWorkflow(b.dataset.visionRetry,true);});
}
function changeVisionNode(node, action, redraw=true){
    if(visionBusy(node.id)) return;
    pushUndo(); action(); node.visionStale=true; scheduleSave(); if(redraw) refreshNodes([node.id]);
}
function markVisionDraft(node){
    node.visionStale=true; scheduleSave();
    const result=document.querySelector(`.node[data-id="${CSS.escape(node.id)}"] .vision-result`);
    if(node.visionRecords?.length && result && !result.querySelector('[data-vision-stale]')){
        const hint=document.createElement('p');hint.dataset.visionStale='true';hint.className='vision-error';hint.textContent='历史结果，需重新判断';result.prepend(hint);
    }
}
function commitVisionInputs(node){
    const el=document.querySelector(`.node[data-id="${CSS.escape(node.id)}"]`);
    const input=el?.querySelector('[data-judge="instruction"]');
    if(input && input.value!==node.instruction){ node.instruction=input.value; markVisionDraft(node); }
}
function renderVisionJudgeBody(node){
    const el=document.createElement('div'); el.className='vision-judge-body';
    const busy=visionBusy(node.id), providers=visionProviders(), bs=VisionRouting.branches(node), refs=visionCurrentRefs(node);
    const records=node.visionRecords || [], selectedRound=Math.min(Number(node.visionRound)||0,Math.max(0,records.length-1)), record=records[selectedRound];
    const stale=visionRecordStale(node,record);
    el.innerHTML=`<fieldset ${busy?'disabled':''}>
        <label>视觉模型<select data-judge="provider" aria-label="视觉模型平台"><option value="">选择平台</option>${providers.map(p=>`<option value="${escapeAttr(p.id)}" ${p.id===node.provider?'selected':''}>${escapeHtml(p.name || p.id)}</option>`).join('')}</select></label>
        <label>模型<select data-judge="model" aria-label="视觉模型"><option value="">选择模型</option>${(providers.find(p=>p.id===node.provider)?.chat_models || []).map(m=>`<option value="${escapeAttr(m)}" ${m===node.model?'selected':''}>${escapeHtml(m)}</option>`).join('')}</select></label>
        <p class="vision-hint">选择支持看图的对话模型；图片将发送给所选平台。</p>
        <label>判断方式<select data-judge="mode"><option value="review" ${node.mode==='review'?'selected':''}>审核：通过 / 不通过</option><option value="classify" ${node.mode==='classify'?'selected':''}>分类：自定义出口</option></select></label>
        <label>判断要求<textarea data-judge="instruction" maxlength="4000" rows="4">${escapeHtml(node.instruction || '')}</textarea></label>
        ${node.mode==='classify'?`<div class="vision-categories">${bs.filter(b=>b.id!=='unknown').map(b=>`<div class="vision-category" data-category="${escapeAttr(b.id)}"><input aria-label="类别名称" data-category-field="label" maxlength="40" value="${escapeAttr(b.label)}"><textarea aria-label="类别描述" data-category-field="description" maxlength="500" rows="2">${escapeHtml(b.description || '')}</textarea><div><button type="button" data-category-up="${escapeAttr(b.id)}">上移</button><button type="button" data-category-delete="${escapeAttr(b.id)}">删除</button></div></div>`).join('')}<button type="button" data-category-add ${bs.length>=7?'disabled':''}>添加类别</button><p class="vision-hint">按顺序匹配，命中第一个符合的类别。</p></div>`:''}
        </fieldset>
        <div class="vision-input-preview">${refs.length?refs.map(r=>canvasPreviewImgHtml(r.url,256,'alt="待判断图片"')).join(''):'连接一张图片到左侧输入端'}</div>
        <p class="vision-hint">每轮 1 张图片。测试会调用一次模型，不运行其他节点。判断图片最长边会缩至 1024 像素。</p>
        <button type="button" data-judge-test ${busy?'disabled':''}>测试判断</button>
        ${visionWorkflowButton(node)}
        <div class="vision-result" role="status" aria-live="polite"><strong>${escapeHtml(visionStatusLabel(node))}</strong>${node.visionError?`<p class="vision-error">${escapeHtml(node.visionError)}</p>`:''}
        ${record?`<label>查看结果<select data-judge-round>${records.map((r,i)=>`<option value="${i}" ${i===selectedRound?'selected':''}>${r.test?'测试判断':`第 ${r.round} 轮`}</option>`).join('')}</select></label>${stale?'<p class="vision-error">历史结果，需重新判断</p>':''}<div class="vision-input-preview">${(record.refs || []).map(r=>canvasPreviewImgHtml(r.url,256,'alt="本轮判断图片"')).join('')}</div><strong>命中：${escapeHtml(record.branchLabel || bs.find(b=>b.id===record.branchId)?.label || record.branchId || '未产生判断')}</strong><p>${escapeHtml(record.reason)}</p>${record.suggestion?`<p>修改建议：${escapeHtml(record.suggestion)}</p>`:''}<small>${escapeHtml(record.model)} · ${(Number(record.elapsedMs || 0)/1000).toFixed(1)} 秒</small>${!record.branchId || connections.some(e=>e.from===node.id&&e.fromPort===record.branchId)?'':'<p>命中此分支，未连接后续步骤</p>'}`:''}</div>
        <div class="vision-exits">${bs.map(b=>`<div class="vision-exit"><span>${escapeHtml(b.label)}</span><button type="button" data-connect-port="${escapeAttr(b.id)}" ${busy?'disabled':''}>连接 / 设置</button><button type="button" class="port out vision-port" data-port-id="${escapeAttr(b.id)}" aria-label="${escapeAttr(b.label)}出口，按 Enter 选择连接目标" title="${escapeAttr(b.label)}出口" ${busy?'disabled':''}></button></div>`).join('')}</div>`;
    el.querySelectorAll('[data-judge]').forEach(input=>input.onchange=()=>{
        const field=input.dataset.judge;
        if(field==='mode' && node.mode!==input.value){
            const count=connections.filter(e=>e.from===node.id).length;
            if(count && !confirm(`切换模式会移除 ${count} 条出口连线，继续？`)){ input.value=node.mode; return; }
            changeVisionNode(node,()=>{
                node.mode=input.value; connections=connections.filter(e=>e.from!==node.id);
                node.branches=node.mode==='review'?VisionRouting.reviewBranches():[{id:uid('category'),label:'人像',description:'主体为人物'},{id:uid('category'),label:'风景',description:'主体为自然风景'},VisionRouting.reviewBranches()[2]];
            });
        } else if(field!=='instruction') changeVisionNode(node,()=>{node[field]=input.value;if(field==='provider')node.model=providers.find(p=>p.id===input.value)?.chat_models?.[0] || '';});
    });
    const instruction=el.querySelector('[data-judge="instruction"]');
    instruction.onfocus=()=>{if(!visionBusy(node.id))pushUndo();};
    instruction.oninput=()=>{const live=nodes.find(n=>n.id===node.id);if(live&&!visionBusy(node.id)){live.instruction=instruction.value;markVisionDraft(live);}};
    el.querySelectorAll('[data-category-field]').forEach(input=>{
        input.onfocus=()=>{if(!visionBusy(node.id))pushUndo();};
        input.oninput=()=>{
            const live=nodes.find(n=>n.id===node.id);if(!live||visionBusy(node.id))return;
            const b=live.branches.find(b=>b.id===input.closest('[data-category]').dataset.category);
            b[input.dataset.categoryField]=input.value;markVisionDraft(live);
            if(input.dataset.categoryField==='label'){
                const port=el.querySelector(`[data-port-id="${CSS.escape(b.id)}"]`);
                port.closest('.vision-exit').querySelector('span').textContent=b.label;
                port.setAttribute('aria-label',`${b.label}出口，按 Enter 选择连接目标`);port.title=`${b.label}出口`;
            }
        };
    });
    el.querySelector('[data-category-add]')?.addEventListener('click',()=>changeVisionNode(node,()=>node.branches.splice(-1,0,{id:uid('category'),label:'新类别',description:''})));
    el.querySelectorAll('[data-category-up]').forEach(b=>b.onclick=()=>changeVisionNode(node,()=>{const i=node.branches.findIndex(x=>x.id===b.dataset.categoryUp);if(i>0)[node.branches[i-1],node.branches[i]]=[node.branches[i],node.branches[i-1]];}));
    el.querySelectorAll('[data-category-delete]').forEach(b=>b.onclick=()=>{
        if(node.branches.length<=3){alert('至少保留两个分类');return;}
        const id=b.dataset.categoryDelete,count=connections.filter(e=>e.from===node.id&&e.fromPort===id).length;
        if(count&&!confirm(`删除类别会移除 ${count} 条连线，继续？`))return;
        changeVisionNode(node,()=>{node.branches=node.branches.filter(x=>x.id!==id);connections=connections.filter(e=>e.from!==node.id||e.fromPort!==id);});
    });
    el.querySelector('[data-judge-test]').onclick=()=>testVisionJudge(node.id);
    el.querySelector('[data-judge-round]')?.addEventListener('change',e=>{node.visionRound=Number(e.target.value);refreshNodes([node.id]);});
    el.querySelectorAll('[data-connect-port]').forEach(b=>b.onclick=()=>openVisionConnectionDialog(node.id,b.dataset.connectPort));
    el.querySelectorAll('.vision-port').forEach(b=>b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openVisionConnectionDialog(node.id,b.dataset.portId);}});
    bindVisionActions(el); return el;
}
function connectVisionPort(from,to,port,textField='none',recordUndo=true){
    if(visionBusy(from) || visionBusy(to)) throw Error('请先停止流程再修改连接');
    const edge={id:uid('c'),from,to,fromPort:port,textField};
    if(!canConnect(from,to,port)) throw Error('不能连接到此节点，或连接会形成回路');
    VisionRouting.plan(nodes,[...connections,edge],from,{validateConfig:false});
    if(connections.some(e=>e.from===from&&e.to===to&&e.fromPort===port)) return;
    if(recordUndo) pushUndo();connections.push(edge);scheduleSave();render();
}
function openVisionConnectionDialog(id,port){
    const node=nodes.find(n=>n.id===id);if(!node || visionBusy(id))return;
    const dialog=document.createElement('dialog');dialog.className='vision-connection-dialog';
    const existing=connections.filter(e=>e.from===id&&e.fromPort===port);
    dialog.innerHTML=`<form method="dialog"><h3>${escapeHtml(VisionRouting.branches(node).find(b=>b.id===port)?.label)} · 后续步骤</h3><p>同一出口可以连接多个节点。</p><div class="vision-existing">${existing.map(e=>`<label>${escapeHtml(nodes.find(n=>n.id===e.to)?.type || e.to)}<select data-edge-text="${escapeAttr(e.id)}">${visionTextOptions(e.textField)}</select><button type="button" data-remove-edge="${escapeAttr(e.id)}">移除连接</button></label>`).join('')}</div><label>连接到<select name="target"><option value="new-output">新建图片输出节点</option>${nodes.filter(n=>n.id!==id&&['output',...VisionRouting.runTypes].includes(n.type)).map(n=>`<option value="${escapeAttr(n.id)}">${escapeHtml(n.type==='visionJudge'?'视觉判断':n.type)} · ${escapeHtml(n.id)}</option>`).join('')}</select></label><label>同时传递<select name="textField">${visionTextOptions('none')}</select></label><p class="vision-error" role="alert"></p><div class="vision-dialog-actions"><button type="button" data-add-edge>连接</button><button value="close">完成</button></div></form>`;
    dialog.querySelectorAll('[data-edge-text]').forEach(s=>s.onchange=()=>{pushUndo();connections.find(e=>e.id===s.dataset.edgeText).textField=s.value;scheduleSave();});
    dialog.querySelectorAll('[data-remove-edge]').forEach(b=>b.onclick=()=>{pushUndo();connections=connections.filter(e=>e.id!==b.dataset.removeEdge);scheduleSave();dialog.close();render();openVisionConnectionDialog(id,port);});
    dialog.querySelector('[data-add-edge]').onclick=()=>{
        let created=null;
        try{
            let to=dialog.querySelector('[name=target]').value;
            if(to==='new-output'){pushUndo();created={id:uid('out'),type:'output',x:node.x+460,y:node.y+VisionRouting.branches(node).findIndex(b=>b.id===port)*220,images:[]};nodes.push(created);to=created.id;}
            connectVisionPort(id,to,port,dialog.querySelector('[name=textField]').value,!created);dialog.close();
        }catch(error){if(created)nodes=nodes.filter(n=>n.id!==created.id);dialog.querySelector('[role=alert]').textContent=error.message;}
    };
    dialog.addEventListener('close',()=>{dialog.remove();refreshNodes([id]);});document.body.appendChild(dialog);dialog.showModal();
}
function visionTextOptions(value){return [['none','仅图片'],['suggestion','附加修改建议'],['reason','附加判断依据']].map(([v,l])=>`<option value="${v}" ${v===(value||'none')?'selected':''}>${l}</option>`).join('');}
function visionLinkClass(edge){
    const node=nodes.find(n=>n.id===edge.from);if(node?.type!=='visionJudge')return '';
    if(node.visionStatus!=='done')return '';
    const record=node.visionRecords?.[Number(node.visionRound)||0];
    return record && !visionRecordStale(node,record) ? record.branchId===edge.fromPort?' vision-link-active':' vision-link-skipped':'';
}
