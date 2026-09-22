import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const helper=readFileSync(new URL('../static/js/canvas-lineage.js',import.meta.url),'utf8');
const smart=readFileSync(new URL('../static/js/smart-canvas.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const extract=name=>{const match=smart.match(new RegExp(`^(?:async )?function ${name}\\([^\\n]*\\)[^\\n]*\\n[\\s\\S]*?^\\}`,'m'));assert.ok(match,name);return match[0];};
const role={id:'role-a',name:'角色 A',description:'红色围巾',references:[{url:'/assets/role-a.png'}]};
const parent={version:1,resultId:'prior-result',character:role,source:{libraryId:'templates',itemId:'portrait',name:'肖像'}};
const create=(extra={})=>{const h=vm.createContext({console,...extra});vm.runInContext(helper,h);return h;};

test('selected input lineage survives next result with current request parameters',async()=>{
    const h=create();
    const refs=h.CanvasLineage.enrich([{url:'/output/parent.png',nodeId:'n',name:'上轮结果'}],[{id:'n',images:[{url:'/output/parent.png',provenance:parent}]}]);
    const lineage=await h.CanvasLineage.choose(refs);
    const prompt=h.CanvasLineage.compose('改为夜景',lineage);
    const output=h.CanvasLineage.result({lineage,prompt,inputRefs:refs,settings:{provider_id:'p',model:'m',size:'1536x1024',quality:'high',count:2},createdAt:42},'/output/new.png');
    assert.equal(output.character.id,'role-a');assert.equal(output.parentResultId,'prior-result');
    assert.equal(output.source.itemId,'portrait');assert.equal(output.size,'1536x1024');assert.equal(output.n,2);
    assert.match(output.prompt,/角色 A/);assert.equal(output.references[0].url,'/output/parent.png');
    assert.notEqual(output.resultId,parent.resultId);
});

test('unknown or conflicting copies of a URL do not invent a role',async()=>{
    const h=create();
    const refs=h.CanvasLineage.enrich([{url:'/same.png'}],[{images:[{url:'/same.png',provenance:parent}]},{images:[{url:'/same.png',provenance:{...parent,character:{id:'other'}}}]}]);
    assert.equal(refs[0].provenance,undefined);
    const value=await h.CanvasLineage.choose(refs);
    assert.equal(value.character,null);assert.equal(value.parentResultId,'');
});

function dialogFixture(){
    const nodes=[];
    const element=tag=>({tag,children:[],listeners:{},value:'',append(...items){this.children.push(...items);},
        setAttribute(){},focus(){},showModal(){},remove(){},addEventListener(type,fn){this.listeners[type]=fn;},close(){this.listeners.close?.();}});
    return {nodes,document:{createElement:element,body:{append(node){nodes.push(node);}}}};
}
test('multiple role inputs require explicit choice, allow no identity and cancellation',async()=>{
    const fixture=dialogFixture();const h=create(fixture);
    const refs=[{name:'A',provenance:parent},{name:'B',provenance:{resultId:'other-result',character:{id:'role-b',name:'角色 B'},source:{name:'另一模板'}}}];
    let pending=h.CanvasLineage.choose(refs);
    let dialog=fixture.nodes.at(-1);assert.equal(dialog.children[3].disabled,true);
    dialog.children[2].value='1';dialog.children[2].onchange();dialog.children[3].onclick();
    const selected=await pending;assert.equal(selected.character.id,'role-b');assert.equal(selected.parentResultId,'other-result');
    pending=h.CanvasLineage.choose(refs);dialog=fixture.nodes.at(-1);
    dialog.children[2].value='none';dialog.children[3].onclick();assert.equal((await pending).character,null);
    pending=h.CanvasLineage.choose(refs);fixture.nodes.at(-1).children[4].onclick();assert.equal(await pending,null);
});

test('unresolved variables stop API submission before any request',async()=>{
    let calls=0;const h=create({settings:{},fetch:async()=>{calls++;},tr:x=>x});
    vm.runInContext(extract('runApiGeneration'),h);
    await assert.rejects(h.runApiGeneration('角色 {{CHARACTER_NAME}}',[],{provider_id:'p',model:'m'}),/CHARACTER_NAME/);
    assert.equal(calls,0);
});

test('queued API payload receives chosen identity and parent, not arbitrary refs',async()=>{
    let payload;
    const h=create({settings:{},tr:x=>x,API_RATIO_VALUES:{},SMART_REFERENCE_IMAGE_MAX:3,
        sizeForRun:()=> '1024x1536',imageRefsOnly:refs=>refs,
        fetch:async(_url,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>({task_id:'task'})};}});
    vm.runInContext(extract('runApiGeneration'),h);
    const lineage={parentResultId:'selected-parent',character:role,source:parent.source};
    const result=await h.runApiGeneration('完成提示词',[{url:'/assets/a.png'}],{provider_id:'p',model:'m',count:1},lineage);
    assert.equal(payload.provenance.character.id,'role-a');assert.equal(payload.provenance.parentResultId,'selected-parent');
    assert.equal(result.taskIds[0],'task');assert.equal(payload.size,'1024x1536');
});

test('asset import and result normalization retain optional provenance',()=>{
    const h=create({assetMediaKind:()=> 'image'});
    vm.runInContext(['copyMediaSizeFields','assetNodeImageFromItem','resultMediaUrls'].map(extract).join('\n'),h);
    const source={url:'/assets/saved.png',name:'作品',natural_w:1200,natural_h:800,provenance:parent};
    const imported=h.assetNodeImageFromItem(source);
    assert.equal(imported.provenance.character.id,'role-a');assert.equal(imported.natural_w,1200);
    const normalized=h.resultMediaUrls({image_items:[source]});
    assert.equal(normalized[0].provenance.resultId,'prior-result');
    assert.equal(h.assetNodeImageFromItem({url:'/assets/legacy.png'}).provenance,undefined);
});

test('finished async results retain backend identity and old-service fallback lineage',()=>{
    const h=create({settings:{},smartPendingTasks:n=>n.pendingTasks || [],cleanHistoryImages:x=>x,
        stripImageGenerationMeta:x=>x,collectGeneratedImages(){},collectorFinishJob(){},nowMs:()=>9,
        mediaNodeDefaultScale:()=>1,MEDIA_NODE_DEFAULT_SCALE:1,MEDIA_GROUP_PREVIOUS_DEFAULT_SCALE:1,MEDIA_GROUP_DEFAULT_SCALE:1});
    vm.runInContext(['copyMediaSizeFields','resultMediaUrls','imageRunProvenance','finalizeSmartPendingTask'].map(extract).join('\n'),h);
    const node={pendingTasks:[{taskId:'t'}],pending:1,images:[],runModelPrompt:'本次提示词',runSettings:{model:'m'},runLineage:{character:role,parentResultId:'prior-result',source:parent.source},runAt:4};
    h.finalizeSmartPendingTask(node,'t',[{url:'/output/new.png',provenance:{...parent,resultId:'server-result'}}]);
    assert.equal(node.images[0].provenance.resultId,'server-result');
    const legacy={...node,pendingTasks:[{taskId:'t2'}],pending:1,images:[]};
    h.finalizeSmartPendingTask(legacy,'t2',['/output/old-service.png']);
    assert.equal(legacy.images[0].provenance.character.id,'role-a');assert.equal(legacy.images[0].provenance.parentResultId,'prior-result');
});


test('empty input stays blocked before a selected role can supply synthetic prompt text',async()=>{
    let choices=0;const messages=[];
    const h=create({settings:{},smartLoopContext:null,selectedNode:()=>({id:'n'}),
        buildPromptRequest:()=>({prompt:'',refs:[]}),smartNodeInFlight:()=>false,
        smartRunNeedsPrompt:()=>true,smartSettingsForNode:()=>({}),tr:x=>x,
        chooseSmartRunLineage:async()=>{choices++;return {character:role};},toast:x=>messages.push(x)});
    vm.runInContext(extract('runGeneration'),h);
    await h.runGeneration();
    assert.equal(choices,0);assert.deepEqual(messages,['smart.toastNeedPrompt']);
});


test('canvas render preserves mounted composer during pointer and keyboard interaction',()=>{
    const noOp=()=>{};let mounts=0;
    const composer={parentNode:null};
    const world={classList:{toggle:noOp},querySelectorAll:()=>[],childNodes:[composer],
        appendChild(el){mounts++;el.parentNode=this;},insertAdjacentHTML:noOp};
    composer.parentNode=world;
    const base={nodes:[],world,composer,promptInput:{},syncSmartEmptyState:()=>{},document:{activeElement:{closest:()=>null},
        createElement:()=>({content:{querySelector:()=>null}})},window:{},smartWorkflowTransferModal:null,
        selectedNodeIds:()=>[],captureMediaPlaybackStates:()=>[],renderConnections:()=>'',
        SMART_LOG_PREVIEW_NODE_ID:'log',isSmartGroupNode:()=>false};
    for(const name of ['rememberInlineVideoActivations','restoreMediaPlaybackStates','bindNodeEvents','bindConnectionEvents','updateComposer','renderMinimap','bindSmartPreviewImageFallbacks','syncSmartSelectedImageResolution','measureSmartNodeImages','refreshRunTimerPills'])base[name]=noOp;
    const h=create(base);vm.runInContext(extract('render'),h);
    h.render();h.render();
    assert.equal(mounts,0,'render between mousedown and click must not detach/reinsert the focused button');
    assert.equal(composer.parentNode,world);
    composer.parentNode=null;h.render();
    assert.equal(mounts,1,'an unmounted composer still mounts normally');
});


test('empty canvas start card and composer inert state follow actual visibility',()=>{
    const card={hidden:true};const classes=new Set();
    const composer={classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}};
    const h=create({nodes:[],composer,document:{getElementById:id=>id==='smartEmptyState'?card:null}});
    vm.runInContext(extract('syncSmartEmptyState')+'\n'+extract('setComposerOpen'),h);
    h.syncSmartEmptyState();assert.equal(card.hidden,false);
    h.setComposerOpen(false);assert.equal(composer.inert,true);assert.equal(classes.has('open'),false);
    h.nodes.push({id:'first'});h.syncSmartEmptyState();assert.equal(card.hidden,true);
    h.setComposerOpen(true);assert.equal(composer.inert,false);assert.equal(classes.has('open'),true);
    h.nodes.length=0;h.syncSmartEmptyState();assert.equal(card.hidden,false,'removing last node restores the visible entry');
});
