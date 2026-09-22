import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../static/js/prompt-library-picker.js', import.meta.url), 'utf8');
class Element {
    constructor() { this.value = ''; this.children = []; this.dataset = {}; this.events = {}; this.disabled = false; }
    append(...elements) { this.children.push(...elements); }
    appendChild(element) { this.append(element); }
    replaceChildren(...elements) { this.children = elements; this.value = elements[0]?.value || ''; }
    add(element) { this.append(element); if(this.children.length === 1) this.value = element.value; }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, handler) { this.events[name] = handler; }
    dispatchEvent(event) { this.events[event.type]?.(event); }
    focus() {}
    showModal() { this.open = true; }
    close() { this.open = false; this.events.close?.(); }
}
const input = new Element();
const trigger = new Element(); trigger.dataset.promptLibraryTarget = 'promptInput';
const dialog = new Element();
const controls = Object.fromEntries(['library','category','search','list','status','title','note','content','replace','append'].map(key => [`[data-${key}]`, new Element()]));
const close = new Element();
dialog.querySelector = key => controls[key];
dialog.querySelectorAll = () => [close];
const oldItem = {id:'legacy', name:'<b>旧模板</b>', category:'style', positive:'画一个人物', negative:'不要水印', scene:'仅作备注', params:{seed:23}};
let payload = {library:{active_library_id:'mine',libraries:[{id:'mine',name:'我的库',categories:[{id:'style',name:'风格'}],items:[oldItem]}]}};
let fail = false, fetchCount = 0;
let orderChannel;
const context = vm.createContext({
    BroadcastChannel:class {constructor(){orderChannel=this;}},
    document:{body:new Element(),getElementById:()=>input,querySelectorAll:()=>[trigger],
        createElement:tag=>tag==='dialog'?dialog:new Element(),addEventListener:(event, handler)=>handler()},
    Option:class extends Element { constructor(text,value) { super(); this.textContent = text; this.value = value; } },
    Event:class {constructor(type) {this.type=type;}}, AbortController,setTimeout,clearTimeout,
    fetch:async()=>{fetchCount++; return {ok:!fail,status:503,json:async()=>payload};}
});
vm.runInContext(source, context);
const c = name => controls[`[data-${name}]`];
input.value = '原草稿';
await trigger.onclick();
assert.equal(c('list').children.length, 1);
assert.equal(c('list').children[0].children[0].textContent, '<b>旧模板</b>');
assert.equal(c('content').value, '画一个人物\n\n负向提示词:\n不要水印');
close.onclick();
assert.equal(input.value, '原草稿', 'cancel leaves draft unchanged');
await trigger.onclick();
c('search').value = '不存在'; c('search').oninput();
assert.equal(c('replace').disabled, true);
assert.match(c('status').textContent, /没有匹配/);
c('search').value = '仅作备注'; c('search').oninput();
assert.equal(c('replace').disabled, false, 'notes are searchable');
let inputs=0; input.events.input=()=>inputs++;
c('replace').onclick();
assert.equal(input.value, '画一个人物\n\n负向提示词:\n不要水印');
assert.equal(inputs,1);
assert.ok(!input.value.includes('备注') && !input.value.includes('23'));
await trigger.onclick(); c('append').onclick();
assert.equal(input.value, '画一个人物\n\n负向提示词:\n不要水印\n\n画一个人物\n\n负向提示词:\n不要水印');
fail=true;
await trigger.onclick();
assert.match(c('status').textContent,/加载失败/);
assert.equal(c('replace').disabled,true);
assert.equal(c('append').disabled,true);
close.onclick(); fail=false;
payload.library.libraries[0].items=[];
await trigger.onclick();
assert.match(c('status').textContent,/还没有提示词/);
assert.equal(c('replace').disabled,true);
assert.equal(fetchCount,5,'each opening fetches current libraries');
close.onclick();
payload.library.libraries[0].items=[{...oldItem,id:'a',name:'A'},{...oldItem,id:'b',name:'B'}];
await trigger.onclick();
payload.library.libraries[0].items.reverse();
await orderChannel.onmessage({data:{type:'prompt-libraries-changed'}});
assert.equal(c('list').children.map(el=>el.children[0].textContent).join(','),'B,A','open picker refreshes in saved order');
close.onclick();
console.log('Shared picker: legacy content, notes search, replace/append, cancel, empty, failure and live ordering passed');
