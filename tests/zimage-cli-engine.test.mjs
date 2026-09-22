import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('static/online.html');
const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1];
const elements = new Map();
const element = id => {
  if(!elements.has(id)) elements.set(id, {value:'', innerHTML:'', style:{}, classList:{add(){},remove(){},toggle(){}}, prepend(){}, appendChild(){}});
  return elements.get(id);
};
const requests = [], alerts = [];
const context = vm.createContext({
  window:{addEventListener(){}}, document:{getElementById:element,addEventListener(){}},
  localStorage:{getItem(){return null;},setItem(){}}, lucide:{createIcons(){}},
  IntersectionObserver:class {observe(){}}, console, setTimeout, clearTimeout,
  alert:message => alerts.push(message),
  fetch:async (url, options) => {
    requests.push({url, body:options?.body && JSON.parse(options.body)});
    return {ok:true,json:async () => ({images:['/test.png'],timestamp:123})};
  }
});
vm.runInContext(read('static/js/image-capabilities.js'), context);
context.StudioImageCapabilities = context.window.StudioImageCapabilities;
vm.runInContext(source, context);
const run = code => vm.runInContext(code, context);
run(`apiProviders = [
 {id:'a',name:'A',protocol:'openai',enabled:true,image_configured:true,image_models:['same','second']},
 {id:'b',name:'B',protocol:'openai',enabled:true,image_configured:true,image_models:['same']},
 {id:'modelscope',image_configured:true,image_models:['retired']},
 {id:'off',enabled:false,image_configured:true,image_models:['disabled']},
 {id:'unready',image_configured:false,image_models:['unready']}
]; renderProviderControls(); renderImageCard = () => {};`);
assert.equal(run('modelOptions.length'), 3);
assert.equal(run('provider'),'a');
assert.doesNotMatch(element('modelSelect').innerHTML,/本地 ComfyUI/);
assert.match(element('modelSelect').innerHTML, /same · A/);
assert.match(element('modelSelect').innerHTML, /same · B/);
element('promptInput').value = 'a test image';
run(`setModel(JSON.stringify(['b','same']));`);
await run('submitImage()');
assert.equal(requests.at(-1).url, '/api/online-image');
assert.equal(requests.at(-1).body.provider_id, 'b', 'duplicate names must route to selected provider');
assert.equal(requests.at(-1).body.model, 'same');
run(`setModel(JSON.stringify(['a','second']));`);
await run('submitImage()');
assert.equal(requests.at(-1).body.model, 'second');
run(`StudioImageCapabilities.localEnabled=()=>true; renderProviderControls(); setModel(JSON.stringify(['local-comfy','Z-Image']));`);
await run('submitImage()');
assert.equal(requests.at(-1).url, '/api/generate');
assert.equal(requests.at(-1).body.workflow_json, 'Z-Image.json');
assert.equal(requests.at(-1).body.width, 1024);
assert.equal(requests.find(r => r.url === '/api/online-image').body.operation, 'generate');
assert.ok(requests.filter(r => r.url === '/api/online-image').every(r => !r.body.reference_images));
assert.doesNotMatch(html, /id="file[123]"|handleFile|addEventListener\('paste'/);
let before = requests.length;
run(`setModel(JSON.stringify(['b','same'])); apiProviders=apiProviders.filter(p=>p.id!=='b'); renderProviderControls();`);
await run('submitImage()');
assert.equal(requests.length, before, 'removed selection must not silently fall back');
assert.equal(run('provider'), 'b');
context.fetch = async url => ({ok:true,json:async () => url.includes('zimage') ? [{timestamp:1,images:['/old.png']}] : [{timestamp:2,images:['/new.png']}]});
await run('loadHistory(0)');
assert.deepEqual(JSON.parse(run('JSON.stringify(allHistory.map(x=>x.timestamp))')), [2,1]);
assert.match(read('static/zimage.html'), /location.replace\('\/static\/online.html'/);
assert.doesNotMatch(read('static/index.html'), /id="local-nav-toggle"|id="frame-online"/);
assert.doesNotMatch(html, /id="providerSelect"|id="modeCloud"/);
console.log('Text-only generation, explicit operation, unavailable models and history passed');
