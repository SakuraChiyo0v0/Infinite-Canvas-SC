import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=n=>fs.readFileSync(new URL('../static/js/'+n+'.js',import.meta.url),'utf8');
const item={id:'old',name:'人物',positive:'draw a character',negative:'blur, watermark',scene:'private note',params:{size:'portrait'}};
for(const [name,fn] of [['asset-manager','promptContent'],['canvas','canvasPromptTemplateText'],['smart-canvas','promptTemplateText']]){
 const source=read(name),start=source.indexOf('function '+fn+'('),end=source.indexOf('\nfunction ',start+1);
 const context=vm.createContext({});vm.runInContext(source.slice(start,end),context);
 const text=context[fn](item);
 assert.match(text,/draw a character/);assert.match(text,/负向提示词:\nblur, watermark/);assert.ok(!text.includes('private note'));
 assert.equal(context[fn]({...item,positive:text,negative:''}),text,'save/reopen must not duplicate negative');
 if(name!=='asset-manager')assert.match(context[fn](item,'full'),/Params:\nsize: portrait/);
}
const source=read('asset-manager');
let payload;
const context=vm.createContext({promptSaveBusy:false,promptDraft:null,findPromptItem:()=>item,activePromptLibrary:()=>({id:'lib'}),document:{getElementById:id=>({value:{promptEditName:'人物',promptEditScene:'private note',promptEditPositive:'draw a character\n\n负向提示词:\nblur, watermark'}[id]})},apiJson:async(url,options)=>{payload=JSON.parse(options.body);return{};},promptLibrary:{},render(){},setStatus(){}});
const start=source.indexOf('async function savePromptEdit('),end=source.indexOf('\nasync function ',start+1);
vm.runInContext(source.slice(start,end),context);await context.savePromptEdit('old');
assert.equal(payload.negative,'');assert.match(payload.positive,/blur, watermark/);assert.equal(payload.scene,'private note');
assert.ok(!source.includes('id="promptEditNegative"'));
console.log('Unified prompt content, legacy negatives, save roundtrip and full canvas apply passed');
