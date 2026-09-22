const {test}=require('node:test');
const assert=require('node:assert/strict');
const V=require('../static/js/vision-routing.js');
const judge={id:'j',type:'visionJudge',mode:'review',provider:'p',model:'m',instruction:'检查图片'};
const ns=[{id:'input',type:'image'},judge,{id:'yes',type:'generator'},{id:'no',type:'generator'},{id:'unknown',type:'output'}];
const es=[{id:'in',from:'input',to:'j'},...['pass','fail','unknown'].map((p,i)=>({id:p,from:'j',to:['yes','no','unknown'][i],fromPort:p}))];
const p=()=>V.plan(ns,es,'yes');

test('only selected branch runs, with original image',async()=>{
    for(const selected of ['pass','fail','unknown']){
        const calls=[]; const run=V.createRun(p());
        await V.execute(run,async(n,values)=>{calls.push(n.id);if(n.id==='input')return {refs:[{url:'original',kind:'image'}]};if(n.id==='j')return {refs:values[0].value.refs,branchId:selected,reason:'ok',suggestion:''};assert.equal(values[0].value.refs[0].url,'original');return {};});
        assert.deepEqual(calls,['input','j',({pass:'yes',fail:'no',unknown:'unknown'})[selected]]);
        assert.equal(run.status,'done');
    }
});
test('branch text is opt in',async()=>{
    const plan=V.plan(ns,es.map(e=>e.id==='fail'?{...e,textField:'suggestion'}:e),'j');
    await V.execute(V.createRun(plan),async(n,values)=>{if(n.id==='j')return {refs:[{url:'a'}],branchId:'fail',reason:'reason',suggestion:'fix'};if(n.id==='no')assert.equal(values[0].value.text,'fix');return {};});
});
test('parallel rounds do not share results',async()=>{
    const seen=[];const run=V.createRun(p(),{rounds:3,parallel:3});
    await V.execute(run,async(n,values,round)=>{
        if(n.id==='input')return {refs:[{url:`image-${round.id}`}]};
        if(n.id==='j'){await new Promise(r=>setTimeout(r,(3-round.id)*5));return {refs:values[0].value.refs,branchId:round.id%2?'fail':'pass'};}
        seen.push([round.id,n.id,values[0].value.refs[0].url]);return {};
    });
    assert.deepEqual(seen.sort(),[[0,'yes','image-0'],[1,'no','image-1'],[2,'yes','image-2']]);
});
test('failed judgment can retry without regenerating upstream',async()=>{
    const run=V.createRun(p());let inputCalls=0,judgeCalls=0;
    const adapter=async n=>{if(n.id==='input'){inputCalls++;return {refs:[{url:'a'}]};}if(n.id==='j'){if(++judgeCalls===1)throw Error('offline');return {branchId:'pass',refs:[]};}return {};};
    await V.execute(run,adapter);assert.equal(run.status,'failed');
    await V.execute(run,adapter);assert.equal(run.status,'done');assert.equal(inputCalls,1);assert.equal(judgeCalls,2);
});
test('stop discards late result and dispatches no downstream',async()=>{
    const run=V.createRun(p());let release;const pending=new Promise(r=>release=r),calls=[];
    const execution=V.execute(run,async n=>{calls.push(n.id);if(n.id==='j'){await pending;return {branchId:'pass'};}return {};});
    await new Promise(r=>setImmediate(r));run.stopped=true;release();await execution;
    assert.deepEqual(calls,['input','j']);assert.equal(run.rounds[0].outputs.j,undefined);assert.equal(run.status,'stopped');
});
test('one exit fanout and retry preserve completed sibling',async()=>{
    const nodes=[...ns,{id:'sibling',type:'generator'}],edges=[...es,{id:'extra',from:'j',to:'sibling',fromPort:'pass'}];
    const run=V.createRun(V.plan(nodes,edges,'j'));let yesCalls=0,siblingCalls=0;
    const adapter=async n=>{if(n.id==='j')return {branchId:'pass'};if(n.id==='yes')yesCalls++;if(n.id==='sibling'&&++siblingCalls===1)throw Error('failure');return {};};
    await V.execute(run,adapter);await V.execute(run,adapter);assert.equal(yesCalls,1);assert.equal(siblingCalls,2);
});
test('cycle, reconvergence via output, dangling port, multiple loops rejected',()=>{
    assert.throws(()=>V.plan(ns,[...es,{from:'yes',to:'j'}],'j'),/回连/);
    assert.throws(()=>V.plan(ns,[...es,{from:'unknown',to:'yes'}],'j'),/汇合/);
    assert.throws(()=>V.plan(ns,es.map(e=>e.id==='pass'?{...e,fromPort:'missing'}:e),'j'),/无效出口/);
    assert.throws(()=>V.plan([...ns,{id:'l1',type:'loop'},{id:'l2',type:'loop'}],[...es,{from:'l1',to:'j'},{from:'l2',to:'j'}],'j'),/一个固定/);
});
test('shared static input does not include unrelated workflow',()=>{
    const plan=V.plan([...ns,{id:'unrelated',type:'generator'}],[...es,{from:'input',to:'unrelated'}],'j');
    assert.equal(plan.byId.has('unrelated'),false);
});
test('version capability checks',()=>{
    V.validateVersion({version:1,nodes:[]});V.validateVersion({version:2,nodes:[judge],requiredFeatures:V.features});
    assert.throws(()=>V.validateVersion({version:1,nodes:[judge]}),/版本 2/);
    assert.throws(()=>V.validateVersion({version:2,nodes:[],requiredFeatures:['unsupported']}),/不支持/);
});
