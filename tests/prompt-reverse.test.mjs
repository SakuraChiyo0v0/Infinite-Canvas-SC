import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync('static/js/prompt-handoff.js','utf8');
function run(target,data){
 const store=new Map([['studio_prompt_handoff',JSON.stringify(data)]]),events={},els=new Map();
 const el=id=>{if(!els.has(id))els.set(id,{value:'',src:'',classList:{remove(){}},dispatchEvent(){},focus(){}});return els.get(id);};
 const context=vm.createContext({location:{pathname:target==='klein'?'/static/klein.html':'/static/online.html',origin:'http://localhost'},sessionStorage:{getItem:k=>store.get(k),removeItem:k=>store.delete(k)},document:{readyState:'complete',getElementById:el},window:{addEventListener:(t,f)=>events[t]=f,scrollTo(){}},parent:{},base64Images:{1:'old',2:'old'},uploadedNames:{1:'old'},clearSlot(i){context.base64Images[i]='';},Event:class{},Date});
 vm.runInContext(script,context);return {store,els,context,events};
}
const payload={target:'klein',prompt:'蓝围巾人物',image:{url:'/assets/ref.png'},createdAt:Date.now()};
let state=run('zimage',payload);assert.ok(state.store.has('studio_prompt_handoff'),'other target must not consume');
state=run('klein',payload);assert.equal(state.els.get('promptInput').value,payload.prompt);assert.equal(state.context.base64Images[1],payload.image.url);assert.equal(state.context.base64Images[2],'');assert.equal(state.store.size,0,'consume only once');
state=run('zimage',{...payload,target:'zimage',image:null});assert.equal(state.els.get('promptInput').value,payload.prompt);assert.equal(state.context.base64Images[1],'old','text generation does not add references');
const html=fs.readFileSync('static/index.html','utf8');const ids=[...html.matchAll(/class="nav-item(?: active)?" onclick="switchUI\(this, '([^']+)'\)/g)].map(m=>m[1]);assert.deepEqual(ids.slice(0,5),['zimage','klein','prompt-reverse','enhance','angle']);
console.log('prompt reverse: navigation and single-use image/text handoff passed');
