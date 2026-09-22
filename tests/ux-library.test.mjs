import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../static/js/asset-manager.js', import.meta.url), 'utf8');

function harness(){
    const elements = new Map(), requests = [], timers = [], confirmations = [], storage = new Map();
    const element = id => {
        if(!elements.has(id)) elements.set(id, {
            id, value:'', innerHTML:'', textContent:'', listeners:{}, dataset:{}, isConnected:true,
            classList:{add(){}, remove(){}, toggle(){}},
            addEventListener(type, callback){this.listeners[type] = callback;},
            querySelector(selector){return element(selector);}, querySelectorAll(){return [];},
            focus(){doc.activeElement=this;}, remove(){this.isConnected=false;}, setSelectionRange(){},
            setAttribute(){}, appendChild(){},
            showModal(){this.open=true;confirmations.push(this);},
            close(){this.open=false;this.listeners.close?.();}
        });
        return elements.get(id);
    };
    const doc = {activeElement:null, getElementById:id=>elements.get(id) || null,
        querySelector:element, querySelectorAll:()=>[], addEventListener(){},
        createElement:tag=>element(`${tag}-${confirmations.length}`)};
    doc.body=element('body');
    ['assetManagerRoot','assetStatus','refreshBtn','storageSettingsBtn','assetUploadInput'].forEach(element);
    const win = {listeners:{}, addEventListener(type, callback){this.listeners[type] = callback;},
        confirm(){throw Error('library confirmations must not use blocking browser dialogs');}};
    const context = vm.createContext({document:doc, window:win,
        location:{hash:'#prompts',search:'',origin:'http://isolated.test'},
        localStorage:{getItem(key){return storage.get(key) ?? null;}, setItem(key,value){storage.set(key,value);}}, URLSearchParams,
        PromptLibraryDnD:{mount(){}}, PromptWorkbench:{branchLibrary(){return null;}, card(){return '';}, render(){return '<p>Preview</p>'; }},
        setTimeout(callback){timers.push(callback); return timers.length;}, clearTimeout(){},
        requestAnimationFrame:callback=>callback(), navigator:{}, console,
        fetch:async (url, options)=>{requests.push({url,options});return {ok:true,json:async()=>({library:{libraries:[]}})};}
    });
    vm.runInContext(source, context);
    const run = code=>vm.runInContext(code, context);
    run(`promptLibrary = {libraries:[{id:'lib', name:'测试库', categories:[], items:[
        {id:'one', name:'原名称', positive:'原正文', scene:'原备注', category:'custom'},
        {id:'two', name:'另一条', positive:'另一正文', scene:'', category:'custom'}
    ]}]}; activePromptLibraryId='lib'; selectedPromptId='one';`);
    function edit({create=false}={}){
        run(`promptCreateMode=${create}; promptEditMode=${!create}; promptDraft=null; renderPromptDetail(${create ? 'null' : "findPromptItem('one')"},false);`);
        const initial = create ? ['', '', ''] : ['原名称','原正文','原备注'];
        ['promptEditName','promptEditPositive','promptEditScene'].forEach((id, i)=>{element(id).value=initial[i];});
    }
    function answerDialog(accepted=false){
        element(accepted?'#libraryConfirmAccept':'#libraryConfirmCancel').listeners.click();
    }
    return {context,run,element,elements,doc,win,requests,timers,confirmations,edit,answerDialog,storage};
}

test('prompt navigation remembers expanded libraries including all collapsed, without changing selection', () => {
    const h=harness();
    h.run("ensurePromptExpansion()");
    assert.equal(h.run("promptExpandedLibraries.has('lib')"),true);
    h.run("setPromptExpanded('second',true); setPromptExpanded('lib',false); promptExpandedLibraries=null; ensurePromptExpansion()");
    assert.equal(h.run("promptExpandedLibraries.has('second')"),true);
    assert.equal(h.run("promptExpandedLibraries.has('lib')"),false);
    assert.equal(h.run('activePromptLibraryId'),'lib');
    h.run("setPromptExpanded('second',false); promptExpandedLibraries=null; ensurePromptExpansion()");
    assert.equal(h.run('promptExpandedLibraries.size'),0);
    h.storage.set('studio_prompt_expanded_libraries_v1','invalid JSON');
    h.run('promptExpandedLibraries=null; ensurePromptExpansion()');
    assert.equal(h.run("promptExpandedLibraries.has('lib')"),true);
});

test('navigation renders one all-library action, group breadcrumb and independent drag handles', () => {
    const h=harness();
    h.run("promptLibrary.libraries[0].categories=[{id:'custom',name:'我的'}]; activePromptCategory='custom'; renderPromptManager()");
    const html=h.element('assetManagerRoot').innerHTML;
    assert.match(html,/测试库.*prompt-heading-separator.*我的/);
    assert.doesNotMatch(html,/tree-action-bar|全部提示词/);
    assert.match(html,/data-prompt-menu="category"[^>]*data-library-id="lib"[^>]*data-category-id="custom"/);
    assert.doesNotMatch(html,/<button[^>]*draggable="true"/);
    assert.match(html,/<span class="prompt-nav-grip"[^>]*draggable="true"/);
    assert.match(h.run("renderPromptNavRow({id:'read',name:'只读库',readonly:true},null,false)"),/只读/);
    assert.doesNotMatch(h.run("renderPromptNavRow({id:'read',name:'只读库',readonly:true},null,false)"),/data-prompt-menu|draggable/);
});

test('menu actions target their own group and honour cancelled draft protection', async () => {
    const h=harness();
    h.run("promptLibrary.libraries.push({id:'second',name:'另一个库',categories:[{id:'group',name:'目标分组'}],items:[]})");
    h.edit();h.element('promptEditPositive').value='保留的草稿';
    const pending=h.run("runPromptNavAction('rename',{libraryId:'second',categoryId:'group'})");
    h.answerDialog(false);await pending;
    assert.equal(h.run('activePromptLibraryId'),'lib');
    assert.equal(h.run('promptTreeEdit'),null);
    assert.equal(h.run('promptDraft.positive'),'保留的草稿');
    h.run('promptEditMode=false; promptDraft=null; render=()=>{}; focusTreeEditInput=()=>{}');
    await h.run("runPromptNavAction('rename',{libraryId:'second',categoryId:'group'})");
    assert.equal(h.run('activePromptLibraryId'),'second');
    assert.equal(h.run('activePromptCategory'),'group');
    assert.equal(h.run('promptTreeEdit.value'),'目标分组');
    assert.equal(h.requests.length,0,'opening rename must not persist anything');
});

test('group deletion waits for confirmation, cancellation sends nothing', async () => {
    const h=harness();
    h.run("promptLibrary.libraries[0].categories=[{id:'custom',name:'我的'}]; activePromptCategory='custom'; render=()=>{}");
    const pending=h.run('deletePromptCategory()');
    assert.equal(h.requests.length,0);
    assert.match(h.confirmations[0].innerHTML,/组内提示词会保留/);
    h.answerDialog(false);await pending;
    assert.equal(h.requests.length,0);
    assert.equal(h.run('activePromptCategory'),'custom');
});

test('prompt search keeps the same focused search field and all unsaved draft fields', () => {
    for(const create of [false,true]){
        const h=harness();h.edit({create});
        h.element('promptEditName').value='未保存 <名称>';
        h.element('promptEditPositive').value='第一行\n第二行';
        h.element('promptEditScene').value='备注草稿';
        const search=h.element('promptSearch');search.value='无匹配内容';h.doc.activeElement=search;
        h.run("promptQuery='无匹配内容'; scheduleSearchRender('promptSearch', 3, 0)");
        h.timers.shift()();
        assert.equal(h.doc.activeElement,search,'search must not be replaced or lose focus');
        assert.equal(h.element('promptEditPositive').value,'第一行\n第二行');
        assert.match(h.element('[data-prompt-results]').innerHTML,/当前条件下没有提示词/);
        if(!create)assert.equal(h.run('selectedPromptId'),'one','search must not change the edited item');
        const markup=h.run(`renderPromptDetail(${create ? 'null' : "findPromptItem('one')"},false)`);
        assert.match(markup,/未保存 &lt;名称&gt;/);
        assert.match(markup,/第一行\n第二行/);
        assert.match(markup,/备注草稿/);
    }
});

test('dirty editor cancellation retains draft; confirmed discard clears it', async () => {
    const h=harness();h.edit();
    h.element('promptEditPositive').value='不可丢失';
    const cancel=h.run('leavePromptEditor()');
    assert.equal(h.run('promptEditMode'),true,'editor must remain while confirmation is pending');
    assert.equal(h.doc.activeElement,h.element('#libraryConfirmCancel'));
    assert.match(h.confirmations[0].innerHTML,/继续编辑/);
    assert.match(h.confirmations[0].innerHTML,/放弃修改/);
    h.answerDialog(false);
    assert.equal(await cancel,false);
    assert.equal(h.run('promptEditMode'),true);
    assert.equal(h.run('promptDraft.positive'),'不可丢失');
    const discard=h.run('leavePromptEditor()');h.answerDialog(true);
    assert.equal(await discard,true);
    assert.equal(h.run('promptDraft'),null);
    assert.equal(h.run('promptEditMode'),false);
    h.edit();
    assert.equal(await h.run('leavePromptEditor()'),true);
    assert.equal(h.confirmations.length,2,'unchanged editor must not ask to discard');
});

test('switching entries and refreshing cannot bypass cancelled draft protection', async () => {
    const h=harness();h.edit();h.element('promptEditName').value='草稿名称';
    const target={dataset:{promptRow:'two'},closest(selector){return selector.includes('[data-prompt-row]')?this:null;}};
    h.context.testEvent={target};
    const switchEntry=h.run('handleClick(testEvent)');h.answerDialog(false);await switchEntry;
    assert.equal(h.run('selectedPromptId'),'one');
    const refresh=h.element('refreshBtn').listeners.click();h.answerDialog(false);await refresh;
    assert.equal(h.requests.length,0,'refresh must not reload after cancellation');
    assert.equal(h.run('promptDraft.name'),'草稿名称');
    let prevented=false;
    h.win.listeners.beforeunload({preventDefault(){prevented=true;}});
    assert.equal(prevented,true,'browser reload must protect a dirty editor');
});

test('single asset and prompt deletions send nothing before explicit confirmation', async () => {
    for(const kind of ['Asset','Prompt']){
        const h=harness();
        if(kind==='Asset')h.run("findAssetItem=()=>({id:'one',name:'测试素材'});");
        h.run('render=()=>{}');
        const cancel=h.run(`delete${kind}Item('one')`);
        assert.equal(h.confirmations.length,1);
        assert.equal(h.requests.length,0,'opening confirmation must not request deletion');
        assert.equal(h.doc.activeElement,h.element('#libraryConfirmCancel'),'safe action receives initial focus');
        assert.match(h.confirmations[0].innerHTML,kind==='Asset'?/删除「测试素材」/:/删除「原名称」/);
        h.answerDialog(false);await cancel;
        assert.equal(h.requests.length,0,'cancelled delete must leave server data untouched');
        assert.equal(h.run("findPromptItem('one').name"),'原名称');
        const accept=h.run(`delete${kind}Item('one')`);h.answerDialog(true);await accept;
        assert.equal(h.requests.length,1);
        assert.equal(h.requests[0].options.method,'DELETE');
    }
});

test('Escape cancels a page dialog and returns focus without accepting or losing draft', async () => {
    const h=harness();h.edit();h.element('promptEditPositive').value='保留正文';
    const previous=h.element('promptEditPositive');h.doc.activeElement=previous;
    const leave=h.run('leavePromptEditor()');
    assert.equal(await h.run('leavePromptEditor()'),false,'a second action must not share acceptance');
    let prevented=false;
    h.confirmations[0].listeners.cancel({preventDefault(){prevented=true;}});
    assert.equal(await leave,false);
    assert.equal(prevented,true);
    assert.equal(h.run('promptDraft.positive'),'保留正文');
    assert.equal(h.run('promptEditMode'),true);
    assert.equal(h.requests.length,0);
    assert.equal(h.doc.activeElement,previous);
    assert.equal(h.confirmations[0].isConnected,false);
});

test('failed prompt save retains draft and releases retry lock', async () => {
    for(const create of [false,true]){
        const h=harness();h.edit({create});h.element('promptEditName').value='重试名称';h.element('promptEditPositive').value='重试正文';
        h.context.fetch=async()=>({ok:false,json:async()=>({detail:'临时错误'})});
        await assert.rejects(h.run(create?'savePromptCreate()':"savePromptEdit('one')"),/临时错误/);
        assert.equal(h.run('promptSaveBusy'),false);
        assert.equal(h.run('promptDraftIsDirty()'),true);
        assert.equal(h.element('promptEditPositive').value,'重试正文');
        h.context.fetch=async()=>({ok:true,json:async()=>({item:{id:'saved'}})});
        h.run('render=()=>{}');
        await h.run(create?'savePromptCreate()':"savePromptEdit('one')");
        assert.equal(h.run('promptDraft'),null);
        assert.equal(h.run('promptCreateMode || promptEditMode'),false);
    }
});

test('delayed non-prompt search never steals focus after the user moves away', () => {
    const h=harness();const field=h.element('otherField');h.doc.activeElement=field;
    h.element('assetSearch');h.run('render=()=>{}');
    h.run("scheduleSearchRender('assetSearch', 2, 0)");h.timers.shift()();
    assert.equal(h.doc.activeElement,field);
});
