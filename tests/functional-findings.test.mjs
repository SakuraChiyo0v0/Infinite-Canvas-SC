import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = file => readFileSync(new URL('../'+file, import.meta.url),'utf8');
const source = read('static/enhance.html');
const elements = new Map();
const element = id => { if(!elements.has(id)) elements.set(id,{disabled:false,innerText:'',classList:{remove(){},add(){},replace(){}}}); return elements.get(id); };
const requests=[];
const context=vm.createContext({
 document:{getElementById:element}, previewImg:element('preview'), uploadedPath:'stale.png', uploadedDataUrl:'',
 FileReader:class { readAsDataURL(file){this.result=file.data;this.onload();} },
 FormData:class {append(){}}, tr:k=>k,
 fetch:async url=>{requests.push(url);return {ok:false,json:async()=>({detail:'ComfyUI offline'})};}
});
vm.runInContext(source.slice(source.indexOf('        let sourceFile = null;'),source.indexOf('        function toggleUpscaleOptions()')),context);
await vm.runInContext("handleFile({data:'data:image/png;base64,first'})",context);
assert.equal(requests.length,0,'online selection must not upload to ComfyUI');
assert.equal(context.uploadedPath,'','new selection invalidates old upload');
assert.equal(element('genBtn').disabled,false);
await assert.rejects(vm.runInContext('ensureLocalUpload()',context),/ComfyUI offline/);
context.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>({files:[{comfy_name:'new.png'}]})};};
await vm.runInContext('ensureLocalUpload()',context);
await vm.runInContext('ensureLocalUpload()',context);
assert.equal(context.uploadedPath,'new.png');
assert.equal(requests.length,2,'local upload is cached only after success');
await vm.runInContext("handleFile({data:'data:image/png;base64,second'})",context);
assert.equal(context.uploadedPath,'');

const capabilities=vm.createContext({window:{}});
vm.runInContext(read('static/js/image-capabilities.js'),capabilities);
assert.equal(capabilities.window.StudioImageCapabilities.nativeResolution('ChatGPT 网页版/gpt-image-2.5'),true);
assert.equal(capabilities.window.StudioImageCapabilities.nativeResolution('gpt-image-2'),false);

const chat=read('static/gpt-chat.html');
const start=chat.indexOf('        function validateSavedProviderState()');
const end=chat.indexOf('        async function loadConfig()',start);
const provider={id:'gateway',chat_models:['chat'],image_models:['image']};
const settings=vm.createContext({provider:'modelscope',activeImageProvider:'modelscope',activeChatModel:'old',activeImageModel:'old',chatProviderModels:{},mode:'agent',modelPickerScope:'chat',config:{},chatProviders:()=>[provider],imageProviders:()=>[provider],providerById:()=>provider,uniqueModels:a=>a});
vm.runInContext(chat.slice(start,end)+'validateSavedProviderState();',settings);
assert.equal(settings.provider,'gateway');
assert.equal(settings.activeImageProvider,'gateway');
assert.equal(settings.activeChatModel,'chat');
assert.equal(settings.activeImageModel,'image');
const smart=read('static/js/smart-canvas.js');
const sizeStart=smart.indexOf('function sizeForRun(');
const sizeEnd=smart.indexOf('function expectedOutputSize()',sizeStart);
const sizeContext=vm.createContext({window:capabilities.window,settings:{},apiImageSize:(ratio,res)=>`${ratio}/${res}`});
vm.runInContext(smart.slice(sizeStart,sizeEnd),sizeContext);
assert.equal(vm.runInContext("sizeForRun({model:'ChatGPT 网页版/gpt-image-2',ratio:'portrait',resolution:'auto'})",sizeContext),'portrait/1k','native model must keep portrait intent even with a saved auto resolution');
console.log('Upload isolation, file replacement, native resolution and retired chat settings passed');
