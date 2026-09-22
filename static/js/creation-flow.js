(function(global){
    'use strict';
    const core=global.PromptCreation;
    const routes={klein:'/static/klein.html',zimage:'/static/online.html',prompts:'/static/asset-manager.html#prompts','api-settings':'/static/api-settings.html'};
    const KEY='studio_creation_handoff_v1', TTL=60*60*1000;
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const clone=value=>JSON.parse(JSON.stringify(value));
    const uuid=()=>global.crypto.randomUUID();
    const variables=text=>[...new Set([...String(text||'').matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map(m=>m[1].trim()))];
    function provenance(result={}){
        const r={...(result.provenance||{}),...result};
        const string=(value,max=20000)=>typeof value==='string'?value.slice(0,max):'';
        const refs=items=>(Array.isArray(items)?items:[]).filter(i=>i&&core.safeUrl(i.url)).slice(0,100).map(i=>({url:core.safeUrl(i.url),name:string(i.name,300)}));
        const c=r.character, s=r.source;
        return {version:1,resultId:string(r.id||r.resultId,200),parentResultId:string(r.parentResultId,200),prompt:string(r.prompt,100000),model:string(r.model,300),provider:string(r.provider,200),size:string(r.size,100),quality:string(r.quality,100),n:Number(r.n)||1,operation:string(r.operation,100),instruction:string(r.instruction),createdAt:Number(r.createdAt)||0,references:refs(r.references),character:c?{id:string(c.id,200),name:string(c.name,300),description:string(c.description),revision:Number(c.revision)||0,cover:core.safeUrl(c.cover),references:refs(c.references)}:null,source:s?{libraryId:string(s.libraryId,200),itemId:string(s.itemId,200),name:string(s.name,300),canvasId:string(s.canvasId,200),nodeId:string(s.nodeId,200)}:null};
    }
    async function request(url,options={}){
        const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
        const data=await response.json();
        if(!response.ok)throw new Error(response.status===409?'内容已在其他页面更新，请重新选择后再试。':typeof data.detail==='string'?data.detail:data.detail?.message||'操作失败，请重试');
        return data;
    }
    function modal(title,content){
        if(!document.querySelector('link[data-creation-flow-style]')){
            const link=document.createElement('link');link.rel='stylesheet';link.href='/static/css/creation-flow.css?v=2026.09.22.flow-1';link.dataset.creationFlowStyle='';document.head.append(link);
        }
        const before=document.activeElement, dialog=document.createElement('dialog');
        dialog.className='creation-flow-dialog';
        const heading='creation-flow-'+uuid();dialog.setAttribute('aria-labelledby',heading);
        dialog.innerHTML=`<header><h2 id="${heading}">${esc(title)}</h2><button type="button" data-close aria-label="关闭">×</button></header><div class="creation-flow-body">${content}</div><p class="creation-flow-status" role="status" aria-live="polite"></p>`;
        document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();
        dialog.addEventListener('close',()=>{dialog.remove();if(before?.isConnected)before.focus();},{once:true});
        dialog.showModal();return dialog;
    }
    function status(dialog,text){dialog.querySelector('[role=status]').textContent=text;}
    function confirmReplace(message){return new Promise(resolve=>{
        const d=modal('保留当前创作？',`<p>${esc(message)}</p><footer><button type="button" data-keep autofocus>保留当前内容</button><button type="button" data-replace>使用新内容</button></footer>`);
        let accepted=false;d.querySelector('[data-keep]').onclick=()=>d.close();d.querySelector('[data-replace]').onclick=()=>{accepted=true;d.close();};d.addEventListener('close',()=>resolve(accepted),{once:true});
    });}
    function publish(target,payload){
        if(!Object.hasOwn(routes,target))throw new Error('不支持的创作入口');
        sessionStorage.setItem(KEY,JSON.stringify({id:uuid(),target,payload,createdAt:Date.now()}));
        if(global.parent!==global)global.parent.postMessage({type:'creation-flow-open',target},location.origin);
        else if(location.pathname===routes[target].split('#')[0])global.postMessage({type:'creation-flow-ready'},location.origin);else location.assign(routes[target]);
    }
    function pending(target){
        try{
            let raw=JSON.parse(sessionStorage.getItem(KEY)||'null');
            const legacy=JSON.parse(sessionStorage.getItem('studio_prompt_handoff')||'null');
            if(legacy?.target===target&&(!raw||legacy.createdAt>raw.createdAt)){
                raw={id:uuid(),target,payload:{prompt:String(legacy.prompt||''),references:legacy.image&&core.safeUrl(legacy.image.url)?[legacy.image]:[]},createdAt:legacy.createdAt};
                sessionStorage.setItem(KEY,JSON.stringify(raw));sessionStorage.removeItem('studio_prompt_handoff');
            }
            if(!raw)return null;if(!raw.createdAt||Date.now()-raw.createdAt>TTL||raw.createdAt>Date.now()+60000){sessionStorage.removeItem(KEY);return null;}return raw.target===target&&raw.payload&&typeof raw.payload==='object'?raw:null;
        }catch{return null;}
    }
    function listen(target,handler){
        let busy=false, retry=null, attempted='';
        const consume=async(force=false)=>{
            const entry=pending(target);if(!entry||busy||(!force&&attempted===entry.id))return;
            busy=true;attempted=entry.id;
            try{
                if(await handler(clone(entry.payload))===true){if(pending(target)?.id===entry.id)sessionStorage.removeItem(KEY);retry?.remove();retry=null;}
                else showRetry('有待接收的创作内容，点击后重新选择');
            }catch(error){showRetry('创作内容尚未接收：'+error.message);}
            finally{busy=false;const next=pending(target);if(next&&next.id!==attempted)queueMicrotask(()=>consume());}
        };
        const showRetry=text=>{
            if(!retry){retry=document.createElement('button');retry.type='button';retry.className='creation-flow-retry';retry.style.cssText='position:fixed;right:20px;bottom:16px;z-index:2000;padding:10px 16px;border:1px solid #94a3b8;border-radius:12px;background:#fff;color:#0f172a;max-width:calc(100vw - 40px)';retry.onclick=()=>consume(true);document.body.append(retry);}retry.textContent=text;
        };
        const onMessage=event=>{if(event.origin===location.origin&&event.source===global.parent&&['creation-flow-ready','prompt-handoff-ready'].includes(event.data?.type))consume();};
        global.addEventListener('message',onMessage);
        if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>consume(),{once:true});else queueMicrotask(()=>consume());
        return ()=>{global.removeEventListener('message',onMessage);retry?.remove();};
    }
    async function pickReference(options={}){
        const onlyCharacters=options.kind==='character'||options.charactersOnly;
        const d=modal(onlyCharacters?'选择角色':'选择角色或素材',`<label>搜索<input type="search" placeholder="按名称搜索" data-search></label><div class="creation-flow-tabs">${onlyCharacters?'':'<button type="button" data-kind="characters" aria-pressed="true">角色</button><button type="button" data-kind="assets" aria-pressed="false">素材图片</button>'}</div><div class="creation-flow-grid" data-list></div>`);
        let chosen=null,kind='characters',characters=[],assets=[];
        const done=new Promise(resolve=>d.addEventListener('close',()=>resolve(chosen),{once:true}));
        const render=()=>{
            const q=d.querySelector('[data-search]').value.toLocaleLowerCase(), rows=(kind==='characters'?characters:assets).filter(r=>(r.name||'').toLocaleLowerCase().includes(q));
            d.querySelector('[data-list]').innerHTML=rows.slice(0,120).map((row,i)=>`<button type="button" class="creation-flow-choice" data-index="${i}">${core.safeUrl(row.cover||row.url||row.references?.[0]?.url)?`<img src="${esc(core.safeUrl(row.cover||row.url||row.references?.[0]?.url))}" alt="" loading="lazy">`:''}<strong>${esc(row.name||'未命名')}</strong><span>${kind==='characters'?`${row.references?.length||0} 张设定图`:esc(row.location||'素材图片')}</span></button>`).join('')||'<p>没有可选择的内容。可先在角色页创建角色，或在素材库保存图片。</p>';
            d.querySelectorAll('[data-index]').forEach(button=>button.onclick=()=>{const r=rows[Number(button.dataset.index)];chosen=kind==='characters'?{character:clone(r),references:clone(r.references||[]),provenance:{character:clone(r)}}:{character:null,references:[{url:r.url,name:r.name||'素材图片',...(r.provenance?{provenance:clone(r.provenance)}:{})}],provenance:r.provenance?clone(r.provenance):null};d.close();});
            if(rows.length>120)status(d,`共 ${rows.length} 项，请搜索缩小范围（当前显示 120 项）`);else status(d,'');
        };
        d.querySelector('[data-search]').oninput=render;
        d.querySelectorAll('[data-kind]').forEach(button=>button.onclick=()=>{kind=button.dataset.kind;d.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();});
        status(d,'正在读取角色与素材…');
        const results=await Promise.allSettled([request('/api/characters'),onlyCharacters?Promise.resolve({library:{}}):request('/api/asset-library')]);
        if(!d.isConnected)return done;
        characters=(results[0].status==='fulfilled'?results[0].value.characters||[]:[]).filter(c=>!c.archived);
        if(results[1].status==='fulfilled'){
            const lib=results[1].value.library||{};
            for(const l of lib.libraries||[])for(const c of l.categories||[])if(c.type==='image')for(const item of c.items||[])if(core.safeUrl(item.url))assets.push({...item,location:`${l.name} / ${c.name}`});
            for(const c of lib.categories||[])if(c.type==='image')for(const item of c.items||[])if(core.safeUrl(item.url)&&!assets.some(a=>a.url===item.url))assets.push({...item,location:c.name});
        }
        render();if(results.some(r=>r.status==='rejected'))status(d,'部分内容读取失败，请关闭后重试。已读取的内容仍可选择。');
        return done;
    }
    function appendGraph(canvas,graph,namespace=uuid()){
        const nodes=clone(canvas.nodes||[]),connections=clone(canvas.connections||[]);
        const offset=nodes.length?Math.max(...nodes.map(n=>(Number(n.x)||0)+(Number(n.w)||320)))+160:0;
        const ids=new Map(graph.nodes.map(n=>[n.id,`${namespace}-${n.id}`]));
        return {title:canvas.title,icon:canvas.icon,nodes:[...nodes,...graph.nodes.map(n=>({...clone(n),id:ids.get(n.id),x:(Number(n.x)||0)+offset}))],connections:[...connections,...graph.connections.map(c=>({...clone(c),...(c.id?{id:`${namespace}-${c.id}`} :{}),from:ids.get(c.from),to:ids.get(c.to)}))],viewport:clone(canvas.viewport||{x:0,y:0,scale:1}),logs:clone(canvas.logs||[]),settings:clone(canvas.settings||{}),base_updated_at:canvas.updated_at||0};
    }
    async function imageDimensions(result){
        if(Number(result.natural_w)>0&&Number(result.natural_h)>0)return {width:Number(result.natural_w),height:Number(result.natural_h)};
        const size=String(result.size||'').match(/^(\d+)x(\d+)$/);
        const fallback={width:Number(size?.[1])||1024,height:Number(size?.[2])||1024};
        return new Promise(resolve=>{
            const image=new Image();const timer=setTimeout(()=>{image.onload=image.onerror=null;resolve(fallback);},8000);
            image.onload=()=>{clearTimeout(timer);resolve({width:image.naturalWidth||fallback.width,height:image.naturalHeight||fallback.height});};
            image.onerror=()=>{clearTimeout(timer);resolve(fallback);};image.src=result.url;
        });
    }
    async function toCanvas(result){
        if(!core.safeUrl(result.url))throw new Error('没有可加入画布的结果图片');
        const d=modal('加入智能画布','<p>会加入结果、提示词与参考图，不会自动生成图片。</p><label>目标画布<select data-canvas><option value="">新建智能画布</option></select></label><footer><button type="button" data-submit disabled>加入画布</button></footer>');
        let resultValue=null,created=null;
        const done=new Promise(resolve=>d.addEventListener('close',()=>resolve(resultValue),{once:true}));
        try{const data=await request('/api/canvases');for(const c of data.canvases||[])if(c.kind==='smart'){const o=document.createElement('option');o.value=c.id;o.textContent=c.title||'未命名画布';d.querySelector('select').append(o);}}catch(error){status(d,`已有画布读取失败：${error.message}。仍可新建。`);}
        if(!d.isConnected)return done;
        const button=d.querySelector('[data-submit]');button.disabled=false;
        button.onclick=async()=>{
            button.disabled=true;d.querySelector('select').disabled=true;d.querySelector('[data-close]').disabled=true;const cancel=e=>e.preventDefault();d.addEventListener('cancel',cancel);
            try{
                const id=d.querySelector('select').value;
                const canvas=id?(await request('/api/canvases/'+encodeURIComponent(id))).canvas:created||(await request('/api/canvases',{method:'POST',body:JSON.stringify({title:result.source?.name||'创作结果',kind:'smart',icon:'sparkles'})})).canvas;
                if(!id)created=canvas;
                if(canvas.kind!=='smart')throw new Error('请选择智能画布');
                const meta=provenance(result);const graph=core.canvasGraph({...meta,id:meta.resultId,url:result.url},await imageDimensions(result));
                await request('/api/canvases/'+encodeURIComponent(canvas.id),{method:'PUT',body:JSON.stringify(appendGraph(canvas,graph))});
                resultValue={id:canvas.id};d.close();
                if(global.parent!==global)global.parent.postMessage({type:'prompt-workbench-open-canvas',id:canvas.id},location.origin);else location.assign('/static/smart-canvas.html?id='+encodeURIComponent(canvas.id));
            }catch(error){status(d,error.message);button.disabled=false;d.querySelector('select').disabled=!!created;}
            finally{d.querySelector('[data-close]').disabled=false;d.removeEventListener('cancel',cancel);}
        };return done;
    }
    async function toWorkbench(result){
        const meta=provenance(result),id=uuid();
        const value={branchName:`${meta.source?.name||result.name||'创作结果'} · 分支`,text:meta.prompt,original:meta.prompt,values:{},task:'',references:[{url:result.url,name:result.name||'上一轮结果'}],model:meta.provider&&meta.model?JSON.stringify([meta.provider,meta.model]):'',size:meta.size||'1024x1024',results:[],revisionInputs:{},parentResultId:meta.resultId,character:meta.character,useCharacterReferences:false,source:meta.source,updatedAt:Date.now()};
        await request('/api/prompt-workbench/drafts/'+encodeURIComponent(JSON.stringify(['workbench_branches',id])),{method:'PUT',body:JSON.stringify({value,revision:0})});
        publish('prompts',{branchId:id});
        return {id};
    }
    async function saveAsset(result){
        if(!core.safeUrl(result.url))throw new Error('没有可保存的图片');
        const d=modal('保存到素材库',`<label>图片名称<input data-name maxlength="100" value="${esc(result.name||result.source?.name||'创作结果')}"></label><label>保存位置<select data-category></select></label><footer><button type="button" data-submit disabled>保存素材</button></footer>`);
        let saved=null;const done=new Promise(resolve=>d.addEventListener('close',()=>resolve(saved),{once:true}));
        try{
            const data=await request('/api/asset-library'),locations=[];
            for(const l of data.library?.libraries||[])for(const c of l.categories||[])if(c.type==='image')locations.push({library_id:l.id,category_id:c.id,name:`${l.name} / ${c.name}`});
            for(const c of data.library?.categories||[])if(c.type==='image'&&!locations.some(l=>l.category_id===c.id))locations.push({category_id:c.id,name:c.name});
            if(!d.isConnected)return done;
            d.querySelector('select').innerHTML=locations.map((l,i)=>`<option value="${i}">${esc(l.name)}</option>`).join('');
            if(!locations.length){status(d,'请先在素材库创建图片分类，再保存到该分类。');return done;}
            const button=d.querySelector('[data-submit]');button.disabled=false;
            button.onclick=async()=>{
                const destination=locations[Number(d.querySelector('select').value)];button.disabled=true;d.querySelector('[data-close]').disabled=true;const cancel=e=>e.preventDefault();d.addEventListener('cancel',cancel);
                try{const data=await request('/api/asset-library/items',{method:'POST',body:JSON.stringify({library_id:destination.library_id,category_id:destination.category_id,url:result.url,name:d.querySelector('[data-name]').value.trim()||'创作结果',provenance:provenance(result)})});saved=data.item;status(d,'已保存，可在素材库继续编辑或加入画布。');button.textContent='已保存';}
                catch(error){status(d,error.message);button.disabled=false;}
                finally{d.querySelector('[data-close]').disabled=false;d.removeEventListener('cancel',cancel);}
            };
        }catch(error){status(d,error.message);}return done;
    }
    global.CreationFlow={pickReference,toEditor:payload=>publish('klein',payload),toCanvas,toWorkbench,saveAsset,configureModels:()=>{if(global.parent!==global)global.parent.postMessage({type:'creation-flow-open',target:'api-settings'},location.origin);else location.assign(routes['api-settings']);},openPrompts:payload=>publish('prompts',payload||{}),listen,variables,confirmReplace,provenance,appendGraph};
})(typeof window==='undefined'?globalThis:window);
