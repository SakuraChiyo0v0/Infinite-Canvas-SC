import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('static/js/reverse-prompt-save.js', 'utf8');
const initial = { library: { active_library_id: 'a', libraries: [{ id: 'a', name: '人物', categories: [{ id: 'style', name: '画风' }], items: [] }, { id: 'b', name: '收藏', categories: [], items: [] }] } };
function harness({ memory = {}, fail = false } = {}) {
    class Element {
        value = ''; options = []; disabled = false; dataset = {}; textContent = ''; hidden = false;
        replaceChildren(...options) { this.options = options; this.value = options[0]?.value || ''; }
        add(option) { this.options.push(option); if (!this.value) this.value = option.value; }
        get selectedOptions() { return this.options.filter(option => option.value === this.value); }
    }
    const elements = new Map(), get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
    const store = new Map([['studio_reverse_save_location', JSON.stringify(memory)]]);
    const state = { data: structuredClone(initial), prompt: '粗马克笔人物速写。白底、蓝围巾、半身构图。', fail, posts: [], busy: false };
    const context = { window: {}, document: { getElementById: get }, localStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) }, Option: class { constructor(text, value) { this.textContent = text; this.value = value; } } };
    vm.runInNewContext(source, context);
    const saver = context.window.ReversePromptSave.create({
        api: async (_url, options) => {
            if (state.fail) throw Error('网络断开');
            if (options) {
                const item = JSON.parse(options.body); state.posts.push(item);
                state.data.library.libraries.find(lib => lib.id === item.library_id).items.push({ ...item, id: 'new' });
            }
            return structuredClone(state.data);
        }, getPrompt: () => state.prompt, isBusy: () => state.busy, setSaving() {}, persist() {}
    });
    return { saver, get, store, state, suggest: context.window.ReversePromptSave.suggestName };
}
let h = harness(); await h.saver.load();
assert.equal(h.get('library').value, 'a');
h.get('category').value = 'style'; h.get('category').onchange();
await h.get('savePrompt').onclick();
assert.equal(h.state.posts[0].category, 'style');
assert.equal(h.state.posts[0].name, '粗马克笔人物速写');
assert.equal(h.get('savePrompt').disabled, true);
await h.get('savePrompt').onclick(); assert.equal(h.state.posts.length, 1);
const remembered = JSON.parse(h.store.get('studio_reverse_save_location'));
assert.equal(remembered.groups.a, 'style');
h = harness({ memory: remembered }); await h.saver.load(); assert.equal(h.get('category').value, 'style');
h.get('promptName').value = '我的自定义名称'; await h.get('savePrompt').onclick(); assert.equal(h.state.posts[0].name, '我的自定义名称');
h = harness({ memory: { library: 'removed', groups: { removed: 'gone' } } }); await h.saver.load(); assert.equal(h.get('library').value, 'a'); assert.equal(h.get('category').value, 'custom');
h = harness(); await h.saver.load(); h.state.fail = true; await h.get('savePrompt').onclick();
assert.equal(h.get('saveStatus').dataset.error, 'true'); assert.equal(h.get('savePrompt').disabled, false); assert.ok(h.state.prompt);
h.state.fail = false; await h.get('savePrompt').onclick(); assert.equal(h.state.posts.length, 1);
h = harness({ fail: true }); await h.saver.load(); assert.equal(h.get('retryLibraries').hidden, false); assert.equal(h.get('savePrompt').disabled, true);
h.state.fail = false; await h.get('retryLibraries').onclick(); assert.equal(h.get('savePrompt').disabled, false);
h = harness(); await h.saver.load(); h.get('category').value = 'style'; h.get('category').onchange(); h.state.data.library.libraries[0].categories = [];
await h.get('savePrompt').onclick(); assert.equal(h.state.posts.length, 0); assert.match(h.get('saveStatus').textContent, /已不存在/);
h = harness(); await h.saver.load(); h.state.data.library.libraries = [initial.library.libraries[1]];
await h.get('savePrompt').onclick(); assert.equal(h.state.posts.length, 0); assert.match(h.get('saveStatus').textContent, /已不存在/);
h = harness(); await h.saver.load(); h.state.data.library.libraries[0].items.push({ id: 'other-tab', name: '其他标签已保存', positive: h.state.prompt, negative: '', category: 'custom' });
await h.get('savePrompt').onclick(); assert.equal(h.state.posts.length, 0); assert.equal(h.get('savePrompt').disabled, true);
h.state.prompt += '调整构图。'; h.saver.refresh(); assert.equal(h.get('savePrompt').disabled, false);
h.state.busy = true; h.saver.refresh(); assert.equal(h.get('savePrompt').disabled, true);
assert.equal(h.suggest('# 提示词\n**白底人物**。画风'), '白底人物');
console.log('reverse prompt save: naming, categories, memory, duplicates, recovery and stale destinations passed');

// Exercise the real page integration: saving must not break the existing analyze action.
{
    const elements = new Map();
    const get = id => {
        if (!elements.has(id)) elements.set(id, { value: '', options: [], dataset: {}, classList: { add() {}, remove() {} }, removeAttribute() {}, add(option) { this.options.push(option); }, replaceChildren(...options) { this.options = options; } });
        return elements.get(id);
    };
    const responses = [];
    const ctx = {
        document: { getElementById: get }, window: { addEventListener() {} },
        localStorage: { getItem: () => JSON.stringify({ image: { name: 'input.png', url: '/assets/input.png' }, model: JSON.stringify(['test', 'vision']) }), setItem() {} },
        Option: class { constructor(text, value) { this.textContent = text; this.value = value; } },
        ReversePromptSave: { create: () => ({ load: async () => {}, refresh() {} }) },
        fetch: async (url, options) => { responses.push({ url, options }); return { ok: true, json: async () => url === '/api/providers' ? { providers: [{ id: 'test', chat_models: ['vision'] }] } : { prompt: '反推结果' } }; }
    };
    vm.runInNewContext(fs.readFileSync('static/js/prompt-reverse.js', 'utf8'), ctx);
    await new Promise(resolve => setImmediate(resolve));
    await get('analyze').onclick();
    assert.equal(get('result').value, '反推结果');
    assert.equal(responses.filter(r => r.url === '/api/prompt-reverse').length, 1);
    console.log('reverse prompt integration: analyze still works with save controller');
}
