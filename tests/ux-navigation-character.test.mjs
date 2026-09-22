import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('static/index.html');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('切换页面隔离隐藏 iframe，保留已加载页面并同步导航状态', () => {
    const element = () => {
        const attrs = new Map(), classes = new Set();
        return {attrs, classList:{add:s=>classes.add(s), remove:s=>classes.delete(s), toggle:(s,on)=>on?classes.add(s):classes.delete(s)},
            setAttribute:(k,v)=>attrs.set(k,v), removeAttribute:k=>attrs.delete(k), focus(){this.focused=true;}};
    };
    const nav = [element(), element()];
    const frames = [element(), element()].map((f,i)=>Object.assign(f,{id:`frame-${i?'characters':'zimage'}`,tagName:'IFRAME',src:`/already-loaded-${i}`,contentWindow:{postMessage(){}}}));
    const context = vm.createContext({document:{activeElement:frames[0],querySelectorAll:s=>s==='iframe'?frames:nav,getElementById:id=>frames.find(f=>f.id===id)},
        PAGE_IDS:['zimage','characters'], DEFAULT_PAGE_ID:'zimage', ACTIVE_PAGE_KEY:'active', location:{origin:'http://localhost'}, localStorage:{setItem(){}},
        resetStudioRootScroll(){},syncThemeToFrame(){},syncLanguageToFrame(){},syncScaleToFrame(){},setSidebarSettingsCollapsed(){}});
    vm.runInContext(index.match(/        function switchUI\([\s\S]*?(?=        function forwardStudioApiChange)/)[0], context);
    context.switchUI(nav[1], 'characters');
    assert.equal(frames[0].hidden, true);
    assert.equal(frames[0].inert, true);
    assert.equal(frames[0].attrs.get('tabindex'), '-1');
    assert.equal(frames[0].attrs.get('aria-hidden'), 'true');
    assert.equal(nav[1].attrs.get('aria-current'), 'page');
    assert.equal(nav[1].focused, true);
    context.switchUI(nav[0], 'zimage');
    assert.equal(frames[0].hidden, false);
    assert.equal(frames[0].inert, false);
    assert.equal(frames[0].attrs.has('tabindex'), false);
    assert.equal(frames[0].attrs.has('aria-hidden'), false);
    assert.equal(frames[0].src, '/already-loaded-0');
    assert.equal(nav[1].attrs.has('aria-current'), false);
});

test('导航原生按钮及 iframe 标题、生成参数关联标签完整', () => {
    assert.equal([...index.matchAll(/<button type="button" class="nav-item/g)].length, 10);
    for(const match of index.matchAll(/<iframe\b[^>]*>/g)) assert.match(match[0], /title="[^"]+"/);
    const online = read('static/online.html');
    for(const id of ['promptInput','modelSelect','qualitySelect','countSelect','resolutionSelect','ratioSelect']) {
        assert.match(online, new RegExp(`<label[^>]*for="${id}"[^>]*>[^<]+</label>`));
    }
});

test('角色上传失败后同文件可以重选，上传按钮与保存按钮恢复且草稿保留', async () => {
    const events = {}, windowEvents = {}, elements = new Map();
    let uploads = 0;
    const el = id => {
        if(!elements.has(id)) elements.set(id,{id,value:'',options:[],checked:false,textContent:'',innerHTML:'',disabled:false,click(){this.clicked=true;}});
        return elements.get(id);
    };
    const context = vm.createContext({console,location:{origin:'http://localhost'},localStorage:{getItem:()=>null,setItem(){}},confirm:()=>true,
        document:{getElementById:el,addEventListener:(name,fn)=>events[name]=fn},window:{addEventListener:(name,fn)=>windowEvents[name]=fn},
        PromptWorkbench:{load:async()=>{},loadCharacters:async()=>{},characterWorks:()=>[]},PromptCreation:{safeUrl:v=>v,clone:v=>structuredClone(v)},
        FormData:class {append(){}},fetch:async url=>{
            if(url==='/api/ai/upload'){uploads++;return {ok:false,json:async()=>({detail:'网络中断，请重试'})};}
            const data=url.startsWith('/api/characters')?{characters:[]}:url==='/api/prompt-libraries'?{library:{libraries:[]}}:{providers:[]};
            return {ok:true,json:async()=>data};
        }});
    vm.runInContext(read('static/js/characters.js'), context);
    await tick();
    let prevented = false;
    windowEvents.beforeunload({preventDefault(){prevented=true;}});
    assert.equal(prevented, false, '没有草稿时关闭页面不应被拦截');
    el('characterNew').onclick();
    assert.match(el('characterProfile').innerHTML, /<button[^>]*id="characterDrop"[^>]*type="button"/);
    events.input({target:{id:'characterName',value:'未保存角色'}});
    await events.click({target:{closest:s=>s==='#characterDrop'?{}:null}});
    assert.equal(el('characterUpload').clicked, true);
    const file = {type:'image/png',name:'same.png'};
    const input = el('characterUpload');
    input.files=[file];input.value='same.png';
    events.change({target:input});
    assert.equal(input.value, '', '立即清空，使文件相同也能再次触发 change');
    assert.equal(el('characterDrop').disabled, true);
    await tick();
    assert.equal(el('characterStatus').textContent, '网络中断，请重试');
    assert.equal(el('characterSave').disabled, false);
    assert.equal(el('characterDrop').disabled, false);
    input.value='same.png';events.change({target:input});await tick();
    assert.equal(uploads, 2);
    windowEvents.beforeunload({preventDefault(){prevented=true;}});
    assert.equal(prevented, true, '上传失败后草稿仍受离开保护');
});
