import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const classic = readFileSync(new URL('../static/js/canvas.js', import.meta.url), 'utf8');
const smart = readFileSync(new URL('../static/js/smart-canvas.js', import.meta.url), 'utf8');
const functionSource = (source, name) => {
  const match = source.replace(/\r\n/g, '\n').match(new RegExp(`^(?:async )?function ${name}\\([^\\n]*\\)[^\\n]*\\n[\\s\\S]*?^\\}\\n`, 'm'));
  assert.ok(match, name);
  return match[0];
};
const element = () => ({style:{}, append(){}});
const context = vm.createContext({document:{createElement:element}, alert(){}, dynamicParams:{innerHTML:''}, settings:{}});
for(const name of ['renderMsGenBody', 'runMsGenNode', 'resolveImageProviderId', 'resolveChatProviderId']) {
  vm.runInContext(functionSource(classic,name), context);
}
for(const name of ['renderMsParams', 'runModelscopeGeneration']) {
  vm.runInContext(functionSource(smart,name), context);
}
const node = {id:'old',type:'msgen',msCustomModel:'old-model',msWidth:1024,inputs:['source'],images:['/retained.png']};
context.node = node;
const before = JSON.stringify(node);
vm.runInContext('renderMsGenBody(node)',context);
assert.equal(JSON.stringify(node), before, 'retired node rendering must not rewrite parameters or media');
assert.equal(vm.runInContext("resolveImageProviderId('modelscope')",context),'modelscope');
assert.equal(vm.runInContext("resolveChatProviderId('modelscope')",context),'modelscope');
await assert.rejects(vm.runInContext("runMsGenNode('old',{cascade:true})",context), /服务已移除/);
await assert.rejects(vm.runInContext('runModelscopeGeneration()',context), /服务已移除/);
vm.runInContext('renderMsParams()',context);
assert.match(context.dynamicParams.innerHTML, /服务已移除/);
console.log('Retired canvas nodes preserve content and cannot fall back or execute');
