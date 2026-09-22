import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const select = {};
const picker = {innerHTML:'',querySelector(){return select;}};
const wrap = {classList:{remove(){}}};
const changed = [];
const context = vm.createContext({window:{addEventListener(){}, StudioImageCapabilities:{localEnabled:()=>false}}, console,
  document:{head:{appendChild(){}},createElement(){return {textContent:'',get innerHTML(){return this.textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}};},getElementById(id){return id==='picker'?picker:id==='wrap'?wrap:{};}},
  localStorage:{getItem(){return null;},setItem(){}},
  fetch:async () => ({ok:true,json:async () => ({providers:[
    {id:'a',name:'A',image_configured:true,image_models:['same','second']},
    {id:'b',name:'B',image_configured:true,image_models:['same']},
    {id:'modelscope',image_configured:true,image_models:['retired']}
  ]})})
});
vm.runInContext(readFileSync(new URL('../static/js/cli-image-tools.js',import.meta.url),'utf8'),context);
const pickerApi = context.window.StudioCliImageTools.create({selectId:'picker',wrapId:'wrap',hintId:'hint',storageKey:'test',localModel:'Local',onChange:mode=>changed.push(mode)});
await pickerApi.refresh();
assert.equal(pickerApi.selected().id,'a');
assert.doesNotMatch(picker.innerHTML,/本地 ComfyUI/);
const values = [...picker.innerHTML.matchAll(/<option value="([^"]*)"[^>]*>(.*?)<\/option>/g)];
assert.equal(values.length,3);
const [,encoded] = values.find(([, ,label]) => label==='same · B');
assert.equal(encoded,'[&quot;b&quot;,&quot;same&quot;]', 'JSON IDs must be escaped as HTML attributes');
select.onchange({target:{value:encoded.replace(/&quot;/g,'"')}});
assert.equal(pickerApi.selected().id,'b');
assert.equal(pickerApi.selected().image_models[0],'same');
assert.equal(changed.at(-1),'cli');
select.onchange({target:{value:'["a","second"]'}});
assert.equal(pickerApi.selected().image_models[0],'second');
console.log('Image tool model picker selects exact provider/model pairs');

context.window.StudioImageCapabilities.localEnabled=()=>true;
await pickerApi.refresh();
assert.match(picker.innerHTML,/本地 ComfyUI/);
select.onchange({target:{value:'["local-comfy","Local"]'}});
assert.equal(pickerApi.selected().local,true);
context.window.StudioImageCapabilities.localEnabled=()=>false;
await pickerApi.refresh();
assert.equal(pickerApi.selected().id,'a','disabled local selection migrates to configured online model');
