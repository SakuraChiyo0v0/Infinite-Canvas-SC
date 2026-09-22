import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('static/js/smart-canvas.js');
function fn(name){
    const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
    assert.ok(start >= 0, name);
    const rest = source.slice(start);
    const next = rest.slice(1).search(/\n(?:async )?function /);
    return next < 0 ? rest : rest.slice(0, next + 1);
}
let serial = 0;
const requests = [];
let failSave = false;
const ctx = vm.createContext({console, Date, Map, Set, Promise, setTimeout,
    nodes:[], canvas:{connections:[]}, settings:{engine:'api', apiKind:'image'}, selectedId:'', selectedImage:{},
    uid:prefix => `${prefix}-${++serial}`, nowMs:()=>Date.now(),
    smartSettingsForNode:node => node.runSettings || {engine:'api',apiKind:'image'},
    cloneSmartSettings:s=>({...s}), smartPendingTasks:n=>n.pendingTasks || [],
    attachRunMeta(){}, scheduleSave(){}, render(){}, pushUndo(){},
    smartRecoverableImageTask:n=>(n.pendingTasks || []).find(t=>t.failed),
    mediaKindForItem:img=>img.kind || 'image',
    escapeHtml:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
    world:{querySelector:()=>null}, CSS:{escape:s=>s},
    fetch:async (url, options)=>{const body=JSON.parse(options.body); requests.push(body); return {
        ok:!failSave, json:async()=>failSave ? {detail:'目录不可写'} : {path:`D:/images/${body.entry_id}.png`, name:`${body.entry_id}.png`}};},
    nodeRect:()=>({width:260,height:180}), cloneSmartNode:n=>({...n}),
    loopOutputSlotsForRoot:()=>[], smartCascadePathForCtx:()=>null,
    addConnection:(from,to,kind)=>ctx.canvas.connections.push({from,to,kind}),
    resultMediaUrls:items=>items, cleanHistoryImages:imgs=>imgs.filter(i=>i.url),
    stripImageGenerationMeta:img=>img, copyMediaSizeFields:(_item,base)=>base,
    mediaNodeDefaultScale:()=>1, MEDIA_NODE_DEFAULT_SCALE:1, MEDIA_GROUP_PREVIOUS_DEFAULT_SCALE:1, MEDIA_GROUP_DEFAULT_SCALE:1,
});
vm.runInContext(read('static/js/canvas-lineage.js'),ctx);
vm.runInContext(read('static/js/smart-collector.js'),ctx);
for(const name of ['isSmartImageNode','isSmartGroupNode','connectInputNode','tagLoopOutputSlot','createLoopOutputSlot','imageRunProvenance','finalizeSmartPendingTask','mergeSmartNode']) vm.runInContext(fn(name),ctx);
const run = text=>vm.runInContext(text,ctx);
const drain = ()=>run('Promise.all([...collectorSaves.values()])');
run("nodes = [{id:'source',type:'smart-image',x:0,y:0,images:[]}]; createCollectorNode(400,0); selectedId = 'source';");
const collectorId=ctx.nodes[1].id;
run("createLoopOutputSlot(nodes[0],1,0,{})");
assert.equal(ctx.nodes.length,3,'unconnected loop keeps its original visible result node');
assert.equal(ctx.nodes[2].collectorJob,undefined);
assert.equal(requests.length,0,'no collector link means no automatic save');
run(`nodes.splice(2); canvas.connections=[]; connectInputNode('source','${collectorId}'); nodes[1].folder='D:/images';`);
assert.equal(run(`connectInputNode('${collectorId}','source')`),false,'collector is a terminal sink');
run("for(let i=0;i<8;i++){const job=createLoopOutputSlot(nodes[0],i+1,i,{}); job.pending=1; job.pendingTasks=[{taskId:'task-'+i}]; job.runLineage={parentResultId:'parent-'+i,character:{id:'role-a',name:'角色 A'},source:{libraryId:'templates',itemId:'portrait'}}; job.runPrompt='本次提示词'; job.runAt=100+i;}");
assert.equal(ctx.nodes.filter(n=>!n.collectorJob).length,2,'parallel runs create no visible result nodes');
run("for(const job of nodes.filter(n=>n.collectorJob).reverse()) finalizeSmartPendingTask(job,job.pendingTasks[0].taskId,[{url:'/assets/'+job.id+'.png'}]);");
await drain();
assert.equal(ctx.nodes.length,2,'completed runtime slots are removed');
assert.equal(ctx.nodes[1].entries.length,8);
assert.equal(new Set(ctx.nodes[1].entries.map(e=>e.sequence)).size,8);
assert.ok(ctx.nodes[1].entries.every(e=>e.status==='saved'));
assert.ok(ctx.nodes[1].entries.every(e=>e.provenance.character.id==='role-a' && e.provenance.source.itemId==='portrait'));
assert.deepEqual(new Set(ctx.nodes[1].entries.map(e=>e.provenance.parentResultId)),new Set(Array.from({length:8},(_,i)=>'parent-'+i)),'collector retains selected lineage after runtime nodes are removed');

failSave=true;
run("const failedJob=createCollectorJob(nodes[0]); failedJob.pendingTasks=[{taskId:'fail-save'}]; finalizeSmartPendingTask(failedJob,'fail-save',[{url:'/assets/retry.png',provenance:{version:1,resultId:'backend-result',parentResultId:'selected-parent',character:{id:'role-b'}}}]);");
await drain();
assert.equal(ctx.nodes[1].entries.at(-1).status,'failed');
assert.equal(ctx.nodes.length,2,'save failure keeps the record, not a result node');
failSave=false;
await run('retryCollector(nodes[1])');
assert.equal(ctx.nodes[1].entries.at(-1).status,'saved');
assert.equal(requests.at(-1).entry_id,requests.at(-2).entry_id,'retry uses the same idempotency key');
const count=requests.length;
await run('retryCollector(nodes[1])');
assert.equal(requests.length,count,'saved records are not resubmitted');

run("nodes=JSON.parse(JSON.stringify(nodes)); nodes[1].entries.at(-1).status='saving'; resumeCollectors();");
await drain();
assert.equal(ctx.nodes[1].entries.at(-1).status,'saved','refresh resumes interrupted saves');
assert.equal(ctx.nodes[1].entries.at(-1).provenance.resultId,'backend-result');
assert.equal(ctx.nodes[1].entries.at(-1).provenance.character.id,'role-b','retry and refresh preserve backend provenance');
const html=run('collectorBodyHtml(nodes[1])');
assert.equal((html.match(/<img /g)||[]).length,6,'default preview is bounded');
assert.ok(!run("safeCollectorUrl('javascript:alert(1)')"));

run("canvas.connections=[]; createLoopOutputSlot(nodes[0],30,0,{});");
assert.equal(ctx.nodes.at(-1).collectorJob,undefined,'disconnect restores original loop outputs');
console.log('Collector: opt-in routing, parallel results, cleanup, retry, persistence, bounded previews and provenance passed');
