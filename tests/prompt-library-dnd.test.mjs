import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../static/js/prompt-library-dnd.js',import.meta.url),'utf8'),context);
const {intent}=context.PromptLibraryDnD;
const item={kind:'item',id:'a',library:'first'},group={kind:'category',id:'g',library:'second'},lib={kind:'library',id:'second',library:'second'};
assert.equal(intent(item,item,'before'),null);
assert.equal(intent(lib,item,'before'),null);
assert.equal(intent(group,item,'before'),null);
assert.equal(intent(item,group,'before').target_category_id,'g');
assert.equal(intent(item,lib,'after').target_category_id,'');
assert.equal(intent(item,{...item,id:'b'},'after',null).target_category_id,null);
assert.equal(intent(item,{...item,id:'b'},'after','g').anchor_id,'b');
assert.equal(intent(group,lib,'before').anchor_id,'');
assert.equal(intent({...lib,id:'first',library:'first'},lib,'after').anchor_id,'second');
console.log('drag intent: reorder, cross-group, cross-library, invalid targets passed');

// Exercise the mounted event boundary, not just move intent calculation.
const listeners={}, moves=[];
const root={addEventListener(name,fn){listeners[name]=fn;},querySelectorAll(){return [];}};
context.PromptLibraryDnD.mount(root,{status(){},category(){return null;},async move(operation){moves.push(operation);}});
function dragElement(kind,id,library,handle=false){
    return {dataset:{promptDragKind:kind,promptDragId:id,promptDragLibrary:library},
        getAttribute(){return 'true';},classList:{add(){},remove(){}},
        closest(selector){
            if(selector==='[data-prompt-drag-handle]')return handle?this:null;
            if(selector==='.nav-scroll,.content-scroll' || selector==='.prompt-nav-row')return null;
            return this;
        },getBoundingClientRect(){return {top:0,height:40};},removeAttribute(){}};
}
function dragEvent(target){return {target,clientY:30,prevented:false,preventDefault(){this.prevented=true;},stopPropagation(){},dataTransfer:{setData(){}}};}
const fullRow=dragEvent(dragElement('category','group','first'));
listeners.dragstart(fullRow);
assert.equal(fullRow.prevented,true,'directory labels cannot initiate dragging');
const groupHandle=dragEvent(dragElement('category','group','first',true));
listeners.dragstart(groupHandle);
assert.equal(groupHandle.prevented,false,'dedicated handle initiates dragging');
const targetRow=dragElement('library','second','second');
listeners.dragover(dragEvent(targetRow));
assert.equal(targetRow.dataset.promptDrop,'inside');
await listeners.drop(dragEvent(targetRow));
assert.equal(moves[0].id,'group');
assert.equal(moves[0].target_library_id,'second');
assert.equal(moves[0].kind,'category');
const itemEvent=dragEvent(dragElement('item','item','first'));
listeners.dragstart(itemEvent);
assert.equal(itemEvent.prevented,false,'existing prompt item dragging remains available');
console.log('mounted drag events: label blocked, handle accepted, cross-library group drop and item drag passed');
