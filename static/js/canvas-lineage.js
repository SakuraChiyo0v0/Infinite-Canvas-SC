(function(global){
    'use strict';
    const clone=value=>JSON.parse(JSON.stringify(value));
    function variables(text){return [...new Set([...String(text || '').matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map(m=>m[1].trim()))];}
    function assertPrompt(text){
        const missing=variables(text);
        if(missing.length)throw Error(`请先填写提示词变量：${missing.join('、')}（不适用可填 none），再运行。`);
    }
    function enrich(refs,nodes=[]){
        return (refs || []).map(ref=>{
            if(ref.provenance)return clone(ref);
            const matches=nodes.filter(node=>!ref.nodeId || node.id===ref.nodeId).flatMap(node=>(node.images || []).filter(img=>img.url===ref.url).map(img=>img.provenance || node.provenance).filter(Boolean));
            const distinct=[...new Map(matches.map(meta=>[JSON.stringify(meta),meta])).values()];
            return distinct.length===1?{...ref,provenance:clone(distinct[0])}:{...ref};
        });
    }
    function candidates(refs,source=null){
        const found=[];
        for(const ref of refs || []){
            const meta=ref.provenance;
            if(!meta || !(meta.resultId || meta.character?.id || meta.source))continue;
            const key=JSON.stringify([meta.resultId || '',meta.character?.id || '',meta.source || null]);
            if(!found.some(item=>item.key===key))found.push({key,label:[meta.character?.name,ref.name || meta.source?.name || '参考图'].filter(Boolean).join(' · '),meta});
        }
        if(!found.length && source)found.push({key:'template',label:source.name || '当前模板',meta:{source}});
        return found;
    }
    function fromCandidate(candidate){
        const meta=candidate?.meta;
        return meta?clone({parentResultId:meta.resultId || '',character:meta.character || null,source:meta.source || null}):{parentResultId:'',character:null,source:null};
    }
    async function choose(refs,source=null){
        const options=candidates(refs,source);
        if(options.length<2)return fromCandidate(options[0]);
        return new Promise(resolve=>{
            const dialog=document.createElement('dialog');dialog.className='canvas-lineage-dialog';
            const heading=document.createElement('h2');heading.textContent='选择本次创作来源';
            const note=document.createElement('p');note.textContent='这些参考图来自不同作品或角色。请选择本次沿用的角色与父作品；全部参考图仍会参与生成。也可以不关联身份，或取消运行。';
            const select=document.createElement('select');select.setAttribute('aria-label','本次沿用的来源');
            const empty=document.createElement('option');empty.value='';empty.textContent='请选择来源';select.append(empty);
            options.forEach((option,i)=>{const el=document.createElement('option');el.value=String(i);el.textContent=option.label;select.append(el);});
            const none=document.createElement('option');none.value='none';none.textContent='多图合成，不关联单一角色或父作品';select.append(none);
            const confirm=document.createElement('button');confirm.type='button';confirm.textContent='使用此来源并继续';confirm.disabled=true;
            const cancel=document.createElement('button');cancel.type='button';cancel.textContent='取消运行';
            let result=null;
            select.onchange=()=>confirm.disabled=select.value==='';
            confirm.onclick=()=>{if(select.value==='')return;result=fromCandidate(select.value==='none'?null:options[Number(select.value)]);dialog.close();};
            cancel.onclick=()=>dialog.close();
            dialog.append(heading,note,select,confirm,cancel);document.body.append(dialog);
            dialog.addEventListener('close',()=>{dialog.remove();resolve(result);},{once:true});dialog.showModal();select.focus();
        });
    }
    function compose(prompt,lineage){
        const character=lineage?.character;
        if(!character?.id)return prompt;
        return `本次明确选定的角色：${character.name || ''}\n${character.description || ''}\n依据所选角色的设定图或上轮作品保持角色身份；其他参考图仅按本次要求使用，不替换角色身份。\n\n本次要求：\n${prompt}`;
    }
    function result(meta,url){
        const config=meta.settings || {},lineage=meta.lineage || {};
        const references=meta.inputRefs || meta.promptRefs || [];
        return clone({version:1,resultId:`${meta.createdAt}:${url}`,parentResultId:lineage.parentResultId || '',character:lineage.character || null,source:lineage.source || null,
            prompt:meta.prompt || '',model:config.model || config.apiModel || '',provider:config.provider_id || '',size:config.size || `${config.width || 1024}x${config.height || 1024}`,
            quality:config.quality || 'auto',n:Number(config.count || 1),operation:references.length?'edit':'generate',
            references:references.map(({url,name,kind})=>({url,name,kind})),createdAt:meta.createdAt || Date.now()});
    }
    global.CanvasLineage={variables,assertPrompt,enrich,candidates,fromCandidate,choose,compose,result};
})(typeof window==='undefined'?globalThis:window);
