(function(){
    'use strict';
    const $=id=>document.getElementById(id), workbench=PromptWorkbench, core=PromptCreation;
    const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let characters=[],libraries=[],providers=[],selected='',editing=null,uploading=false,saving=false,works=[];
    let remembered={};try{remembered=JSON.parse(localStorage.getItem('character-workbench-selection') || '{}');selected=remembered.character || '';}catch(_){}
    const profile=()=>characters.find(c=>c.id===selected);
    const status=text=>{$('characterStatus').textContent=text;};
    async function json(url,options){const response=await fetch(url,options);const data=await response.json();if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'请求失败，请检查填写内容');return data;}
    const body=value=>({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
    async function canLeave(){return !editing || await CreationFlow.confirmReplace('尚未保存角色资料，是否放弃这次修改？');}
    async function load(){
        status('正在加载…');
        const [roles,prompts,api]=await Promise.all([json('/api/characters?include_archived=true'),json('/api/prompt-libraries'),json('/api/providers'),workbench.load(true),workbench.loadCharacters()]);
        characters=roles.characters;libraries=prompts.library.libraries;providers=api.providers || [];
        if(!profile())selected=characters.find(c=>!c.archived)?.id || '';
        renderTemplates();render();status('准备就绪');
    }
    let templateSelectionInitialized=false;
    function matchesTemplate(item,query,purpose){
        const mode=core.mode(item),wanted={generate:'文生图',edit:'需要参考图',free:'自由创作'}[purpose];
        return (!wanted || mode===wanted) && [item.name,item.scene,item.positive].join(' ').toLowerCase().includes(query.toLowerCase());
    }
    function renderTemplates(){
        const previous=templateSelectionInitialized?$('characterTemplate').value:(remembered.template || '');
        templateSelectionInitialized=true;
        const query=$('characterTemplateSearch')?.value.trim() || '',purpose=$('characterTemplatePurpose')?.value || '';
        let count=0;
        const groups=libraries.map(lib=>{
            const items=lib.items.filter(item=>matchesTemplate(item,query,purpose));count+=items.length;
            return items.length?`<optgroup label="${escape(lib.name)}">${items.map(item=>`<option value="${escape(JSON.stringify([lib.id,item.id]))}">${escape(item.name)}</option>`).join('')}</optgroup>`:'';
        }).join('');
        $('characterTemplate').innerHTML='<option value="">自由创作 · 直接填写本次任务</option>'+groups;
        const selectedItem=libraries.flatMap(lib=>lib.items.map(item=>({lib,item}))).find(({lib,item})=>JSON.stringify([lib.id,item.id])===previous);
        if(selectedItem && ![...$('characterTemplate').options].some(option=>option.value===previous)){
            const option=new Option('当前模板：'+selectedItem.item.name,previous);$('characterTemplate').add(option);
        }
        $('characterTemplate').value=selectedItem?previous:'';
        if($('characterTemplateCount'))$('characterTemplateCount').textContent=count?`${count} 个可选模板`:'没有匹配模板，可清空筛选或直接自由创作。';
    }
    function renderList(){
        const query=$('characterSearch').value.toLowerCase();
        const shown=characters.filter(c=>($('characterArchived').checked || !c.archived) && (c.name+' '+c.description).toLowerCase().includes(query));
        $('characterList').innerHTML=shown.map(c=>`<button class="character-entry ${selected===c.id?'active':''}" data-character="${escape(c.id)}"><img src="${escape(core.safeUrl(c.cover))}" alt=""><span>${escape(c.name)}<small>${c.archived?'已归档':c.references.length+' 张设定图'}</small></span></button>`).join('') || '<p class="character-empty">还没有匹配的角色。点击「新建」，上传设定图即可开始。</p>';
    }
    function refsMarkup(){return editing.references.map((ref,i)=>`<div class="character-ref-row"><a href="${escape(core.safeUrl(ref.url))}" target="_blank" rel="noopener"><img src="${escape(core.safeUrl(ref.url))}" alt="设定图 ${i+1}"></a><button class="asset-btn" type="button" data-character-cover="${i}">${editing.cover===ref.url?'当前封面':'设为封面'}</button><button class="asset-btn" type="button" data-character-remove="${i}">移除</button></div>`).join('');}
    function renderProfile(){
        const c=profile();
        if(editing){
            $('characterProfile').innerHTML=`<div class="panel-head"><strong>${editing.id?'编辑角色':'新建角色'}</strong><button class="asset-btn" data-character-cancel>取消</button></div><div class="character-profile-body"><form id="characterForm" class="character-profile-form"><label>角色名称<input id="characterName" maxlength="120" required value="${escape(editing.name)}" placeholder="例如：绯栞"></label><button class="character-upload" id="characterDrop" type="button" aria-describedby="characterUploadHint" ${uploading?'disabled':''}>＋ 上传完整设定图 / 三视图</button><input id="characterUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden><p id="characterUploadHint" class="pw-note">至少 1 张，最多 3 张。可以直接使用带角色介绍的整张设计图。</p><div id="characterRefs">${refsMarkup()}</div><label>背景介绍（选填）<textarea id="characterDescription" maxlength="20000" placeholder="身份、性格、外貌识别特征……也可以留空，让模型参考设定图。">${escape(editing.description)}</textarea></label><button id="characterSave" class="asset-btn primary" ${uploading||saving?'disabled':''}>${uploading?'上传中…':'保存角色'}</button></form></div>`;return;
        }
        $('characterProfile').innerHTML=c?`<div class="panel-head"><strong>角色资料</strong><div class="panel-actions"><button class="asset-btn" data-character-edit>编辑</button><button class="asset-btn" data-character-archive>${c.archived?'恢复角色':'归档'}</button></div></div><div class="character-profile-body"><h2>${escape(c.name)}</h2><a href="${escape(core.safeUrl(c.cover))}" target="_blank" rel="noopener"><img class="character-cover" src="${escape(core.safeUrl(c.cover))}" alt="${escape(c.name)} 设定图"></a><div class="pw-reference-list">${c.references.filter(r=>r.url!==c.cover).map(r=>`<a href="${escape(core.safeUrl(r.url))}" target="_blank" rel="noopener"><img width="75" height="90" style="object-fit:contain" src="${escape(core.safeUrl(r.url))}" alt="补充设定图"></a>`).join('')}</div><p>${escape(c.description || '暂无额外介绍，生成时使用设定图中的角色信息。')}</p><p class="pw-note">${c.archived?'已归档；历史作品和图片仍保留。':'直接填写本次任务开始创作，也可以选一个模板。'}</p></div>`:'<div class="character-empty">给角色建一份档案<br>一张设定图＋一个名字，就能反复搭配不同的风格、场景和姿势模板。</div>';
    }
    function selectedTemplate(){
        const free={library:{id:'character-free',name:'角色自由创作',readonly:true},item:{id:'free',name:'自由创作',positive:'',scene:'直接描述本次任务，无需先选模板。'}};
        let ids;try{ids=JSON.parse($('characterTemplate').value);}catch(_){return free;}
        const library=libraries.find(l=>l.id===ids[0]);const item=library?.items.find(i=>i.id===ids[1]);
        return item?{library,item}:free;
    }
    function renderWorkbench(override){
        const c=profile(),template=override || selectedTemplate();
        if(!c || c.archived || !template){$('characterWorkbench').innerHTML='<div class="character-empty">先选择或新建角色，即可填写任务开始创作。<br>提示词模板是可选项。</div>';return;}
        try{localStorage.setItem('character-workbench-selection',JSON.stringify({character:selected,template:$('characterTemplate').value}));}catch(_){}
        const key=template.item.workbench_key || JSON.stringify([template.library.id,template.item.id]);
        const item={...template.item,workbench_key:JSON.stringify(['character',c.id,key]),character_context:c};
        const content=[item.positive,item.negative?'负向提示词：\n'+item.negative:''].filter(Boolean).join('\n\n');
        $('characterWorkbench').innerHTML=workbench.render(item,template.library,content,providers);
    }
    function renderWorks(){
        works=selected?workbench.characterWorks(selected):[];
        $('characterWorks').innerHTML=works.map((r,i)=>`<figure class="character-work"><a href="${escape(core.safeUrl(r.url))}" target="_blank" rel="noopener"><img loading="lazy" src="${escape(core.safeUrl(r.url))}" alt="${escape(r.character?.name)} 的作品"></a><figcaption>${escape(r.source?.name || '创作模板')} · ${escape(r.model)}</figcaption><button class="asset-btn" data-character-continue="${i}">用这张继续改</button><div class="pw-row"><button class="asset-btn" data-character-result-action="editor" data-result-index="${i}">图片编辑</button><button class="asset-btn" data-character-result-action="asset" data-result-index="${i}">保存素材</button><button class="asset-btn" data-character-result-action="canvas" data-result-index="${i}">加入画布</button></div><details><summary>生成来源</summary><p class="pw-note">${escape(r.character?.name)} · ${escape(new Date(r.createdAt).toLocaleString())}</p><pre>${escape(r.prompt)}</pre></details></figure>`).join('') || '<p class="character-empty">这个角色还没有作品。生成完成后会自动出现在这里。</p>';
    }
    function render(){renderList();renderProfile();renderWorkbench();renderWorks();}
    async function upload(files){
        if(!editing || uploading)return;
        const images=[...files].filter(f=>f.type.startsWith('image/'));
        if(!images.length)return;
        if(editing.references.length+images.length>3){status('设定图最多 3 张，请先移除多余图片');return;}
        uploading=true;$('characterSave').disabled=true;$('characterDrop').disabled=true;status('正在上传设定图…');
        try{const form=new FormData();images.forEach(f=>form.append('files',f));const data=await json('/api/ai/upload',{method:'POST',body:form});const refs=(data.files || []).map(f=>({url:f.url,name:f.name || '设定图'}));if(!refs.length)throw Error('上传未返回图片');editing.references.push(...refs);if(!editing.cover)editing.cover=refs[0].url;$('characterRefs').innerHTML=refsMarkup();status('设定图已上传，保存后即可使用');}
        catch(error){status(error.message);}finally{uploading=false;if($('characterSave'))$('characterSave').disabled=false;if($('characterDrop'))$('characterDrop').disabled=false;}
    }
    $('characterSearch').oninput=renderList;$('characterArchived').onchange=renderList;
    $('characterNew').onclick=async()=>{if(uploading||saving||(editing && !await canLeave()))return;editing={name:'',description:'',references:[],cover:'',revision:0};renderProfile();};
    $('characterRefresh').onclick=async()=>{if(uploading||saving||(editing && !await canLeave()))return;editing=null;load().catch(e=>status(e.message));};
    $('characterTemplate').onchange=()=>renderWorkbench();
    $('characterTemplateSearch').oninput=renderTemplates;
    $('characterTemplatePurpose').onchange=renderTemplates;
    $('characterFreeCreate').onclick=()=>{$('characterTemplate').value='';renderWorkbench();$('pwTask')?.focus();};
    document.addEventListener('input',event=>{if(!editing)return;if(event.target.id==='characterName')editing.name=event.target.value;if(event.target.id==='characterDescription')editing.description=event.target.value;});
    document.addEventListener('change',event=>{
        if(event.target.id!=='characterUpload')return;
        const files=[...event.target.files];
        event.target.value=''; // 失败或超出数量后仍可重新选择同一个文件。
        upload(files);
    });
    document.addEventListener('submit',async event=>{
        if(event.target.id!=='characterForm')return;event.preventDefault();if(saving||uploading)return;
        if(!editing.name.trim() || !editing.references.length){status('请填写角色名称并添加至少一张设定图');return;}
        saving=true;$('characterSave').disabled=true;
        try{const data=await json('/api/characters'+(editing.id?'/'+editing.id:''),{...body(editing),method:editing.id?'PUT':'POST'});selected=data.character.id;editing=null;await load();workbench.updateCharacter(data.character);status('角色已保存，填写任务即可创作');}
        catch(error){status(error.message);}finally{saving=false;if($('characterSave'))$('characterSave').disabled=false;}
    });
    document.addEventListener('click',async event=>{
        const t=event.target;const entry=t.closest('[data-character]');
        const resultAction=t.closest('[data-character-result-action]');
        if(resultAction){
            const result=works[Number(resultAction.dataset.resultIndex)];if(!result)return;
            resultAction.disabled=true;
            try{
                if(resultAction.dataset.characterResultAction==='editor')await CreationFlow.toEditor({...core.clone(result),parentResultId:result.id,references:[{url:result.url,name:'上一轮结果',kind:'image'}]});
                else if(resultAction.dataset.characterResultAction==='asset')await CreationFlow.saveAsset(result);
                else await CreationFlow.toCanvas(result);
            }catch(error){status(error.message);}finally{resultAction.disabled=false;}
            return;
        }
        if(t.closest('#characterDrop') && editing && !uploading && !saving)$('characterUpload').click();
        if(entry){if(uploading||saving||(editing && !await canLeave()))return;selected=entry.dataset.character;editing=null;render();}
        if(t.closest('[data-character-edit]')){editing=core.clone(profile());renderProfile();}
        if(t.closest('[data-character-cancel]') && !uploading && !saving && await canLeave()){editing=null;renderProfile();}
        const remove=t.closest('[data-character-remove]');if(remove && editing && !uploading){editing.references.splice(Number(remove.dataset.characterRemove),1);if(!editing.references.some(r=>r.url===editing.cover))editing.cover=editing.references[0]?.url || '';$('characterRefs').innerHTML=refsMarkup();}
        const cover=t.closest('[data-character-cover]');if(cover && editing){editing.cover=editing.references[Number(cover.dataset.characterCover)].url;$('characterRefs').innerHTML=refsMarkup();}
        if(t.closest('[data-character-archive]')){try{await json('/api/characters/'+selected,body({...profile(),archived:!profile().archived}));await load();status('已更新归档状态，作品和图片仍保留');}catch(error){status(error.message);}}
        const reuse=t.closest('[data-character-continue]');if(reuse){
            const r=works[Number(reuse.dataset.characterContinue)];if(profile()?.archived){status('请先恢复角色，再继续创作');return;}
            let library=libraries.find(l=>l.id===r.source?.libraryId),item=library?.items.find(i=>i.id===r.source?.itemId);
            if(!item){library=libraries.find(l=>l.items.some(i=>i.id===r.source?.itemId));item=library?.items.find(i=>i.id===r.source?.itemId);}
            if(item){$('characterTemplate').value=JSON.stringify([library.id,item.id]);renderWorkbench();}
            else{renderWorkbench({library:{id:'character-results',readonly:true},item:{id:r.id,name:r.source?.name || '作品分支',positive:r.prompt}});}
            workbench.continueResult(r);$('characterWorkbench').scrollIntoView({block:'center',behavior:'smooth'});
        }
    });
    document.addEventListener('dragover',e=>{if(e.target.closest('#characterDrop')){e.preventDefault();e.target.closest('#characterDrop').classList.add('drag-over');}});
    document.addEventListener('dragleave',e=>e.target.closest('#characterDrop')?.classList.remove('drag-over'));
    document.addEventListener('drop',e=>{if(e.target.closest('#characterDrop')){e.preventDefault();e.target.closest('#characterDrop').classList.remove('drag-over');upload(e.dataTransfer.files);}});
    window.addEventListener('beforeunload',event=>{if(editing){event.preventDefault();event.returnValue='';}});
    window.addEventListener('character-works-changed',renderWorks);
    window.addEventListener('prompt-workbench-providers',event=>{providers=event.detail || [];});
    window.addEventListener('prompt-workbench-saved',e=>{libraries=e.detail.libraries;renderTemplates();});
    window.addEventListener('message',e=>{if(e.origin===location.origin && e.data?.type==='characters-focus' && !editing)load().catch(error=>status(error.message));});
    load().catch(error=>status('加载失败：'+error.message));
})();
