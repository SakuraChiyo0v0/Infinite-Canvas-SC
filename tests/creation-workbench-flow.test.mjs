import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../static/js/'+name+'.js',import.meta.url),'utf8');
const providers=[{id:'gateway',image_configured:true,image_models:['image']}];
const character={id:'role',name:'测试角色',description:'测试设定',references:[{url:'/assets/role.png',name:'设定图'}]};
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};

function workbench(){
    const elements=new Map(),listeners={},requests=[],actions=[],storage=new Map();
    let currentKey='',pick=null;
    const element=id=>{
        if(!elements.has(id))elements.set(id,{id,value:'',textContent:'',innerHTML:'',dataset:{},focus(){}});
        return elements.get(id);
    };
    const context=vm.createContext({console,location:{origin:'http://isolated.test'},
        document:{addEventListener:(type,callback)=>listeners[type]=callback,getElementById:element,
            querySelector:selector=>selector==='[data-pw-key]'?{dataset:{pwKey:currentKey}}:element(selector),querySelectorAll:()=>[]},
        localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
        setTimeout:()=>0,clearTimeout(){},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},dispatchEvent(){},
        CreationFlow:{pickReference:async()=>pick,confirmReplace:async()=>false,
            configureModels:()=>actions.push({action:'configure'}),
            toCanvas:async result=>actions.push({action:'canvas',result}),
            saveAsset:async result=>actions.push({action:'asset',result}),
            toEditor:async result=>actions.push({action:'editor',result})},
        fetch:async(url,options={})=>{
            const body=options.body?JSON.parse(options.body):null;requests.push({url,body});
            let data={};
            if(url==='/api/providers')data={providers};
            else if(url.startsWith('/api/prompt-workbench/'))data={revision:1,value:body.value};
            else if(url==='/api/canvas-image-tasks')data={task_id:'job'};
            else if(url==='/api/canvas-image-tasks/job')data={status:'succeeded',result:{images:['/assets/result.png'],image_items:[{provenance:{version:1,resultId:'actual-result',prompt:'实际正文',model:'image',provider:'gateway',size:'1024x1536',character,source:{name:'服务端模板'},parentResultId:'parent',quality:'high',n:1}}]}};
            return {ok:true,json:async()=>data};
        }
    });
    vm.runInContext(read('prompt-creation-core'),context);vm.runInContext(read('prompt-workbench'),context);
    const api=context.PromptWorkbench;
    const item={id:'free',name:'自由创作',positive:'',character_context:character};
    const library={id:'character-free',readonly:true};
    const render=(available=providers)=>{currentKey=JSON.stringify([library.id,item.id]);return api.render(item,library,'',available);};
    const click=(selector,dataset={})=>listeners.click({target:{dataset,closest:query=>query==='[data-pw-key]'?{}:query===selector?{dataset}:null}});
    const input=(id,value)=>listeners.input({target:{id,value,dataset:{},closest:()=>true}});
    const snapshot=()=>JSON.parse(storage.get('prompt-workbench-backup:'+currentKey)).value;
    return {api,element,requests,actions,render,click,input,snapshot,setPick:value=>pick=value};
}

test('free character creation needs only a task and keeps primary actions before editor',async()=>{
    const h=workbench(),html=h.render([]);
    assert.ok(html.indexOf('id="pwGenerate"')<html.indexOf('id="pwTask"'));
    assert.match(html,/data-pw-configure/);assert.match(html,/data-pw-reload-models/);
    assert.match(html,/data-pw-save disabled/,'virtual template must never allow saving into a real template');
    h.click('[data-pw-configure]');assert.equal(h.actions[0].action,'configure');
    h.render();h.input('pwTask','让角色站在海边');h.click('[data-pw-generate]');await settle();
    const submission=h.requests.find(request=>request.url==='/api/canvas-image-tasks').body;
    assert.match(submission.prompt,/让角色站在海边/);
    assert.equal(submission.reference_images[0].url,'/assets/role.png');
    assert.equal(submission.provenance.character.id,'role');
    assert.equal(submission.provenance.source.itemId,'free');
    assert.equal(h.snapshot().results[0].provenance.resultId,'actual-result');
    assert.equal(h.snapshot().results[0].size,'1024x1536','server actual parameters take precedence');
});

test('shared reference chooser preserves draft on cancel and validates combined image limit',async()=>{
    const h=workbench();h.render();h.input('pwTask','保留任务');
    h.click('[data-pw-pick-reference]');await settle();
    assert.equal(h.snapshot().task,'保留任务');assert.equal(h.snapshot().references.length,0);
    h.setPick({character:null,references:[{url:'/assets/a.png'},{url:'/assets/b.png'},{url:'/assets/c.png'}]});
    h.click('[data-pw-pick-reference]');await settle();
    assert.match(h.element('pwStatus').textContent,/最多 3 张/);
    assert.equal(h.snapshot().references.length,0);
    h.setPick({character:null,references:[{url:'/assets/a.png'}],provenance:{resultId:'previous',source:{name:'已存素材'}}});
    h.click('[data-pw-pick-reference]');await settle();
    assert.equal(h.snapshot().references[0].url,'/assets/a.png');
    assert.equal(h.snapshot().parentResultId,'previous');
    assert.equal(h.requests.filter(request=>request.url==='/api/canvas-image-tasks').length,0,'selecting a reference never generates');
});

test('result actions send real output and provenance to editor, asset picker and canvas picker',async()=>{
    const h=workbench();h.render();h.input('pwTask','测试任务');h.click('[data-pw-generate]');await settle();
    const count=h.requests.filter(request=>request.url==='/api/canvas-image-tasks').length;
    for(const [selector,dataset] of [['[data-pw-editor]',{pwEditor:'0'}],['[data-pw-asset]',{pwAsset:'0'}],['[data-pw-canvas]',{pwCanvas:'0'}]]){
        h.click(selector,dataset);await settle();
    }
    assert.deepEqual(h.actions.map(action=>action.action),['editor','asset','canvas']);
    const editor=h.actions[0].result;
    assert.equal(editor.references[0].url,'/assets/result.png');assert.equal(editor.parentResultId,'actual-result');
    assert.equal(editor.character.id,'role');assert.equal(h.actions[1].result.provenance.source.name,'服务端模板');
    assert.equal(h.actions[2].result.size,'1024x1536');
    assert.equal(h.requests.filter(request=>request.url==='/api/canvas-image-tasks').length,count);
});

test('character page starts free creation; template filtering keeps the selected draft',async()=>{
    const elements=new Map(),renders=[];
    const decode=text=>text.replaceAll('&quot;','"').replaceAll('&amp;','&');
    const element=id=>{
        if(!elements.has(id))elements.set(id,{id,value:'',checked:false,options:[],dataset:{},focus(){},add(option){this.options.push(option);},
            set innerHTML(html){this.html=html;if(id==='characterTemplate')this.options=[...html.matchAll(/<option value="([^"]*)"/g)].map(match=>({value:decode(match[1])}));},get innerHTML(){return this.html || '';}});
        return elements.get(id);
    };
    const libraries=[{id:'lib',name:'模板库',items:[{id:'a',name:'肖像',scene:'生图；人像',positive:'肖像正文'},{id:'b',name:'换装',scene:'改图；服装',positive:'换装正文'}]}];
    const context=vm.createContext({document:{getElementById:element,addEventListener(){}},window:{addEventListener(){}},
        localStorage:{getItem:()=>null,setItem(){}},Option:class{constructor(text,value){this.text=text;this.value=value;}},
        CreationFlow:{confirmReplace:async()=>false},
        PromptWorkbench:{load:async()=>{},loadCharacters:async()=>{},characterWorks:()=>[],render:(item,library)=>{renders.push({item,library});return '<p>创作台</p>'; }},
        fetch:async url=>({ok:true,json:async()=>url.startsWith('/api/characters')?{characters:[character]}:url==='/api/prompt-libraries'?{library:{libraries}}:{providers}})
    });
    vm.runInContext(read('prompt-creation-core'),context);context.PromptCreation=context.window.PromptCreation;
    vm.runInContext(read('characters'),context);await settle();
    assert.equal(renders.at(-1).item.id,'free');assert.equal(renders.at(-1).library.readonly,true);
    element('characterTemplate').value='["lib","a"]';element('characterTemplate').onchange();
    assert.equal(renders.at(-1).item.id,'a');
    const count=renders.length;element('characterTemplateSearch').value='不存在';element('characterTemplateSearch').oninput();
    assert.equal(element('characterTemplate').value,'["lib","a"]');assert.equal(renders.length,count);
    assert.match(element('characterTemplateCount').textContent,/没有匹配模板/);
    element('characterFreeCreate').onclick();assert.equal(renders.at(-1).item.id,'free');
    element('characterTemplateSearch').value='';element('characterTemplatePurpose').value='edit';element('characterTemplatePurpose').onchange();
    assert.ok(element('characterTemplate').innerHTML.includes('换装'));assert.ok(!element('characterTemplate').innerHTML.includes('肖像'));
});

test('asset clipboard and creation payload retain immutable provenance',()=>{
    const source=read('asset-manager');
    const section=name=>{const start=source.indexOf('function '+name+'(');const end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);};
    const context=vm.createContext({});
    vm.runInContext(section('canvasInboxAssetFromItem'),context);
    // This helper is immediately followed by an async function, so isolate its declaration.
    const start=source.indexOf('function assetCreationResult('),end=source.indexOf('\nasync function ',start);
    vm.runInContext(source.slice(start,end),context);
    const item={id:'asset',url:'/assets/one.png',name:'素材',provenance:{resultId:'result',character:{id:'role'},source:{name:'模板'},prompt:'正文'}};
    const clipboard=context.canvasInboxAssetFromItem(item),result=context.assetCreationResult(item);
    item.provenance.character.id='changed';
    assert.equal(clipboard.provenance.character.id,'role');assert.equal(result.character.id,'role');
    assert.equal(result.id,'result');assert.equal(result.prompt,'正文');
});

test('prompt handoff opens a branch without reloading or replacing an active dirty editor',async()=>{
    const elements=new Map(),loads=[];let receive;
    const element=id=>{
        if(!elements.has(id))elements.set(id,{id,value:'',innerHTML:'',textContent:'',dataset:{},
            classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector:element,remove(){},focus(){}});
        return elements.get(id);
    };
    const window={addEventListener(){},CreationFlow:{listen:(target,handler)=>{assert.equal(target,'prompts');receive=handler;}}};
    const context=vm.createContext({window,document:{body:element('body'),getElementById:element,querySelector:element,querySelectorAll:()=>[],addEventListener(){}},
        location:{hash:'#prompts',search:'',origin:'http://isolated.test'},URLSearchParams,
        localStorage:{getItem:()=>null,setItem(){}},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:callback=>callback(),
        PromptLibraryDnD:{mount(){}},PromptWorkbench:{load:async force=>loads.push(force),
            branchLibrary:()=>({id:'workbench_branches',name:'分支',readonly:true,categories:[],items:[{id:'new-branch',name:'新分支',positive:'正文'}]}),
            card:()=>'',render:()=>'<div>分支创作台</div>'},fetch:()=>{throw Error('unexpected request');}});
    vm.runInContext(read('asset-manager'),context);
    const run=code=>vm.runInContext(code,context);
    run("promptEditMode=true; promptDraft={name:'现有草稿'}; leavePromptEditor=async()=>false;");
    assert.equal(await receive({branchId:'new-branch'}),false);
    assert.equal(run('promptDraft.name'),'现有草稿');assert.equal(loads.length,0);
    assert.equal(await receive({}),true,'plain navigation keeps the current editor');
    assert.equal(run('promptDraft.name'),'现有草稿');
    run('promptEditMode=false; promptDraft=null;');
    assert.equal(await receive({branchId:'new-branch'}),true);
    assert.deepEqual(loads,[true]);assert.equal(run('activePromptLibraryId'),'workbench_branches');
    assert.equal(run('selectedPromptId'),'new-branch');
    assert.match(element('assetManagerRoot').innerHTML,/分支创作台/,'branches stay visible even when no regular libraries exist');
});

test('copying assets between folders includes their provenance in the batch request',async()=>{
    const source=read('asset-manager'),start=source.indexOf('async function pasteAssetClipboard('),end=source.indexOf('\nfunction ',start);
    let request;
    const context=vm.createContext({assetClipboard:{mode:'copy',ids:['one'],items:[{url:'/assets/one.png',name:'图片',provenance:{resultId:'origin',character:{id:'role'}}}]},
        activeAssetLibraryId:'destination',activeAssetCategoryId:'images',selectedAssetIds:new Set(['one']),selectedAssetId:'one',assetLibrary:{},
        apiJson:async(url,options)=>{request=JSON.parse(options.body);return {items:[{}]};},setStatus(){},render(){}});
    vm.runInContext(source.slice(start,end),context);await context.pasteAssetClipboard();
    assert.equal(request.items[0].provenance.resultId,'origin');assert.equal(request.items[0].provenance.character.id,'role');
    assert.equal(request.library_id,'destination');
});

test('asset creation blocks duplicate clicks and restores the button after success or failure',async()=>{
    const source=read('asset-manager');
    const start=source.indexOf('function assetCreationResult('),end=source.indexOf('\nfunction renderAssetDetail(',start);
    const item={id:'asset',url:'/assets/one.png',name:'素材',provenance:{resultId:'original'}};
    let finish,calls=0;
    const context=vm.createContext({findAssetItem:()=>item,window:{CreationFlow:{toWorkbench:()=>{calls++;return new Promise(resolve=>{finish=resolve;});}}}});
    vm.runInContext(source.slice(start,end),context);
    const button={disabled:false,dataset:{creationKind:'asset',creationId:'asset',creationAction:'workbench'}};
    const pending=context.runAssetCreationAction(button);
    assert.equal(button.disabled,true);
    await context.runAssetCreationAction(button);assert.equal(calls,1);
    finish();await pending;assert.equal(button.disabled,false);
    context.window.CreationFlow.toWorkbench=async()=>{throw Error('模拟交接失败');};
    await assert.rejects(context.runAssetCreationAction(button),/模拟交接失败/);
    assert.equal(button.disabled,false,'failed handoff must allow retry');
});

test('asset provenance labels use recorded role and template rather than classification',()=>{
    const source=read('asset-manager');
    const start=source.indexOf('function renderAssetCreationActions('),end=source.indexOf('\nfunction assetCreationResult(',start);
    const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    const context=vm.createContext({assetKind:()=> 'image',escapeHtml:escape,escapeAttr:escape});
    vm.runInContext(source.slice(start,end),context);
    const item={id:'image',category:'角色分类',classification:{character:'仅分类'}};
    const unknown=context.renderAssetCreationActions(item,'asset');
    assert.match(unknown,/来源未记录，仍可作为参考图继续创作/);
    assert.doesNotMatch(unknown,/角色分类|仅分类/);
    const recorded=context.renderAssetCreationActions({...item,provenance:{character:{id:'role',name:'真实角色'},source:{itemId:'template',name:'<真实模板>'}}},'asset');
    assert.match(recorded,/角色：真实角色 · 模板：&lt;真实模板&gt;/);
});
