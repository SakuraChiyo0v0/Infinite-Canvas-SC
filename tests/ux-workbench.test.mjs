import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../static/js/canvas-list.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const functions = name => {
    const match = source.match(new RegExp(`^(?:async )?function ${name}\\([^\\n]*\\)[^\\n]*\\n[\\s\\S]*?^\\}`, 'm'));
    assert.ok(match, name);
    return match[0];
};
function element(){
    const children = new Map();
    const classes = new Set();
    return {
        style:{}, dataset:{}, children:[], value:'', disabled:false, hidden:false, offsetWidth:260, offsetHeight:200,
        classList:{add:c=>classes.add(c), remove:c=>classes.delete(c), contains:c=>classes.has(c), toggle(c,on){on ? classes.add(c) : classes.delete(c);}},
        querySelector(selector){if(!children.has(selector)) children.set(selector, element()); return children.get(selector);},
        querySelectorAll(){return [];}, appendChild(child){this.children.push(child);},
        setAttribute(name, value){this[name]=value;}, focus(){this.focused=true;}, remove(){this.removed=true;},
    };
}
function harness(names, extra={}){
    const context = vm.createContext({
        console:{error(){}}, L:zh=>zh, loading:false, hasLoaded:true,
        projects:[{id:'default',name:'原项目'}], canvases:[{id:'a',title:'原名称',project:'default'}], currentProjectId:'default',
        boardRefreshBtn:element(), loadRetryBtn:element(), loadErrorEl:element(), loadErrorText:element(), boardEmptyHint:element(),
        renderProjects(){},renderBoard(){},resetView(){},refreshTrashCount(){},rememberProjectId(){},updateBoardHeader(){},
        setStatus(text){context.status=text;}, creatingProject:false, creatingCanvas:false,pastingCanvas:false,
        clipboardCanvasId:'a',pasteCanvasBtn:element(),newProjectInput:element(),newProjectRow:element(),newProjectBtn:element(),
        newProjectConfirm:element(),newProjectCancel:element(),createCardEl:element(),
        showFormError(form,text){form.error=text;}, positionCreateCard(){},
        closeNewProject(){context.newProjectInput.value='';context.closedProject=true;},
        closeCreateCard(){context.createCardEl=null;},
        document:{createElement:element}, ...extra,
    });
    vm.runInContext(names.map(functions).join('\n'), context);
    return context;
}
const fail = async()=>({ok:false,status:503});
const ok = data=>({ok:true,json:async()=>data});

test('HTTP refresh failure preserves projects, canvases and selection; successful retry replaces them', async()=>{
    const h=harness(['loadAll'],{fetch:async url=>url==='/api/projects'?ok({projects:[]}):fail()});
    const previousProjects=h.projects, previousCanvases=h.canvases;
    await h.loadAll();
    assert.equal(h.projects,previousProjects); assert.equal(h.canvases,previousCanvases);
    assert.equal(h.currentProjectId,'default'); assert.equal(h.loadErrorEl.hidden,false);
    assert.match(h.loadErrorText.textContent,/上次加载/); assert.equal(h.loadRetryBtn.disabled,false);
    h.fetch=async url=>ok(url==='/api/projects'?{projects:[{id:'default',name:'恢复项目'}]}:{canvases:[]});
    await h.loadAll();
    assert.equal(h.projects[0].name,'恢复项目'); assert.equal(h.canvases.length,0); assert.equal(h.loadErrorEl.hidden,true);
});

test('initial load failure does not claim workspace is empty', async()=>{
    const h=harness(['loadAll'],{fetch:fail,hasLoaded:false});
    await h.loadAll();
    assert.equal(h.boardEmptyHint.classList.contains('hidden'),true);
    assert.equal(h.loadErrorEl.hidden,false);
});

test('moving and renaming wait for persistence; failure preserves original data and cut state', async()=>{
    const h=harness(['persistMeta','setCanvasTitle','moveCanvasToProject','pasteCanvas','renameProject'],{fetch:fail,currentProjectId:'other'});
    assert.equal(await h.setCanvasTitle('a','新名称'),false);
    assert.equal(h.canvases[0].title,'原名称');
    assert.equal(await h.renameProject('default','新项目名'),false);
    assert.equal(h.projects[0].name,'原项目');
    await h.pasteCanvas();
    assert.equal(h.canvases[0].project,'default'); assert.equal(h.clipboardCanvasId,'a');
    assert.notEqual(h.status,'已移动'); assert.equal(h.pasteCanvasBtn.disabled,false);
    let release;
    h.fetch=()=>new Promise(resolve=>{release=resolve;});
    const pending=h.pasteCanvas();
    assert.equal(h.canvases[0].project,'default'); assert.equal(h.clipboardCanvasId,'a');
    release(ok({canvas:{id:'a',project:'other'}}));
    await pending;
    assert.equal(h.canvases[0].project,'other'); assert.equal(h.clipboardCanvasId,null); assert.equal(h.status,'已移动');
});

test('project creation retains input on failure and suppresses repeated submissions', async()=>{
    let release,calls=0;
    const h=harness(['createProject'],{fetch:()=>{calls++;return new Promise(resolve=>release=resolve);}});
    h.newProjectInput.value='要保留的项目名';
    const pending=h.createProject();
    await h.createProject();
    assert.equal(calls,1); assert.equal(h.newProjectInput.disabled,true);
    release({ok:false}); await pending;
    assert.equal(h.newProjectInput.value,'要保留的项目名'); assert.equal(h.closedProject,undefined);
    assert.equal(h.newProjectInput.disabled,false); assert.match(h.newProjectRow.error,/重试/);
});

test('canvas creation retains form and kind on failure, retries in original project', async()=>{
    let release,calls=0,payload;
    const h=harness(['createCanvasOnBoard'],{fetch:(_url,options)=>{calls++;payload=JSON.parse(options.body);return new Promise(resolve=>release=resolve);}});
    const form=h.createCardEl;
    const pending=h.createCanvasOnBoard('保留画布','smart',{x:22,y:33},'original');
    await h.createCanvasOnBoard('重复','classic',{x:0,y:0});
    h.currentProjectId='changed';
    assert.equal(calls,1); assert.equal(payload.project,'original'); assert.equal(payload.kind,'smart');
    release({ok:false});await pending;
    assert.equal(h.createCardEl,form); assert.match(form.error,/重试/);assert.equal(h.creatingCanvas,false);
    h.fetch=async()=>ok({canvas:{id:'new'}});
    await h.createCanvasOnBoard('保留画布','smart',{x:22,y:33},'original');
    assert.equal(h.canvases.at(-1).project,'original'); assert.equal(h.createCardEl,null);
});

test('creation dialog is clamped to viewport regardless of board bounds or zoom',()=>{
    const h=harness(['positionCreateCard'],{window:{innerWidth:420,innerHeight:360},board:{getBoundingClientRect:()=>({left:280,top:170,width:140,height:190})}});
    h.positionCreateCard();
    const x=parseFloat(h.createCardEl.style.left),y=parseFloat(h.createCardEl.style.top);
    assert.ok(x>=12&&x+260<=408); assert.ok(y>=12&&y+200<=348);
    const css=readFileSync(new URL('../static/css/canvas-list.css', import.meta.url),'utf8');
    assert.match(css,/\.ws-create-card\s*\{\s*position:fixed;/);
    assert.match(functions('openCreateCard'),/document\.body\.appendChild\(el\)/);
});

test('canvas opening has a native keyboard button without double mouse activation',()=>{
    let opened=0;
    const h=harness(['buildCard'],{
        compactLabel:zh=>zh,escapeHtml:String,escapeAttr:String,L:zh=>zh,formatCanvasTime:()=>'',
        attachCardDrag(){},openCanvas(){opened++;},
    });
    const card=h.buildCard({id:'a',title:'画布'});
    assert.match(card.innerHTML,/<button class="ws-card-title" type="button"/);
    card.querySelector('.ws-card-title').onclick({detail:0});
    card.querySelector('.ws-card-title').onclick({detail:1});
    assert.equal(opened,1);
    assert.match(functions('renderProjects'),/<button class="ws-project-select" type="button"/);
});

test('native project activation switches project and restores focus after rerender',()=>{
    let selected;
    const list=element();
    const h=harness(['renderProjects'],{
        pendingDeleteProjectId:null,projectListEl:list,projectCanvasCount:()=>1,
        escapeHtml:String,CSS:{escape:String},refreshIcons(){},selectProject(id){selected=id;},
    });
    h.renderProjects();
    const row=list.children[0];
    assert.match(row.innerHTML,/<button class="ws-project-select" type="button"/);
    row.querySelector('.ws-project-select').onclick();
    assert.equal(selected,'default');
    assert.equal(list.querySelector('[data-project-id="default"] .ws-project-select').focused,true);
});
