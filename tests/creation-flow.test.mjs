import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const key='studio_creation_handoff_v1';
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
function harness(){
    const storage=new Map(),events={},buttons=[],messages=[],requests=[];
    const parent={postMessage:(...args)=>messages.push(args)};
    const context=vm.createContext({console,crypto:{randomUUID},queueMicrotask,
        location:{origin:'http://isolated.test',assign(){}},parent,
        document:{readyState:'complete',body:{append:el=>buttons.push(el)},createElement:()=>({style:{},remove(){this.removed=true;}})},
        sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
        addEventListener:(name,fn)=>(events[name]??=[]).push(fn),removeEventListener(){},
        fetch:async(url,options={})=>{requests.push({url,body:options.body&&JSON.parse(options.body)});return {ok:true,json:async()=>({})};}
    });
    for(const name of ['prompt-creation-core','creation-flow'])vm.runInContext(readFileSync(new URL(`../static/js/${name}.js`,import.meta.url),'utf8'),context);
    const send=(data,origin='http://isolated.test',source=parent)=>events.message?.forEach(fn=>fn({data,origin,source}));
    return {flow:context.CreationFlow,storage,buttons,messages,requests,send,parent};
}
const plain=v=>JSON.parse(JSON.stringify(v));

test('existing canvas append preserves user graph, viewport, settings and version; names are unique',()=>{
    const h=harness(),base={title:'保留标题',icon:'layers',updated_at:80,nodes:[{id:'prompt-result',x:100,y:22,w:500,custom:{hello:true}}],connections:[{from:'a',to:'b',port:3}],viewport:{x:12,y:-18,scale:.7},settings:{model:'original',custom:1},logs:[{text:'keep'}]};
    const graph={nodes:[{id:'prompt-source',x:40},{id:'prompt-result',x:460}],connections:[{id:'edge',from:'prompt-source',to:'prompt-result'}]};
    const next=plain(h.flow.appendGraph(base,graph,'new'));
    assert.deepEqual(next.nodes[0],base.nodes[0]);assert.equal(next.nodes[1].x,800);
    assert.deepEqual(next.connections[0],base.connections[0]);assert.deepEqual(next.connections[1],{id:'new-edge',from:'new-prompt-source',to:'new-prompt-result'});
    for(const field of ['viewport','logs','settings','title','icon'])assert.deepEqual(next[field],base[field]);
    assert.equal(next.base_updated_at,80);assert.equal(base.nodes.length,1);assert.equal(graph.nodes[0].id,'prompt-source');
    const twice=plain(h.flow.appendGraph({...next,updated_at:81},graph,'next'));
    assert.equal(new Set(twice.nodes.map(n=>n.id)).size,twice.nodes.length);
});
test('provenance excludes configs and credentials but preserves identity and supported legacy references',()=>{
    const h=harness();const value=plain(h.flow.provenance({id:'r',parentResultId:'p',prompt:'hello',quality:'high',n:2,api_key:'secret',config:{password:'secret'},character:{id:'c',name:'角色',api_key:'secret',references:[{url:'/api/view?filename=a.png',token:'secret'}]},source:{libraryId:'l',itemId:'i',name:'模板',token:'secret'},references:[{url:'/api/storage-files/local/a.png'},{url:'javascript:alert(1)'}]}));
    assert.equal(value.resultId,'r');assert.equal(value.parentResultId,'p');assert.equal(value.quality,'high');assert.equal(value.n,2);
    assert.equal(value.character.references.length,1);assert.equal(value.references.length,1);assert.doesNotMatch(JSON.stringify(value),/secret|config|api_key/);
    assert.equal(h.flow.provenance({provenance:{resultId:'old',prompt:'saved'}}).resultId,'old');
});
test('handoff guards origin/source and retains declined payload until explicit retry',async()=>{
    const h=harness();let calls=0,accept=false;
    h.flow.listen('klein',async()=>{calls++;return accept;});await settle();
    h.storage.set(key,JSON.stringify({id:'a',target:'klein',createdAt:Date.now(),payload:{prompt:'new'}}));
    h.send({type:'creation-flow-ready'},'https://other.test');h.send({type:'creation-flow-ready'},undefined,{});await settle();assert.equal(calls,0);
    h.send({type:'creation-flow-ready'});await settle();assert.equal(calls,1);assert.ok(h.storage.has(key));assert.equal(h.buttons.length,1);
    h.send({type:'creation-flow-ready'});await settle();assert.equal(calls,1);
    accept=true;await h.buttons[0].onclick();assert.equal(calls,2);assert.equal(h.storage.has(key),false);
});
test('concurrent notifications cannot consume twice or remove a newer pending handoff',async()=>{
    const h=harness();let complete,calls=0;
    h.storage.set(key,JSON.stringify({id:'old',target:'klein',createdAt:Date.now(),payload:{prompt:'old'}}));
    h.flow.listen('klein',()=>{calls++;return new Promise(r=>complete=r);});await settle();
    h.send({type:'creation-flow-ready'});assert.equal(calls,1);
    h.storage.set(key,JSON.stringify({id:'new',target:'klein',createdAt:Date.now(),payload:{prompt:'new'}}));
    complete(true);await settle();assert.equal(JSON.parse(h.storage.get(key)).id,'new');assert.equal(calls,2,'newer payload must get a receiver notification after the previous one finishes');
});
test('expired handoff is discarded and legacy reverse handoff uses the same guarded receiver',async()=>{
    const h=harness();let received;
    h.storage.set(key,JSON.stringify({id:'expired',target:'klein',createdAt:Date.now()-3700000,payload:{prompt:'old'}}));
    h.flow.listen('klein',async payload=>{received=payload;return true;});await settle();assert.equal(received,undefined);assert.equal(h.storage.has(key),false);
    h.storage.set('studio_prompt_handoff',JSON.stringify({target:'klein',createdAt:Date.now(),prompt:'reverse',image:{url:'/assets/input/a.png'}}));
    h.send({type:'prompt-handoff-ready'});await settle();assert.equal(received.prompt,'reverse');assert.equal(received.references[0].url,'/assets/input/a.png');assert.equal(h.storage.has('studio_prompt_handoff'),false);
});
test('result handoff creates a branch with current image, prior identity and parent; no iframe reload',async()=>{
    const h=harness();await h.flow.toWorkbench({id:'prior',url:'/assets/result.png',prompt:'actual',character:{id:'c',name:'role',references:[]},source:{name:'template'},model:'m',provider:'p'});
    const draft=h.requests[0].body.value;assert.equal(draft.parentResultId,'prior');assert.equal(draft.character.id,'c');assert.equal(draft.references[0].url,'/assets/result.png');assert.equal(draft.useCharacterReferences,false);
    const entry=JSON.parse(h.storage.get(key));assert.equal(entry.target,'prompts');assert.ok(entry.payload.branchId);assert.equal(h.messages[0][0].type,'creation-flow-open');
});
test('variable check deduplicates unresolved placeholders',()=>assert.deepEqual(plain(harness().flow.variables('A {{ NAME }} {{NAME}} {{场景}}')),['NAME','场景']));
