import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = file => readFileSync(new URL('../static/js/'+file,import.meta.url),'utf8');
const scripts = ['prompt-creation-core.js','prompt-workbench.js','asset-manager.js'].map(read);
const modes = [
    {tab:'assets', heading:'资产层级', search:'assetSearch', card:'data-asset-card="image-one"', name:'冒烟图片'},
    {tab:'workflows', heading:'工作流层级', search:'workflowSearch', card:'data-workflow-card="workflow-one"', name:'冒烟工作流'},
    {tab:'canvas-assets', heading:'画布分类', search:'canvasAssetSearch', card:'data-canvas-asset-card="canvas-one"', name:'冒烟画布图片'},
    {tab:'local', heading:'本地上传', search:'localUploadSearch', card:'data-localup-card="local-one"', name:'冒烟本地图片'},
    {tab:'prompts', heading:'提示词库目录', search:'promptSearch', card:'data-prompt-row="prompt-one"', name:'冒烟提示词'}
];

function page(tab){
    const elements=new Map(), collections=new Map(), storage=new Map(), requests=[], tabStates=new Map();
    let iconRefreshes=0;
    const element=id=>{
        if(!elements.has(id))elements.set(id,{
            id, innerHTML:'', textContent:'', value:'', dataset:{}, isConnected:true,
            scrollTop:0, scrollLeft:0, listeners:{},
            classList:{add(){},remove(){},toggle(){}},
            addEventListener(type,callback){this.listeners[type]=callback;},
            querySelector:selector=>element(selector), querySelectorAll:()=>[],
            setAttribute(){}, appendChild(){}, focus(){document.activeElement=this;},
            remove(){this.isConnected=false;}
        });
        return elements.get(id);
    };
    const document={activeElement:null,getElementById:id=>elements.get(id) || null,
        querySelector:element,querySelectorAll:selector=>collections.get(selector) || [],
        addEventListener(){},createElement:element};
    document.body=element('body');
    ['assetManagerRoot','assetStatus','refreshBtn','storageSettingsBtn','assetUploadInput'].forEach(element);
    const scroller=element('existing-scroll-region');scroller.scrollTop=42;scroller.scrollLeft=7;
    collections.set('.nav-scroll,.content-scroll,.detail-scroll,.pw-scroll',[scroller]);
    collections.set('[data-tab]',modes.map(({tab})=>({dataset:{tab},addEventListener(){},classList:{toggle(className,active){tabStates.set(tab,active);}}})));
    const window={addEventListener(){},lucide:{createIcons(){iconRefreshes++;}}};
    const context=vm.createContext({document,window,lucide:window.lucide,
        location:{hash:tab==='prompts'?'#prompts':'',search:'',origin:'http://isolated.test',href:'http://isolated.test/static/asset-manager.html'},
        localStorage:{getItem:key=>storage.get(key) ?? null,setItem:(key,value)=>storage.set(key,value)},
        URLSearchParams,URL,requestAnimationFrame:callback=>callback(),
        setTimeout(){throw Error('render must not schedule network or background actions');},clearTimeout(){},
        navigator:{},console,PromptLibraryDnD:{mount(){}},
        fetch:async(url,options)=>{requests.push({url,options});throw Error('render must not access server data');}
    });
    // Real production renderers and helpers; only browser/platform services are faked.
    vm.runInContext(scripts[0],context);
    vm.runInContext(scripts[1],context);
    context.PromptCreation=window.PromptCreation;
    context.PromptWorkbench=window.PromptWorkbench;
    vm.runInContext(scripts[2],context);
    const run=code=>vm.runInContext(code,context);
    run(`activeTab=${JSON.stringify(tab)};`);
    return {context,run,element,scroller,requests,tabStates,iconRefreshes:()=>iconRefreshes};
}

for(const mode of modes){
    test(`full render smoke: ${mode.tab}, empty and populated content`,()=>{
        const h=page(mode.tab);
        for(const populated of [false,true]){
            // Synthetic metadata and URLs only; no user assets are read or changed.
            if(populated)h.run(`
                assetLibrary={libraries:[{id:'smoke-assets',name:'冒烟资产库',categories:[
                    {id:'images',name:'图片组',type:'image',items:[{id:'image-one',name:'冒烟图片',kind:'image',url:'/fixture/image.png'}]},
                    {id:'workflows',name:'工作流组',type:'workflow',items:[{id:'workflow-one',name:'冒烟工作流',kind:'workflow',url:'/fixture/workflow.json'}]}
                ]}]};
                localAssets=[{id:'local-one',name:'冒烟本地图片',kind:'image',url:'/fixture/local.png',folder:'',size:128}];
                canvasAssetsData={categories:[],canvases:[{id:'canvas',kind:'smart',title:'冒烟画布'}],items:[
                    {id:'canvas-one',name:'冒烟画布图片',kind:'image',url:'/fixture/canvas.png',canvas_id:'canvas',canvas_kind:'smart',canvas_title:'冒烟画布'}
                ]};
                promptLibrary={libraries:[{id:'smoke-prompts',name:'冒烟词库',categories:[{id:'custom',name:'测试分组'}],items:[
                    {id:'prompt-one',name:'冒烟提示词',positive:'绘制 {{SUBJECT}}',scene:'仅供测试',category:'custom'}
                ]}]}; activePromptLibraryId='smoke-prompts';
            `);
            const menu=h.element(`menu-${populated}`),trigger=h.element(`trigger-${populated}`);
            h.context.smokeMenu=menu;h.context.smokeTrigger=trigger;
            h.run('promptNavMenu={element:smokeMenu,trigger:smokeTrigger};');
            h.element('assetManagerRoot').innerHTML='';
            assert.doesNotThrow(()=>h.run('render()'),`${mode.tab} must complete shared render and all child renderers`);
            const html=h.element('assetManagerRoot').innerHTML;
            assert.ok(html.includes(mode.heading),`${mode.tab} must render navigation`);
            assert.ok(html.includes(`id="${mode.search}"`),`${mode.tab} must render search`);
            assert.match(html,/class="asset-panel asset-detail"/,'detail panel must remain available');
            if(populated){
                assert.ok(html.includes(mode.card),`${mode.tab} must render the fixture card`);
                assert.ok(html.includes(mode.name),`${mode.tab} must render the fixture content`);
                if(mode.tab==='prompts')assert.match(html,/data-pw-key=/,'real prompt workbench renderer must execute');
            }
            assert.equal(menu.isConnected,false,'shared render must close the existing navigation menu');
            assert.equal(h.run('promptNavMenu'),null);
            assert.equal(h.tabStates.get(mode.tab),true);
            assert.equal([...h.tabStates.values()].filter(Boolean).length,1);
            assert.equal(h.scroller.scrollTop,42);
            assert.equal(h.scroller.scrollLeft,7);
            assert.equal(h.requests.length,0,'render must not access server data');
        }
        assert.equal(h.iconRefreshes(),2,'both render states must reach completion');
    });
}
