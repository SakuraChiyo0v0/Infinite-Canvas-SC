import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const online=read('static/online.html'),klein=read('static/klein.html');
const fn=(source,name)=>{const match=source.match(new RegExp(`^        (?:async )?function ${name}\\([^\\n]*[\\s\\S]*?^        }`,'m'));assert.ok(match,name);return match[0];};

test('云端历史恢复实际模型参数与 URL 参考图；单图来源优先于批次来源',()=>{
    const ctx=vm.createContext({});vm.runInContext(fn(klein,'historyResult'),ctx);
    const source={name:'模板'},character={id:'role',name:'角色'};
    const result=ctx.historyResult({prompt:'实际提示词',images:['/output/result.png'],timestamp:8,provider_id:'p',model:'m',
        provenance:{resultId:'batch'},image_items:[{url:'/output/result.png',provenance:{resultId:'image1',source,character,parentResultId:'previous'}}],
        params:{size:'1024x1536',quality:'high',n:3,reference_images:[{url:'/assets/ref.png',name:'设定图'}]}});
    assert.equal(result.id,'image1');assert.equal(result.provider,'p');assert.equal(result.model,'m');assert.equal(result.quality,'high');assert.equal(result.n,3);
    assert.equal(result.size,'1024x1536');assert.equal(result.references[0].url,'/assets/ref.png');assert.equal(result.character.id,'role');assert.equal(result.parentResultId,'previous');
});

test('旧本地历史保留原图及本地文件名；缺失旧尺寸不猜测',()=>{
    const ctx=vm.createContext({});vm.runInContext(fn(klein,'historyResult'),ctx);
    const data=ctx.historyResult({workflow_json:'Flux2-Klein.json',params:{'278':{image:'main.png'},'270':{image:'extra.png'},'156':{width:768,height:1024},'168':{text:'修改要求'}}});
    assert.equal(data.provider,'local-comfy');assert.equal(data.model,'FLUX.2 Klein 图片编辑');assert.equal(data.references.length,2);assert.equal(data.references[0].comfy_name,'main.png');assert.match(data.references[0].url,/filename=main.png/);assert.equal(data.size,'768x1024');assert.equal(data.prompt,'修改要求');
    assert.equal(ctx.historyResult({workflow_json:'Z-Image.json',params:{}}).size,'');
});

test('取消交接保留图片编辑草稿和参考图，不更换模型或自动生成',async()=>{
    let changed=false;
    const ctx=vm.createContext({document:{getElementById:()=>({value:'当前草稿'})},editReferences:()=>[{url:'/assets/old.png'}],CreationFlow:{confirmReplace:async()=>false},cliEngine:{select(){changed=true;}},fetch(){throw Error('不应生成');}});
    vm.runInContext(fn(klein,'receiveCreation'),ctx);
    assert.equal(await ctx.receiveCreation({prompt:'新内容',references:[{url:'/assets/new.png'}]}),false);assert.equal(changed,false);
});

test('文生图收到带参考图内容时转至图片编辑，保持完整交接',async()=>{
    let received;
    const ctx=vm.createContext({CreationFlow:{toEditor:async p=>received=p},fetch(){throw Error('不应生成');}});
    vm.runInContext(fn(online,'receiveCreation'),ctx);
    const payload={prompt:'画角色',references:[{url:'/assets/role.png'}],character:{id:'role'}};
    assert.equal(await ctx.receiveCreation(payload),true);assert.equal(received,payload);
});

test('图片编辑接受交接后恢复所有可用参数和角色来源，但不自动请求生成',async()=>{
    const fields=new Map();const field=id=>{if(!fields.has(id))fields.set(id,{value:''});return fields.get(id);};
    const slots=[];let model,size;
    const ctx=vm.createContext({document:{getElementById:field},window:{scrollTo(){}},editReferences:()=>[],CreationFlow:{confirmReplace:async()=>true},
        setReferenceSlot:(i,r)=>slots[i]=r,showCreationContext(){},flowStatus(){},creationContext:{},editQuality:'auto',editCount:1,
        cliEngine:{select:(p,m)=>(model=[p,m],true)},cliSizeControl:{setValue:s=>size=s},fetch(){throw Error('不应生成');}});
    vm.runInContext(fn(klein,'receiveCreation'),ctx);
    assert.equal(await ctx.receiveCreation({prompt:'修改围巾',provider:'p',model:'m',size:'768x1024',quality:'high',n:3,references:[{url:'/assets/a.png'},{url:'/assets/b.png'}],character:{id:'r'},source:{name:'模板'},parentResultId:'old'}),true);
    assert.deepEqual(model,['p','m']);assert.equal(size,'768x1024');assert.equal(field('editQuality').value,'high');assert.equal(field('editCount').value,'3');assert.equal(slots[1].url,'/assets/a.png');assert.equal(slots[2].url,'/assets/b.png');assert.equal(slots[3],undefined);assert.equal(ctx.creationContext.character.id,'r');assert.equal(ctx.creationContext.parentResultId,'old');
});

test('提示词选择器含变量时只提供创作台填写，独立提示词页接收正确条目',async()=>{
    class El {constructor(){this.value='';this.children=[];this.dataset={};this.events={};}append(...x){this.children.push(...x);}appendChild(x){this.append(x);}replaceChildren(...x){this.children=x;this.value=x[0]?.value||'';}add(x){this.append(x);if(this.children.length===1)this.value=x.value;}setAttribute(){}addEventListener(n,f){this.events[n]=f;}focus(){}showModal(){this.open=true;}close(){this.open=false;this.events.close?.();}}
    const input=new El(),button=new El(),dialog=new El();button.dataset.promptLibraryTarget='input';
    const controls=Object.fromEntries(['library','category','search','list','status','title','note','content','replace','append','manage','fill'].map(k=>[`[data-${k}]`,new El()]));
    dialog.querySelector=k=>controls[k];dialog.querySelectorAll=()=>[];let opened;
    const ctx=vm.createContext({document:{body:new El(),getElementById:()=>input,createElement:t=>t==='dialog'?dialog:new El(),querySelectorAll:()=>[button],addEventListener:(n,f)=>f()},Option:class extends El{constructor(t,v){super();this.value=v;}},AbortController,setTimeout,clearTimeout,
        CreationFlow:{variables:t=>[...t.matchAll(/\{\{([^}]+)\}\}/g)].map(m=>m[1]),openPrompts:p=>opened=p},
        fetch:async()=>({ok:true,json:async()=>({library:{libraries:[{id:'mine',items:[{id:'tpl',positive:'画 {{ROLE}}',name:'角色模板'}]}]}})})});
    vm.runInContext(read('static/js/prompt-library-picker.js'),ctx);await button.onclick();
    assert.equal(controls['[data-replace]'].disabled,true);assert.equal(controls['[data-append]'].disabled,true);assert.equal(controls['[data-fill]'].hidden,false);
    controls['[data-fill]'].onclick();assert.equal(opened.libraryId,'mine');assert.equal(opened.itemId,'tpl');assert.equal(input.value,'');
});

test('两个普通工具提交未填变量时都拦截请求',async()=>{
    for(const [source,name] of [[online,'submitImage'],[klein,'submitWorkflow']]){
        let message='';const input={value:'画 {{CHARACTER_NAME}}',focus(){}};
        const ctx=vm.createContext({window:{},document:{getElementById:()=>input},flowStatus:s=>message=s,fetch(){throw Error('变量未填时不应发请求');}});
        vm.runInContext(fn(source,'validateVariables')+'\n'+fn(source,name),ctx);
        await ctx[name]();assert.match(message,/CHARACTER_NAME/);
    }
});

test('共享模型显式恢复已停用本地历史，不自动迁移云端模型；加载失败保留错误',async()=>{
    const select={};const elements={picker:{innerHTML:'',querySelector:()=>select},wrap:{classList:{remove(){}}},hint:{}};
    let fail=false;
    const ctx=vm.createContext({window:{addEventListener(){},StudioImageCapabilities:{localEnabled:()=>false}},document:{head:{appendChild(){}},getElementById:id=>elements[id],createElement:()=>({textContent:'',get innerHTML(){return this.textContent;}})},localStorage:{getItem:()=>null,setItem(){}},console:{warn(){}},fetch:async()=>({ok:!fail,json:async()=>({providers:[{id:'p',image_configured:true,image_models:['m']}]})})});
    vm.runInContext(read('static/js/cli-image-tools.js'),ctx);
    const picker=ctx.window.StudioCliImageTools.create({selectId:'picker',hintId:'hint',wrapId:'wrap',storageKey:'test',localModel:'FLUX.2 Klein 图片编辑'});
    await picker.refresh();assert.equal(picker.selected().id,'p');
    assert.equal(picker.select('local-comfy','FLUX.2 Klein 图片编辑'),false);assert.equal(picker.selected(),null);assert.equal(picker.status().unavailable,true);
    assert.equal(picker.select('p','m'),true);fail=true;await picker.refresh();assert.match(picker.status().error,/加载失败/);assert.equal(picker.selected().id,'p');
});

test('工具结果使用真实 CreationFlow 交接，仅带结果作为新参考并保留父结果',async()=>{
    let envelope,message;
    const ctx=vm.createContext({crypto:{randomUUID:()=> 'handoff-id'},sessionStorage:{setItem:(k,v)=>envelope=JSON.parse(v)},location:{origin:'http://localhost'},parent:{postMessage:m=>message=m}});
    ctx.window=ctx;
    vm.runInContext(read('static/js/prompt-creation-core.js')+'\n'+read('static/js/creation-flow.js'),ctx);
    vm.runInContext(fn(online,'historyResult')+'\n'+fn(online,'resultAction'),ctx);
    await ctx.resultAction('edit',{images:['/output/new.png'],prompt:'本次结果',model:'m',provider_id:'p',provenance:{resultId:'result-1',character:{id:'role',name:'角色'}}});
    assert.equal(message.type,'creation-flow-open');assert.equal(envelope.target,'klein');assert.equal(envelope.payload.references.length,1);assert.equal(envelope.payload.references[0].url,'/output/new.png');assert.equal(envelope.payload.parentResultId,'result-1');assert.equal(envelope.payload.character.id,'role');
});

test('原生模型恢复像素或比例意图保持标准画幅，auto/None 不生成空自定义比例',()=>{
    const field={hidden:false,style:{}};
    const el={style:{},closest:()=>field,addEventListener(){}};
    const wrap={innerHTML:'',classList:{toggle(){}},querySelector:()=>el};
    let native=true;
    const ctx=vm.createContext({window:{addEventListener(){},StudioImageCapabilities:{nativeResolution:()=>native}},localStorage:{getItem:()=>null,setItem(){}},
        document:{head:{appendChild(){}},getElementById:id=>id==='size'?wrap:null,createElement:()=>({textContent:'',get innerHTML(){return this.textContent;}})}});
    vm.runInContext(read('static/js/cli-image-tools.js'),ctx);
    const control=ctx.window.StudioCliImageTools.createSizeControl({wrapId:'size',storageKey:'test',getModel:()=> 'ChatGPT 网页版/gpt2.5'});
    control.setActive(true);
    for(const size of ['1024x1024','square','1:1']){
        assert.equal(control.setValue(size),true);assert.equal(control.value(),'1024x1024');
        assert.match(wrap.innerHTML,/<option value="square" selected>/);assert.doesNotMatch(wrap.innerHTML,/value="(?:NaN|undefined|Infinity)"/);
    }
    assert.equal(control.setValue('2:3'),true);assert.match(wrap.innerHTML,/<option value="portrait" selected>/);
    const preserved=control.value();
    for(const size of ['auto','None',null,undefined,'0x1024','0:1','garbage']){
        assert.equal(control.setValue(size),false);assert.equal(control.value(),preserved);assert.match(wrap.innerHTML,/<option value="portrait" selected>/);
    }
    native=false;assert.equal(control.setValue('768x1024'),true);assert.equal(control.value(),'768x1024');
    assert.match(wrap.innerHTML,/<option value="custom" selected>/);
});

test('文生图原生 1:1 参数交接到共享编辑尺寸控件无需自定义比例',()=>{
    const ctx=vm.createContext({nativeImageSize:()=>true,ratio:'square',SIZE_OPTIONS:{square:[['1024x1024','1k']]},
        resolution:'1k',customRatioWidth:'',customRatioHeight:'',customWidth:'',customHeight:'',updateSizeUI(){}});
    vm.runInContext(fn(online,'currentSize')+'\n'+fn(online,'parseSizeValue')+'\n'+fn(online,'restoreImageSize'),ctx);
    assert.equal(ctx.currentSize(),'1024x1024');
    assert.equal(ctx.restoreImageSize(ctx.currentSize()),true);assert.equal(ctx.ratio,'square');assert.equal(ctx.resolution,'1k');
    assert.equal(ctx.restoreImageSize('auto'),false);assert.equal(ctx.ratio,'square');
    assert.equal(ctx.restoreImageSize('None'),false);assert.equal(ctx.ratio,'square');
});

test('本地参考图准备期间重复提交只生成一次，准备失败可重试',async()=>{
    let release,generated=0;const btn={disabled:false};
    const ctx=vm.createContext({validateVariables:()=>true,editSubmitting:false,referenceUploads:0,engine:'local',document:{getElementById:()=>btn},
        cliEngine:{selected:()=>({id:'local-comfy',image_models:['klein']}),status:()=>({})},flowStatus(){},
        ensureLocalReferences:()=>new Promise(resolve=>release=resolve),submitLocal:async()=>generated++});
    vm.runInContext(fn(klein,'submitWorkflow'),ctx);
    const first=ctx.submitWorkflow();assert.equal(btn.disabled,true);
    await ctx.submitWorkflow();assert.equal(generated,0);release();await first;
    assert.equal(generated,1);assert.equal(btn.disabled,false);assert.equal(ctx.editSubmitting,false);
    ctx.ensureLocalReferences=async()=>{throw Error('无法读取参考图');};await ctx.submitWorkflow();assert.equal(ctx.editSubmitting,false);assert.equal(generated,1);
});

test('本地上传中更换参考图不把旧文件名绑定到新图，也不继续生成',async()=>{
    let release;
    const ctx=vm.createContext({base64Images:{1:'/assets/old.png'},uploadedNames:{},referenceVersions:{1:1},referenceNames:{},FormData:class {append(){}},
        fetch:async url=>url==='/api/upload'?new Promise(resolve=>release=()=>resolve({ok:true,json:async()=>({files:[{comfy_name:'old.png'}]})})):{ok:true,blob:async()=>({})}});
    vm.runInContext(fn(klein,'ensureLocalReferences'),ctx);
    const task=ctx.ensureLocalReferences();
    while(!release)await Promise.resolve();
    ctx.base64Images[1]='/assets/new.png';ctx.referenceVersions[1]=2;release();
    await assert.rejects(task,/参考图已改变/);assert.equal(ctx.uploadedNames[1],undefined);
});

test('工具选择素材只采用所选素材来源，旧素材不继承此前角色或模板',async()=>{
    let picked,received;
    const ctx=vm.createContext({creationContext:{character:{id:'old'},source:{name:'old-template'},parentResultId:'old-result'},
        document:{getElementById:()=>({value:'已有任务'})},provider:'p',selectedModel:'m',currentSize:()=> '1024x1024',quality:'auto',outputCount:1,
        editReferences:()=>[],setReferenceSlot(){},showCreationContext(){},flowStatus(){}});
    ctx.window=ctx;ctx.CreationFlow={pickReference:async()=>picked,toEditor:async p=>received=p};
    for(const source of [online,klein]){
        vm.runInContext(fn(source,'pickCreationReference'),ctx);
        picked={character:null,references:[{url:'/assets/saved.png'}],provenance:{character:{id:'saved-role'},source:{name:'saved-template'},resultId:'saved-result'}};
        await ctx.pickCreationReference();
        const result=source===online?received:ctx.creationContext;
        assert.equal(result.character.id,'saved-role');assert.equal(result.source.name,'saved-template');assert.equal(result.parentResultId,'saved-result');
        picked={character:null,references:[{url:'/assets/legacy.png'}],provenance:null};await ctx.pickCreationReference();
        const legacy=source===online?received:ctx.creationContext;
        assert.equal(legacy.character,null);assert.equal(legacy.source,null);assert.equal(legacy.parentResultId,'');
    }
});
