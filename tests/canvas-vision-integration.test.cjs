const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const V=require('../static/js/vision-routing.js');
const source=fs.readFileSync('static/js/canvas.js','utf8');
function fn(name){
    const match=new RegExp(`^(?:async )?function ${name}\\(`,'m').exec(source);
    assert.ok(match,name);return source.slice(match.index,source.indexOf('\n}',match.index)+2);
}
function harness(){
    let seq=0;const tasks=new Map(),requests=[],live=[{id:'gen',type:'generator',generatedOutputs:['stale']}];
    const context=vm.createContext({console,AbortController,VisionRouting:V,nodes:live,connections:[],Date,
        CANVAS_REFERENCE_IMAGE_MAX:8,CANVAS_GENERATOR_TYPES:['generator'],CANVAS_MEDIA_OUTPUT_TYPES:['generator'],
        outputUrlValue:x=>typeof x==='string'?x:x?.url,mediaKindForOutputItem:()=> 'image',outputImageName:()=> 'image',
        tr:k=>k,nowMs:()=>Date.now(),alert:m=>{throw Error(m);},uid:()=>String(++seq),
        imageRefsOnly:a=>a.filter(r=>r.kind==='image'),videoRefsOnly:()=>[],
        cascadeTargetIdFromOptions:o=>o.cascadeTargetId || '',resolveImageProviderId:x=>x,resolveImageModel:x=>x,
        generatorSizeForRun:async()=> '1024x1024',normalizedImageQuality:()=>'',runSnapshot:(n,prompt,refs)=>({prompt,refs,node:{id:n.id}}),
        createCanvasImageTask:async p=>{const id=++seq;requests.push(p);tasks.set(id,p);return {task_id:id};},
        waitCanvasImageTaskResult:async id=>{await new Promise(r=>setTimeout(r,id%2?5:1));return {images:[`/assets/result-${id}.png`]};},
        requestMetaFromResult:()=>({}),addGenerationLog(){},refreshRunNodes(){},refreshNodes(){},scheduleSave(){},isCascadeAbortError:()=>false,
        showErrorModal:m=>{throw Error(m);},
        chatApiProviders:()=>[{id:'p',chat_models:['m']}],mediaKindForNode:()=> 'image',
        resolveChatProviderId:x=>x,resolveChatModel:x=>x,
        cascadeFetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({text:'LLM result'})};}
    });
    for(const name of ['generatorSources','orderedSources','outputForNode','syncConnectedOutputsFromGenerated','generatedImageRefs','mergeGeneratedOutputs','runGenerator','runCascadeNodeByType','llmInputText','llmInputImages','llmInputVideos','callCanvasLLM','runLLMNode','serializableCanvasNode'])vm.runInContext(fn(name),context);
    vm.runInContext(fs.readFileSync('static/js/canvas-vision-judge.js','utf8'),context);
    return {context,requests,live};
}
test('real generator adapter consumes private round sources and leaves shared output untouched',async()=>{
    const h=harness();const run={id:'test',allNodes:new Map()},node={id:'gen',type:'generator',apiProvider:'p',model:'m',count:1};
    const go=i=>h.context.visionExecuteNode(node,[{edge:{id:'edge'},value:{refs:[{url:`/assets/input-${i}.png`,kind:'image'}],text:`prompt-${i}`}}],{index:i,total:2},run);
    const results=await Promise.all([go(1),go(2)]);
    assert.equal(h.requests.length,2);assert.equal(h.requests[0].prompt,'prompt-1');assert.equal(h.requests[1].prompt,'prompt-2');
    assert.equal(h.requests[0].reference_images[0].url,'/assets/input-1.png');
    assert.notEqual(results[0].refs[0].url,results[1].refs[0].url);
    assert.deepEqual(h.live[0].generatedOutputs,['stale']);
});
test('real LLM adapter receives branch image and appended text without history',async()=>{
    const h=harness();const result=await h.context.visionExecuteNode({id:'llm',type:'llm',llmProvider:'p',model:'m'},[
        {edge:{id:'own'},value:{text:'original instruction',refs:[]}},
        {edge:{id:'judge'},value:{text:'fix suggestion',refs:[{url:'/assets/input.png',kind:'image'}]}}
    ],{index:1,total:1},{id:'run',allNodes:new Map()});
    assert.equal(result.text,'LLM result');assert.deepEqual(JSON.parse(JSON.stringify(h.requests[0].images)),['/assets/input.png']);
    assert.equal(h.requests[0].message,'original instruction\n\nfix suggestion');assert.equal(h.requests[0].messages.length,0);
});
test('loop adapter selects images and counters from this round',async()=>{
    const h=harness();const value=await h.context.visionExecuteNode({id:'loop',type:'loop',imageInput:true,imageBatchSize:1,showPrompt:true,variablePrompt:'round 《计数》 / 《总数》'},[
        {edge:{id:'in'},value:{refs:[{url:'a'},{url:'b'}],text:''}}
    ],{index:2,total:2},{allNodes:new Map()});
    assert.equal(value.refs[0].url,'b');assert.equal(value.text,'round 2 / 2');
});
test('snapshot serialization drops executable runtime fields and retains branch identity',()=>{
    const h=harness(),node={id:'judge',type:'visionJudge',branches:[{id:'stable',label:'新名称'}],_visionRun:true,_visionSources:[],running:true};
    const copy=h.context.serializableCanvasNode(node);assert.equal(copy.branches[0].id,'stable');assert.equal(copy._visionRun,undefined);assert.equal(copy._visionSources,undefined);
});
test('execution commits visible instruction even before a blur event',()=>{
    const h=harness(),node={id:'j',instruction:'old',visionRecords:[]};let saved=0;
    h.context.CSS={escape:s=>s};h.context.scheduleSave=()=>saved++;
    h.context.document={querySelector:s=>s.endsWith('.vision-result')?null:{querySelector:()=>({value:'new visible instruction'})}};
    h.context.commitVisionInputs(node);assert.equal(node.instruction,'new visible instruction');assert.equal(node.visionStale,true);assert.equal(saved,1);
});
test('old generator still uses its existing source and output path',()=>{
    const h=harness();h.context.nodes=[{id:'p',type:'prompt',text:'legacy prompt'},{id:'gen',type:'generator'}];h.context.connections=[{from:'p',to:'gen'}];
    const sources=h.context.generatorSources(h.context.nodes[1]);assert.equal(sources[0].prompt,'legacy prompt');
    let called=0;h.context.shouldCreateOutputForNode=()=>{called++;return false;};
    assert.equal(h.context.outputForNode(h.context.nodes[1]),null);assert.equal(called,1);
});
test('replacing input invalidates a previous result and failed requests do not highlight old exits',()=>{
    const h=harness(),node={id:'j',type:'visionJudge',provider:'p',model:'m',mode:'review',instruction:'inspect',visionStatus:'done'};
    h.context.nodes=[node,{id:'img',type:'image',url:'new.png'}];h.context.connections=[{from:'img',to:'j'}];
    h.context.mediaRefsFromNode=n=>[{url:n.url,kind:'image'}];
    const record={branchId:'pass',configKey:h.context.visionConfigKey(node),refs:[{url:'old.png'}],inputKey:JSON.stringify(['old.png'])};
    node.visionRecords=[record];assert.equal(h.context.visionRecordStale(node,record),true);
    record.inputKey=JSON.stringify(['new.png']);assert.equal(h.context.visionRecordStale(node,record),false);
    node.visionStatus='failed';assert.equal(h.context.visionLinkClass({from:'j',fromPort:'pass'}),'');
});
test('parallel failures retain each round error instead of overwriting the failed record',()=>{
    const h=harness(),node={id:'j',type:'visionJudge',provider:'p',model:'m',mode:'review',instruction:'inspect'};
    h.context.nodes=[node];h.context.renderLinks=()=>{};
    const run={id:'failed-run',status:'failed',plan:{incoming:new Map([['j',[{from:'img'}]]])}};
    h.context.run=run;vm.runInContext('visionRuns.set(run.id,run)',h.context);
    h.context.visionPublish(node,{index:1,states:{j:'failed'},errors:{j:'offline'},outputs:{img:{refs:[{url:'one.png'}]}}},run);
    h.context.visionPublish(node,{index:2,states:{j:'interrupted'},errors:{},outputs:{img:{refs:[{url:'two.png'}]}}},run);
    assert.equal(node.visionRecords.length,2);assert.equal(node.visionRecords[0].reason,'offline');assert.equal(node.visionRecords[1].status,'interrupted');
});
for(const mode of ['serial','parallel']) test(`legacy ${mode} loop keeps upstream ordering through output relay`,async()=>{
    const calls=[],finished=[];
    const c=vm.createContext({console,VisionRouting:V,loopContext:null,
        nodes:[{id:'loop',type:'loop',count:3,mode,loopStart:2},{id:'gen',type:'generator'},{id:'out',type:'output'},{id:'llm',type:'llm'}],
        connections:[{from:'loop',to:'gen'},{from:'gen',to:'out'},{from:'out',to:'llm'}],
        refreshNodes(){},alert:m=>{throw Error(m);},tr:k=>k,
        beginCascade:()=>({}),ensureCascadeActive(){},cascadeUiNodeIds:(_,ids)=>ids,cascadeParallelLimit:()=>2,
        isCascadeAbortError:()=>false,finalizeCascade:(_,state)=>finished.push(state),
        runCascadeNodeWithLoopContext:async(n,round)=>{calls.push([round.index,n.id]);await new Promise(r=>setImmediate(r));}
    });
    c.visionHasWorkflow=id=>V.containsJudge(c.nodes,c.connections,id);
    for(const name of ['canvasRunTypes','computeCascadeOrder','upstreamNodeIds','resolveCascadeLoop','loopCount','runLimitedCascadeRounds','runNodeCascade']) vm.runInContext(fn(name),c);
    await c.runNodeCascade('llm');assert.deepEqual(finished,['done']);assert.equal(calls.length,6);
    for(const index of [2,3,4])assert.deepEqual(calls.filter(x=>x[0]===index).map(x=>x[1]),['gen','llm']);
});
