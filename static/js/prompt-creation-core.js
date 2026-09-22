(function(global){
    'use strict';
    const labels={VARIABLE:'其他要求',SOURCE:'作品或世界观',CHARACTER_NAME:'角色名称',HAIR:'发型与发色',EYES:'眼睛与神态',OUTFIT:'服装与配色',ACCESSORY:'标志饰品',MAIN_PROP:'主要道具',SIGNATURE_TRAIT:'角色识别特征',BODY_TYPE_RULE:'体型与年龄',EXPRESSION:'表情',POSE_DESCRIPTION:'姿态',BODY_LANGUAGE:'肢体语言',ARM_TOPOLOGY:'双臂位置',SHOULDER_LINE:'肩线',HEAD_DIRECTION:'头部朝向',PROP_PLACEMENT:'道具位置',SILHOUETTE_TYPE:'剪影类型',SILHOUETTE_EMOTION:'剪影情绪',SUBJECT:'主体',STYLE:'风格',BACKGROUND:'背景',CHARACTER:'角色',POSE:'姿态',SCENE:'场景'};
    function label(name){
        const key=String(name).toUpperCase();
        if(Object.hasOwn(labels,key))return labels[key];
        const match=key.match(/^(PERSONALITY|COLOR|DOODLE)_(\d+)$/);
        return match?`${{PERSONALITY:'性格',COLOR:'主色',DOODLE:'小涂鸦'}[match[1]]} ${match[2]}`:name;
    }
    const clone=value=>JSON.parse(JSON.stringify(value));
    function compose(base,task){return [base.trim(),task.trim()?`本次任务（与模板冲突时以此为准）：\n${task.trim()}`:''].filter(Boolean).join('\n\n');}
    function revisionPrompt(base,instruction){return `${base}\n\n本轮修改（优先于上面的同类要求）：\n${instruction.trim()}\n以提供的上一轮结果为参考，只修改本轮明确要求的部分，其余角色身份、画风和构图尽量保持。`;}
    function characterPrompt(base,task,character,useReferences=true){
        if(!character)return compose(base,task);
        return [`角色身份资料（用于保持角色一致性）：\n名称：${character.name}\n${character.description || ''}`,
            useReferences?`前 ${character.references.length} 张参考图是角色设定图。提取其中同一角色的外貌、发型、服装和识别特征。`:'参考上一轮结果保持角色身份。',
            `本次绘画模板：\n${base.trim()}`,
            task.trim()?`本次具体要求：\n${task.trim()}`:'',
            '组合规则：角色身份取自角色资料与参考图；模板中示例角色的名字、发色、五官、服装和道具不替换当前角色设定，除非模板或本次具体要求明确要求换装或修改这些特征；本次画风、场景、姿势、构图和裁切按绘画模板及本次具体要求重新绘制，本次具体要求优先于模板。设定图中的原有画风、姿势与版式不约束本次绘画。除非本次明确要求设定表或多视图，否则只画同一角色的一幅作品，不复刻三视图排版、角色介绍文字、标注或拼贴。不要将设定图中的多个视角当成多个人物。'].filter(Boolean).join('\n\n');
    }
    function referencesFor(d){
        const refs=[...(d.character && d.useCharacterReferences!==false?d.character.references:[]),...(d.references || [])];
        return refs.filter((r,i)=>refs.findIndex(other=>other.url===r.url)===i);
    }
    function configuration(d,includeReferences=true){return clone({text:d.text,values:d.values,task:d.task || '',model:d.model,size:d.size,references:includeReferences?d.references:[],character:d.character || null,useCharacterReferences:d.useCharacterReferences!==false,source:d.source || null,parentResultId:d.parentResultId || ''});}
    function draftValue(d){return {...configuration(d),branchName:d.branchName || '',recipeId:d.recipeId || '',original:d.original,results:clone(d.results),pending:d.pending?clone(d.pending):null,revisionInputs:clone(d.revisionInputs || {}),updatedAt:Date.now()};}
    function mode(item){return /^改图[；;]/.test(item.scene || '')?'需要参考图':/^生图[；;]/.test(item.scene || '')?'文生图':'自由创作';}
    function safeUrl(url){return /^(\/assets\/|\/output\/|\/api\/storage-files\/|\/api\/view\?|https?:\/\/)/i.test(String(url || ''))?String(url):'';}
    function provenance(result){return clone({version:1,resultId:result.id || result.resultId || '',parentResultId:result.parentResultId || '',prompt:result.prompt,model:result.model,provider:result.provider || '',size:result.size,quality:result.quality || '',n:result.n || 1,operation:result.operation,references:result.references || [],character:result.character || null,source:result.source || null,instruction:result.instruction || '',createdAt:result.createdAt || 0});}
    function canvasGraph(result,dimensions={width:1024,height:1024}){
        const refs=(result.references || []).filter(r=>safeUrl(r.url));
        const nodes=refs.map((r,i)=>({id:`reference-${i}`,type:'smart-image',x:40,y:70+i*250,w:210,h:210,title:r.name || `参考图 ${i+1}`,images:[{...r,kind:'image'}],scale:1}));
        const promptX=refs.length?330:60;
        nodes.push({id:'prompt-source',type:'smart-prompt',x:promptX,y:80,w:316,h:300,title:'实际生成提示词',text:result.prompt,promptSplitEnabled:false,llmEnabled:false});
        const fit=400/Math.max(dimensions.width,dimensions.height);
        const meta=provenance(result);
        nodes.push({id:'prompt-result',type:'smart-image',x:promptX+420,y:80,w:Math.round(dimensions.width*fit),h:Math.round(dimensions.height*fit),title:result.source?.name || '生成结果',images:[{url:result.url,name:'生成结果',kind:'image',natural_w:dimensions.width,natural_h:dimensions.height,provenance:meta}],provenance:meta,scale:1,runPrompt:result.prompt,runModelPrompt:result.prompt,runInputRefs:clone(refs),runAt:result.createdAt,runSettings:{engine:'api',provider_id:result.provider,model:result.model,apiKind:'image',size:result.size}});
        const connections=[{from:'prompt-source',to:'prompt-result'},...refs.map((_,i)=>({from:`reference-${i}`,to:'prompt-result'}))];
        return {nodes,connections};
    }
    global.PromptCreation={label,clone,compose,characterPrompt,referencesFor,revisionPrompt,configuration,draftValue,mode,safeUrl,provenance,canvasGraph};
})(typeof window==='undefined'?globalThis:window);
