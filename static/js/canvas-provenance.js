(function(global){
    const core=global.PromptCreation;
    const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function metadata(node,image){
        if(image?.provenance)return core.clone(image.provenance);
        if(node?.provenance)return core.clone(node.provenance);
        return {prompt:node?.runModelPrompt || node?.runPrompt || '',model:node?.runSettings?.model || node?.runSettings?.apiModel || '',provider:node?.runSettings?.provider_id || '',size:node?.runSettings?.size || '1024x1024',references:core.clone(node?.runInputRefs || []),createdAt:node?.runAt || 0,source:null};
    }
    async function branch(meta,image,canvasTitle){
        const id=crypto.randomUUID();
        const key=JSON.stringify(['workbench_branches',id]);
        const value={branchName:`${canvasTitle || '画布'} · 分支`,text:meta.prompt || '',original:meta.prompt || '',values:{},task:'',references:[{url:image.url,name:image.name || '画布结果'}],model:meta.provider && meta.model?JSON.stringify([meta.provider,meta.model]):'',size:meta.size || '1024x1024',results:[],revisionInputs:{},parentResultId:meta.resultId || '',character:core.clone(meta.character || null),useCharacterReferences:false,source:meta.source || {name:canvasTitle || '画布图片'},updatedAt:Date.now()};
        const response=await fetch('/api/prompt-workbench/drafts/'+encodeURIComponent(key),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value,revision:0})});
        const data=await response.json();
        if(!response.ok)throw new Error(data.detail || '创建分支失败');
        return id;
    }
    function show(node,image,canvasTitle){
        const meta=metadata(node,image);
        const dialog=document.createElement('dialog');dialog.className='canvas-provenance';
        dialog.innerHTML=`<form method="dialog"><button aria-label="关闭生成来源">×</button></form><h2>生成来源</h2><p>${escape(meta.source?.name || '画布图片')} · ${escape(meta.model || '模型未记录')}</p><p>${meta.createdAt?escape(new Date(meta.createdAt).toLocaleString()):'这张图片没有完整的生成记录，仍可作为参考图继续创作。'}${meta.parentResultId?' · 来自上一轮结果的分支':''}</p><div class="provenance-references">${(meta.references || []).map(ref=>`<a href="${escape(core.safeUrl(ref.url))}" target="_blank" rel="noopener"><img src="${escape(core.safeUrl(ref.url))}" alt="${escape(ref.name || '参考图')}"></a>`).join('')}</div><pre>${escape(meta.prompt || '未记录提示词')}</pre><button type="button" data-create-branch>以这张图创建分支</button><p role="status"></p>`;
        document.body.append(dialog);dialog.showModal();
        dialog.addEventListener('close',()=>dialog.remove());
        dialog.querySelector('[data-create-branch]').onclick=async event=>{
            event.target.disabled=true;
            try{
                const id=await branch(meta,image,canvasTitle);
                if(global.parent!==global)global.parent.postMessage({type:'prompt-workbench-branch',id},location.origin);
                else location.href='/static/asset-manager.html#prompts?branch='+encodeURIComponent(id);
                dialog.close();
            }catch(error){dialog.querySelector('[role=status]').textContent=error.message;event.target.disabled=false;}
        };
    }
    global.CanvasProvenance={show,metadata};
})(window);
