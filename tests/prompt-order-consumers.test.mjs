import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const libraries=[{id:'custom',name:'自建',categories:[{id:'g2',name:'二'},{id:'g1',name:'一'}],items:[{id:'b',positive:'B'},{id:'a',positive:'A'}]},
 {id:'system',name:'系统',categories:[{id:'moved',name:'迁入分组'}],items:[{id:'z',positive:'Z'},{id:'y',positive:'Y'}]}];
function loadFunctions(file,names,context){
 const source=fs.readFileSync(new URL(`../static/js/${file}.js`,import.meta.url),'utf8');
 for(const name of names){const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);assert.ok(start>=0);vm.runInContext(source.slice(start,end),context);}
}
for(const classic of [true,false]){
 const context=vm.createContext({canvasPromptLibraries:libraries,promptLibraries:libraries,activePromptLibraryId:'custom',
  canvasPromptTemplateOverrides:{hiddenBuiltinIds:[],editedBuiltins:{}},promptPresets:[],builtinPromptTemplates:[],promptTemplateGroups:[],tr:x=>x});
 const active=classic?'activeCanvasPromptLibrary':'activePromptLibrary',items=classic?'activeCanvasPromptLibraryItems':'promptTemplateItems',groups=classic?'activeCanvasPromptTemplateGroups':'activePromptTemplateGroups';
 loadFunctions(classic?'canvas':'smart-canvas',[active,items,groups],context);
 assert.equal(context[items]().map(i=>i.id).join(','),'b,a');
 assert.equal(context[groups]().map(i=>i.id).join(','),'g2,g1');
 context.activePromptLibraryId='system';
 assert.equal(context[items]().map(i=>i.id).join(','),'z,y','system does not mix in another library');
 assert.equal(context[groups]()[0].name,'迁入分组');
}
console.log('canvas consumers preserve library item/group order and moved groups');
