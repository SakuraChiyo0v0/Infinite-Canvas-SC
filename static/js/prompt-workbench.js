(function(global){
    'use strict';
    const drafts = new Map();
    const core=global.PromptCreation;
    const state={drafts:{},recipes:{},covers:{}};
    const saves=new Map(),timers=new Map();
    let loaded=false,loading=null;
    let current = null;
    let characters = [];
    async function loadCharacters(){
        const data=await json('/api/characters');characters=data.characters || [];return characters;
    }
    function finalPrompt(d){
        const base=resolve(d.text,d.values),task=d.task || '';
        if(d.parentResultId && d.useCharacterReferences===false)return task.trim()?core.revisionPrompt(base,task):base;
        return core.characterPrompt(base,task,d.character,d.useCharacterReferences!==false);
    }
    const storageKey=key=>'prompt-workbench-backup:'+key;
    const uid=()=>global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    async function load(force=false){
        if(loaded && !force)return;
        if(!loading)loading=json('/api/prompt-workbench').then(data=>{Object.assign(state,data);loaded=true;}).finally(()=>{loading=null;});
        return loading;
    }
    async function record(kind,key,value){
        const queueKey=kind+':'+key;
        const snapshot=core.clone(value);
        const next=(saves.get(queueKey) || Promise.resolve()).catch(()=>{}).then(async()=>{
            const saved=await json(`/api/prompt-workbench/${kind}/${encodeURIComponent(key)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:snapshot,revision:state[kind][key]?.revision || 0})});
            state[kind][key]=saved;return saved;
        });
        saves.set(queueKey,next);
        return next;
    }
    function backup(d){
        try{localStorage.setItem(storageKey(d.key),JSON.stringify({revision:state.drafts[d.key]?.revision || 0,value:core.draftValue(d)}));}
        catch(error){d.saveStatus='浏览器备份失败：'+error.message;}
    }
    async function persist(d){
        clearTimeout(timers.get(d.key));
        const snapshot=core.draftValue(d);
        try{
            await record('drafts',d.key,snapshot);
            const pending=JSON.parse(localStorage.getItem(storageKey(d.key)) || 'null');
            if(pending && pending.value.updatedAt<=snapshot.updatedAt)localStorage.removeItem(storageKey(d.key));
            d.saveStatus='草稿已自动保存到本地';
        }catch(error){d.saveStatus='自动保存失败：'+error.message;backup(d);}
        if(visible(d))document.getElementById('pwSaveStatus').textContent=d.saveStatus;
        global.dispatchEvent(new CustomEvent('character-works-changed'));
    }
    function changed(d){backup(d);d.saveStatus='正在保存草稿…';clearTimeout(timers.get(d.key));timers.set(d.key,setTimeout(()=>persist(d),350));if(visible(d))document.getElementById('pwSaveStatus').textContent=d.saveStatus;}
    const variablePattern = /\{\{\s*([^{}]+?)\s*\}\}/g;
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function variables(text){ return [...new Set([...String(text).matchAll(variablePattern)].map(m => m[1].trim()))]; }
    function resolve(text, values){ return String(text).replace(variablePattern, (match, name) => String(values[name.trim()] || '').trim() || match); }
    function modelOptions(providers){
        return (providers || []).filter(p => p.enabled !== false && p.id !== 'modelscope' && p.image_configured === true)
            .flatMap(p => [...new Set(p.image_models || [])].filter(Boolean).map(model => ({provider:p.id, model, label:`${p.name || p.id} · ${model}`})));
    }
    function requestBody(draft){
        if(!String(draft.text || '').trim() && !String(draft.task || '').trim())throw new Error('请填写提示词');
        const prompt = finalPrompt(draft).trim();
        if(!prompt) throw new Error('请填写提示词');
        const missing = variables(draft.text).filter(name => !String(draft.values[name] || '').trim());
        if(missing.length) throw new Error(`请填写变量：${missing.map(core.label).join('、')}（不适用可填 none）`);
        const option = draft.options.find(o => JSON.stringify([o.provider,o.model]) === draft.model);
        if(!option) throw new Error('请选择可用的图像模型');
        const references=core.referencesFor(draft);
        if(references.length>3)throw new Error('角色设定图和附加参考图合计最多 3 张，请减少附加图片');
        return {prompt,provider_id:option.provider,model:option.model,size:draft.size,n:1,
            reference_images:references.map(r => ({url:r.url,name:r.name,kind:'image'})),
            operation:references.length ? 'edit' : 'generate',history_type:references.length ? 'klein' : 'online'};
    }
    function getDraft(item, library, content){
        const key = item.workbench_key || JSON.stringify([library.id,item.id]);
        if(!drafts.has(key)){
            let model = '';
            try { model = localStorage.getItem('studio_image_model') || ''; } catch(_){}
            const saved=state.drafts[key]?.value;
            let recovery=null;
            try{recovery=JSON.parse(localStorage.getItem(storageKey(key)) || 'null');}catch(_){}
            const recoverable=recovery && recovery.revision === (state.drafts[key]?.revision || 0);
            const restored=recoverable?recovery.value:saved;
            const d={key,item,library,text:content,original:content,values:Object.create(null),references:[],model,size:'1024x1024',task:'',results:[],revisionInputs:{},busy:false,uploading:false,status:'',error:false,source:{libraryId:library.id,itemId:item.id,name:item.name},saveStatus:'草稿自动保存到本地'};
            if(restored)Object.assign(d,restored,{values:Object.assign(Object.create(null),restored.values || {}),status:restored.pending?'正在恢复生成任务…':'已恢复上次创作草稿'});
            if(recovery && !recoverable){d.recovery=recovery.value;d.saveStatus='另一个页面保存了新版本，可手动恢复浏览器备份';}
            drafts.set(key,d);
            if(d.pending?.taskId){d.busy=true;setTimeout(()=>poll(d),0);}
            else if(d.pending){d.status='上次提交状态未知，请先检查生图历史，避免重复生成。';d.error=true;}
            if(recoverable)changed(d);
        }
        const draft = drafts.get(key);
        if(draft.original !== content){
            if(draft.text === draft.original) draft.text = content;
            draft.original = content;
        }
        draft.item = item; draft.library = library;
        draft.source = {...draft.source,libraryId:library.id,itemId:item.id};
        if(item.character_context && !draft.character){draft.character=core.clone(item.character_context);draft.useCharacterReferences=true;for(const name of variables(draft.text))if(['CHARACTER_NAME','CHARACTER','角色','角色名称'].includes(name.toUpperCase()) && !draft.values[name])draft.values[name]=draft.character.name;}
        return draft;
    }
    function characterMarkup(d){
        const selected=d.character;
        if(d.item.character_context && selected)return `<div class="pw-character"><p class="pw-note"><strong>${escape(selected.name)}</strong> · ${selected.references.length} 张设定图</p><div class="pw-row"><span class="pw-note">保留角色身份，按模板重新绘制</span><button type="button" class="asset-btn" data-pw-character-latest>更新角色资料</button></div></div>`;
        const available=characters.filter(c=>c.id!==selected?.id);
        return `<div class="pw-character"><label>使用角色<select id="pwCharacter" ${d.item.character_context?'disabled':''}><option value="">不使用角色</option>${selected?`<option selected value="${escape(selected.id)}">${escape(selected.name)} · 已选资料</option>`:''}${available.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('')}</select></label><div class="pw-row"><button type="button" class="asset-btn" data-pw-character-refresh>刷新角色列表</button>${selected?'<button type="button" class="asset-btn" data-pw-character-latest>使用最新角色资料</button>':''}</div>${selected?`<div class="pw-reference-list">${selected.references.map(ref=>`<a href="${escape(core.safeUrl(ref.url))}" target="_blank" rel="noopener"><img src="${escape(core.safeUrl(ref.url))}" alt="${escape(selected.name)} 设定图" width="70" height="70" style="object-fit:contain"></a>`).join('')}</div><p class="pw-note">保留角色身份，按模板重新绘制。${d.useCharacterReferences===false?'当前以此前作品作为参考。':''}</p>`:'<p class="pw-note">可先在左侧「角色」页保存设定图，再到这里选择。</p>'}</div>`;
    }
    function chooseCharacter(d,character){
        d.character=character?core.clone(character):null;d.useCharacterReferences=true;d.parentResultId='';
        if(character)for(const name of variables(d.text))if(['CHARACTER_NAME','CHARACTER','角色','角色名称'].includes(name.toUpperCase()))d.values[name]=character.name;
        changed(d);paint(d);
    }
    function characterWorks(id){
        const records=[...Object.values(state.drafts).map(r=>r.value),...drafts.values()];
        const unique=new Map();
        records.forEach(d=>(d?.results || []).filter(r=>r.character?.id===id).forEach(r=>unique.set(r.id,r)));
        return [...unique.values()].sort((a,b)=>b.createdAt-a.createdAt);
    }
    function continueResult(r){
        const d=current;if(!d)return;
        Object.assign(d,{text:r.prompt,values:Object.create(null),task:'',character:core.clone(r.character || null),useCharacterReferences:false,references:[{url:r.url,name:'上次生成结果'}],model:JSON.stringify([r.provider,r.model]),size:r.size,source:r.source,parentResultId:r.id});
        if(!d.results.some(item=>item.id===r.id))d.results.unshift(core.clone(r));
        d.status='已恢复这张作品，填写本次要求继续修改。';d.error=false;changed(d);paint(d);
    }
    function variableFields(d){
        return variables(d.text).map(name => `<label title="${escape(name)}">${escape(core.label(name))}<input data-pw-var="${escape(name)}" value="${escape(d.values[name] || '')}" placeholder="填写内容，不适用填 none"></label>`).join('');
    }
    function referenceMarkup(d){
        return d.references.map((r,i) => `<div class="pw-reference"><img src="${escape(r.url)}" alt="${escape(r.name)}"><button type="button" data-pw-remove="${i}" aria-label="移除参考图 ${i+1}">×</button></div>`).join('');
    }
    function resultsMarkup(d){
        return d.results.map((r,i) => `<figure class="pw-result"><a href="${escape(r.url)}" target="_blank" rel="noopener"><img src="${escape(r.url)}" alt="${escape(d.item.name)} 的生成结果"></a>
            <div class="pw-row"><a class="asset-btn" href="${escape(r.url)}" download="prompt-result.png">下载</a><button type="button" class="asset-btn" data-pw-reuse="${i}">用这张继续改</button><button type="button" class="asset-btn" data-pw-canvas="${i}" ${r.sending?'disabled':''}>${r.canvasReady?'打开画布':r.sending?'正在送入…':'送到新画布'}</button></div>
            <figcaption>${r.character?escape(r.character.name)+' · ':''}${escape(r.model)} · ${r.operation === 'edit' ? '图片编辑' : '文生图'} · ${escape(r.size)}${r.parentResultId?' · 修改分支':''}</figcaption>
            <label>一句话修改<input data-pw-revision="${i}" value="${escape(d.revisionInputs?.[r.id] || '')}" placeholder="例如：围巾换成蓝色，其他保持不变"></label>
            <div class="pw-row"><button class="asset-btn primary" type="button" data-pw-revise="${i}" ${d.busy?'disabled':''}>按这句话改图</button><button class="asset-btn" type="button" data-pw-cover="${i}">设为模板效果图</button></div>
            <details><summary>生成来源与最终提示词</summary><p class="pw-note">${escape(r.source?.name || d.item.name)} · ${r.createdAt?escape(new Date(r.createdAt).toLocaleString()):'旧结果未记录时间'}</p><div class="pw-reference-list">${(r.references || []).map(ref=>`<a href="${escape(core.safeUrl(ref.url))}" target="_blank" rel="noopener"><img src="${escape(core.safeUrl(ref.url))}" alt="${escape(ref.name || '参考图')}" style="width:72px;height:72px;object-fit:contain"></a>`).join('')}</div><div class="pw-preview">${escape(r.prompt)}</div></details></figure>`).join('');
    }
    function card(item,library){
        const cover=state.covers[item.workbench_key || JSON.stringify([library.id,item.id])]?.value;
        return `<div class="pw-card-preview">${cover?.url?`<img loading="lazy" src="${escape(core.safeUrl(cover.url))}" alt="${escape(item.name)} 效果预览">`:'<span>暂无效果图</span>'}<span class="pw-mode">${escape(core.mode(item))}</span></div>`;
    }
    function branchLibrary(){
        const items=Object.entries(state.drafts).flatMap(([key,record])=>{
            let parts;try{parts=JSON.parse(key);}catch(_){return [];}
            if(parts[0]!=='workbench_branches' || !record.value)return [];
            return [{id:parts[1],name:record.value.branchName || '画布创作分支',positive:record.value.original || record.value.text,category:'branches',scene:'改图；来自画布的独立创作分支，不覆盖原画布。'}];
        });
        return {id:'workbench_branches',name:'画布分支',readonly:true,categories:[{id:'branches',name:'继续创作'}],items};
    }
    function recipesMarkup(d){
        const recipes=Object.entries(state.recipes).filter(([,r])=>r.value?.key===d.key);
        return `<details class="pw-recipes"><summary>常用配方${recipes.length?` · ${recipes.length}`:''}</summary><div class="pw-row"><label>已保存配方<select id="pwRecipe"><option value="">选择一个配方</option>${recipes.map(([id,r])=>`<option value="${escape(id)}" ${d.recipeId===id?'selected':''}>${escape(r.value.name)}</option>`).join('')}</select></label><button class="asset-btn" type="button" data-pw-recipe-apply>应用</button></div><div class="pw-row"><button class="asset-btn" type="button" data-pw-recipe-update>更新所选</button><button class="asset-btn" type="button" data-pw-recipe-delete>删除所选</button></div><label>新配方名称<input id="pwRecipeName" placeholder="例如：马克笔人物 · 竖版"></label><label class="pw-check"><input id="pwRecipeRefs" type="checkbox" checked>${d.character?'包含附加参考图（角色设定单独保留）':'包含参考图'}</label><button class="asset-btn" type="button" data-pw-recipe-save>保存为新配方</button><p class="pw-note">保存正文、填写项、模型、画幅及可选参考图，不修改模板。</p></details>`;
    }
    function paint(d){
        if(!visible(d))return;
        const scroll=document.querySelector('.pw-scroll')?.scrollTop || 0;
        document.querySelector('.asset-detail').innerHTML=renderWorkbench(d.item,d.library,d.original,d.providers);
        document.querySelector('.pw-scroll').scrollTop=scroll;
    }
    function renderWorkbench(item, library, content, providers){
        const d = getDraft(item,library,content); current = d;
        try{localStorage.setItem('prompt-workbench-selection',JSON.stringify([library.id,item.id]));}catch(_){}
        d.providers=providers;
        d.options = modelOptions(providers);
        if(!d.model && d.options.length) d.model = JSON.stringify([d.options[0].provider,d.options[0].model]);
        const selected = d.options.some(o => JSON.stringify([o.provider,o.model]) === d.model);
        return `<div class="panel-head"><div class="panel-title"><strong>创作台</strong><span>临时修改不会覆盖模板</span></div><div class="panel-actions"><button class="asset-btn" type="button" data-prompt-edit-start="${escape(item.id)}" ${item.character_context?'hidden':''} ${library.readonly || item.character_context ? 'disabled' : ''}>管理模板</button></div></div>
        <div class="pw-scroll" data-pw-key="${escape(d.key)}">
            <h2>${escape(item.name || '提示词')}</h2>
            <p id="pwSaveStatus" class="pw-note" role="status">${escape(d.saveStatus)}</p>
            ${d.recovery?'<button class="asset-btn" type="button" data-pw-recover>恢复浏览器备份到当前草稿</button>':''}
            ${characterMarkup(d)}
            ${recipesMarkup(d)}
            ${item.scene ? `<details><summary>模板说明</summary><p class="pw-note">${escape(item.scene)}</p></details>` : ''}
            <label>本次任务<textarea id="pwTask" placeholder="这次想画谁、做什么？例如：把角色画成拿咖啡的半身马克笔速写。">${escape(d.task || '')}</textarea></label>
            <details id="pwAdvanced"><summary>高级编辑 · 固定风格与完整正文</summary><label>提示词正文<textarea id="pwText" spellcheck="false">${escape(d.text)}</textarea></label>
            <div class="pw-row"><button type="button" class="asset-btn" data-pw-reset>恢复模板</button><button type="button" class="asset-btn" data-pw-save ${library.readonly ? 'disabled' : ''}>保存正文到模板</button><span class="pw-note">变量填写仅用于本次生成</span></div>
            </details>
            <div id="pwVariableSection" ${variables(d.text).length?'':'hidden'}><div class="pw-row"><strong>填写模板变量</strong><button type="button" class="asset-btn" data-pw-none>其余空项填 none</button></div><div id="pwVariables" class="pw-variables">${variableFields(d)}</div></div>
            <details><summary>查看最终发送的提示词</summary><div id="pwPreview" class="pw-preview">${escape(finalPrompt(d))}</div></details>
            <div class="pw-drop" id="pwDrop"><div class="pw-row"><label class="asset-btn">添加参考图<input id="pwUpload" type="file" accept="image/*" multiple hidden></label><span class="pw-note">可拖入图片，最多 3 张</span></div><div id="pwReferences" class="pw-reference-list">${referenceMarkup(d)}</div></div>
            <label>图像模型<select id="pwModel">${!selected ? '<option value="">请选择可用模型</option>' : ''}${d.options.map(o => {const value=JSON.stringify([o.provider,o.model]);return `<option value="${escape(value)}" ${value===d.model?'selected':''}>${escape(o.label)}</option>`;}).join('')}</select></label>
            <div class="pw-row"><label>输出画幅<select id="pwSize">${[['1024x1024','方形 · 1:1'],['1024x1536','竖图 · 2:3'],['1536x1024','横图 · 3:2'],['768x1024','竖图 · 3:4'],['1024x768','横图 · 4:3'],['576x1024','竖屏 · 9:16'],['1024x576','宽屏 · 16:9']].map(([v,label])=>`<option value="${v}" ${d.size===v?'selected':''}>${label}</option>`).join('')}</select></label><span id="pwOperation" class="pw-note">${core.referencesFor(d).length?'图片编辑 · 使用参考图':'文生图 · 无参考图'}</span></div>
            <p class="pw-note">ChatGPT 网页版按画幅要求生成，实际像素尺寸以结果为准。</p>
            <button type="button" id="pwGenerate" class="asset-btn primary pw-generate" data-pw-generate ${d.busy || d.pending || d.uploading || !selected?'disabled':''}>${d.busy?'正在生成…':'生成一张'}</button>
            <div id="pwStatus" class="pw-status" role="status" aria-live="polite" data-error="${d.error}">${escape(d.status)}</div>
            ${d.pending?`${d.pending.taskId?'<button class="asset-btn" type="button" data-pw-resume>重新检查上次任务</button>':''}<button class="asset-btn" type="button" data-pw-dismiss ${d.busy?'disabled':''}>已核对生图历史，结束状态跟踪</button><p class="pw-note">结束跟踪不会取消上游任务，也不会重新提交。</p>`:''}
            <details><summary>模板效果预览 · ${escape(core.mode(item))}</summary>${card(item,library)}<label class="asset-btn">上传效果图<input id="pwCoverUpload" type="file" accept="image/*" hidden></label><p class="pw-note">请使用这条模板的实际效果图；也可以将生成结果设为封面。</p></details>
            <div id="pwResults" class="pw-results">${resultsMarkup(d)}</div>
        </div>`;
    }
    function visible(d){ return current === d && document.querySelector('[data-pw-key]')?.dataset.pwKey === d.key; }
    function update(d){
        if(!visible(d)) return;
        document.getElementById('pwStatus').textContent=d.status;
        document.getElementById('pwStatus').dataset.error=String(d.error);
        const button=document.getElementById('pwGenerate');
        button.disabled=d.busy || !!d.pending || d.uploading || !d.options.some(o=>JSON.stringify([o.provider,o.model])===d.model);
        button.textContent=d.busy?'正在生成…':d.uploading?'正在上传…':'生成一张';
        document.getElementById('pwReferences').innerHTML=referenceMarkup(d);
        document.getElementById('pwOperation').textContent=core.referencesFor(d).length?'图片编辑 · 使用参考图':'文生图 · 无参考图';
        document.getElementById('pwResults').innerHTML=resultsMarkup(d);
    }
    async function json(url,options){
        const response=await fetch(url,options);
        let data; try { data=await response.json(); } catch(_){ throw new Error(`接口响应异常（${response.status}）`); }
        if(!response.ok){const error=new Error(typeof data.detail==='string'?data.detail:data.error || `请求失败（${response.status}）`);error.status=response.status;throw error;}
        return data;
    }
    async function generate(d,revision=null){
        if(d.busy || d.uploading || d.pending) return;
        let body;
        try {
            if(revision){
                if(!revision.instruction.trim())throw new Error('请先填写一句修改要求');
                const r=revision.result;
                if(!d.options.some(o=>o.provider===r.provider && o.model===r.model))throw new Error('原结果模型不可用，请用“用这张继续改”重新选择模型');
                body={prompt:core.revisionPrompt(r.prompt,revision.instruction),provider_id:r.provider,model:r.model,size:r.size,n:1,operation:'edit',history_type:'klein',reference_images:[{url:r.url,name:'上一轮结果',kind:'image'}]};
            }else body=requestBody(d);
        } catch(error){ d.status=error.message;d.error=true;update(d);return; }
        d.pending={request:core.clone(body),character:core.clone(revision?revision.result.character || null:d.character || null),source:core.clone(revision?.result.source || d.source),parentResultId:revision?.result.id || d.parentResultId || '',instruction:revision?.instruction || '',createdAt:Date.now()};
        d.busy=true;d.error=false;d.status='正在生成，可切换模板；结果会保留在这条提示词下。';update(d);
        backup(d);await persist(d);
        try {
            const data=await json('/api/canvas-image-tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
            if(!data.task_id)throw new Error('未收到任务编号，请检查历史后再操作');
            d.pending.taskId=data.task_id;backup(d);await persist(d);await poll(d);
        } catch(error){d.busy=false;d.error=true;d.status=error.message+'。提交状态可能未知，请先检查生图历史。';changed(d);paint(d);}
    }
    async function poll(d){
        if(d.polling || !d.pending?.taskId)return;
        d.polling=true;d.busy=true;
        const pending=d.pending;
        try{
            while(d.pending===pending){
                const task=await json('/api/canvas-image-tasks/'+encodeURIComponent(pending.taskId));
                if(task.status==='failed'){d.pending=null;throw new Error(task.error || '生成失败');}
                if(task.status==='succeeded'){
                    const images=task.result?.images;
                    if(!images?.length){d.pending=null;throw new Error('服务没有返回图片');}
                    const body=pending.request;
                    images.forEach((url,index)=>{
                        const id=pending.taskId+':'+index;
                        if(!d.results.some(r=>r.id===id))d.results.unshift({id,url,prompt:body.prompt,provider:body.provider_id,model:body.model,size:body.size,operation:body.operation,references:core.clone(body.reference_images),character:core.clone(pending.character || null),source:pending.source,parentResultId:pending.parentResultId,instruction:pending.instruction,createdAt:pending.createdAt});
                    });
                    d.pending=null;d.status='生成完成，图片与来源已保存。';d.error=false;
                    if(!state.covers[d.key]?.value){try{await setCover(d,d.results[0].url,false);}catch(error){d.status+=' 效果图保存失败：'+error.message;}}
                    break;
                }
                await new Promise(resolve=>setTimeout(resolve,2000));
            }
        }catch(error){d.status=error.message;d.error=true;if(error.status===404)d.status+='；请先检查历史，不会自动重新生成。';}
        finally{d.polling=false;d.busy=false;changed(d);paint(d);}
    }
    async function upload(d,files,asCover=false){
        if(d.uploading) return;
        const images=[...files].filter(f=>f.type.startsWith('image/'));
        if(!images.length) return;
        if(!asCover && core.referencesFor(d).length+images.length>3){d.error=true;d.status='角色设定图与附加参考图合计最多 3 张，请先移除多余图片。';update(d);return;}
        d.uploading=true;d.error=false;d.status='正在上传参考图…';update(d);
        try {
            const form=new FormData(); (asCover?images.slice(0,1):images).forEach(f=>form.append('files',f));
            const data=await json('/api/ai/upload',{method:'POST',body:form});
            const uploaded=(data.files || []).filter(f=>f.url);
            if(!uploaded.length) throw new Error('上传未返回图片');
            if(asCover)await setCover(d,uploaded[0].url);
            else{d.references.push(...uploaded.map(f=>({url:f.url,name:f.name || '参考图'})));d.status='参考图已添加，生成时会使用图片编辑。';}
        } catch(error){d.error=true;d.status=error.message;}
        finally {d.uploading=false;changed(d);update(d);}
    }
    async function setCover(d,url,announce=true){
        if(!core.safeUrl(url))throw new Error('无效的效果图地址');
        await record('covers',d.key,{url,name:d.item.name,updatedAt:Date.now()});
        if(announce){d.status='模板效果图已保存';d.error=false;}
        global.dispatchEvent(new CustomEvent('prompt-workbench-cover'));
    }
    async function recipe(d,action){
        const id=document.getElementById('pwRecipe')?.value;
        const existing=state.recipes[id]?.value;
        try{
            if(action==='apply'){
                if(!existing)throw new Error('请先选择配方');
                Object.assign(d,core.clone(existing.configuration),{recipeId:id});
                d.status='已应用配方，正式模板未修改';d.error=false;changed(d);paint(d);return;
            }
            if(action==='save'){
                const name=document.getElementById('pwRecipeName').value.trim();
                if(!name)throw new Error('请填写配方名称');
                const newId=uid();
                await record('recipes',newId,{key:d.key,name,configuration:core.configuration(d,document.getElementById('pwRecipeRefs').checked),updatedAt:Date.now()});
                d.recipeId=newId;d.status='配方已保存';
            }else{
                if(!existing)throw new Error('请先选择配方');
                await record('recipes',id,action==='delete'?null:{...existing,configuration:core.configuration(d,document.getElementById('pwRecipeRefs').checked),updatedAt:Date.now()});
                d.status=action==='delete'?'配方已删除':'配方已更新';
            }
            d.error=false;paint(d);
        }catch(error){d.status=error.message;d.error=true;update(d);}
    }
    async function save(d){
        if(d.library.readonly || d.saving) return;
        if(!d.text.trim()){d.error=true;d.status='提示词正文不能为空';update(d);return;}
        d.saving=true;
        const text=d.text;
        try {
            const data=await json(`/api/prompt-libraries/items/${encodeURIComponent(d.item.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({library_id:d.library.id,name:d.item.name,positive:text,negative:'',scene:d.item.scene || '',category:d.item.category || 'custom'})});
            d.original=text;d.error=false;d.status='模板正文已保存，变量填写值未写入模板。';
            global.dispatchEvent(new CustomEvent('prompt-workbench-saved',{detail:data.library}));
        } catch(error){d.error=true;d.status=error.message;}
        finally {d.saving=false;changed(d);update(d);}
    }
    async function sendToCanvas(d,r){
        if(r.sending) return;
        r.sending=true;d.error=false;update(d);
        try {
            if(!r.canvasReady){
                if(!r.canvas) r.canvas=(await json('/api/canvases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:d.item.name,kind:'smart',icon:'sparkles'})})).canvas;
                const preview=[...(document.querySelectorAll?.('#pwResults img') || [])].find(image=>image.getAttribute('src')===r.url);
                const [fallbackWidth,fallbackHeight]=r.size.split('x').map(Number);
                const width=preview?.naturalWidth || fallbackWidth || 1024;
                const height=preview?.naturalHeight || fallbackHeight || 1024;
                const fit=400/Math.max(width,height);
                const graph=core.canvasGraph(r,{width,height});
                await json(`/api/canvases/${encodeURIComponent(r.canvas.id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:r.canvas.title,icon:'sparkles',...graph,viewport:{x:0,y:0,scale:1},base_updated_at:r.canvas.updated_at})});
                r.canvasReady=true;
            }
            d.status='图片与本次提示词已放入新画布。';
            if(global.parent!==global) global.parent.postMessage({type:'prompt-workbench-open-canvas',id:r.canvas.id},location.origin);
            else global.open(`/static/smart-canvas.html?id=${encodeURIComponent(r.canvas.id)}`,'_blank','noopener');
        } catch(error){d.status=error.message;d.error=true;}
        finally {r.sending=false;changed(d);update(d);}
    }
    if(typeof document !== 'undefined'){
        document.addEventListener('input',event=>{
            const d=current;if(!d || !event.target.closest('[data-pw-key]'))return;
            if(event.target.id==='pwText'){
                d.text=event.target.value;
                document.getElementById('pwVariables').innerHTML=variableFields(d);
                document.getElementById('pwVariableSection').hidden=!variables(d.text).length;
            }
            if(event.target.dataset.pwVar!==undefined)d.values[event.target.dataset.pwVar]=event.target.value;
            if(event.target.id==='pwTask')d.task=event.target.value;
            if(event.target.dataset.pwRevision!==undefined){const r=d.results[Number(event.target.dataset.pwRevision)];d.revisionInputs[r.id]=event.target.value;}
            document.getElementById('pwPreview').textContent=finalPrompt(d);
            changed(d);
        });
        document.addEventListener('change',event=>{
            const d=current;if(!d || !event.target.closest('[data-pw-key]'))return;
            if(event.target.id==='pwModel'){d.model=event.target.value;try{localStorage.setItem('studio_image_model',d.model);}catch(_){}update(d);}
            if(event.target.id==='pwSize')d.size=event.target.value;
            if(event.target.id==='pwUpload'){upload(d,event.target.files);event.target.value='';}
            if(event.target.id==='pwCoverUpload'){upload(d,event.target.files,true);event.target.value='';}
            if(event.target.id==='pwRecipe')d.recipeId=event.target.value;
            if(event.target.id==='pwCharacter')chooseCharacter(d,characters.find(c=>c.id===event.target.value) || (d.character?.id===event.target.value?d.character:null));
            changed(d);
        });
        document.addEventListener('click',event=>{
            const d=current;const target=event.target;if(!d || !target.closest('[data-pw-key]'))return;
            if(target.closest('[data-pw-generate]'))generate(d);
            if(target.closest('[data-pw-character-refresh]'))loadCharacters().then(()=>paint(d)).catch(error=>{d.status=error.message;d.error=true;update(d);});
            if(target.closest('[data-pw-character-latest]'))loadCharacters().then(()=>{const character=characters.find(c=>c.id===d.character?.id);if(!character)throw Error('该角色已归档，仍可使用当前保存的资料');chooseCharacter(d,character);}).catch(error=>{d.status=error.message;d.error=true;update(d);});
            if(target.closest('[data-pw-save]'))save(d);
            if(target.closest('[data-pw-resume]'))poll(d);
            if(target.closest('[data-pw-dismiss]') && !d.busy){d.pending=null;d.status='已结束状态跟踪';d.error=false;changed(d);paint(d);}
            if(target.closest('[data-pw-recover]')){Object.assign(d,core.clone(d.recovery));delete d.recovery;changed(d);paint(d);}
            for(const action of ['save','apply','update','delete'])if(target.closest(`[data-pw-recipe-${action}]`))recipe(d,action);
            const revise=target.closest('[data-pw-revise]');if(revise){const r=d.results[Number(revise.dataset.pwRevise)];generate(d,{result:r,instruction:d.revisionInputs[r.id] || ''});}
            const cover=target.closest('[data-pw-cover]');if(cover)setCover(d,d.results[Number(cover.dataset.pwCover)].url).catch(error=>{d.status=error.message;d.error=true;update(d);});
            if(target.closest('[data-pw-reset]')){
                d.text=d.original;d.values=Object.create(null);
                document.getElementById('pwText').value=d.text;
                document.getElementById('pwVariables').innerHTML=variableFields(d);
                document.getElementById('pwPreview').textContent=finalPrompt(d);
                document.getElementById('pwVariableSection').hidden=!variables(d.text).length;
                changed(d);
            }
            if(target.closest('[data-pw-none]')){
                variables(d.text).forEach(name=>{if(!String(d.values[name] || '').trim())d.values[name]='none';});
                document.getElementById('pwVariables').innerHTML=variableFields(d);
                document.getElementById('pwPreview').textContent=finalPrompt(d);
                changed(d);
            }
            const remove=target.closest('[data-pw-remove]');if(remove){d.references.splice(Number(remove.dataset.pwRemove),1);changed(d);update(d);}
            const reuse=target.closest('[data-pw-reuse]');if(reuse)continueResult(d.results[Number(reuse.dataset.pwReuse)]);
            const canvas=target.closest('[data-pw-canvas]');if(canvas)sendToCanvas(d,d.results[Number(canvas.dataset.pwCanvas)]);
        });
        document.addEventListener('dragover',event=>{if(event.target.closest('#pwDrop')){event.preventDefault();event.target.closest('#pwDrop').classList.add('drag-over');}});
        document.addEventListener('dragleave',event=>event.target.closest('#pwDrop')?.classList.remove('drag-over'));
        document.addEventListener('drop',event=>{if(event.target.closest('#pwDrop')){event.preventDefault();event.target.closest('#pwDrop').classList.remove('drag-over');upload(current,event.dataTransfer.files);}});
    }
    global.PromptWorkbench={render:renderWorkbench,variables,resolve,requestBody,modelOptions,load,loadCharacters,characterWorks,continueResult,updateCharacter:character=>{if(current?.character?.id===character.id)chooseCharacter(current,character);},card,branchLibrary};
})(typeof window==='undefined'?globalThis:window);
