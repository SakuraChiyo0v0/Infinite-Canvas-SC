(function () {
    'use strict';

    function promptLibraryContent(item) {
        return [String(item?.positive || item?.text || '').trim(),
            item?.negative ? `负向提示词:\n${String(item.negative).trim()}` : ''].filter(Boolean).join('\n\n');
    }

    function matchingPromptItems(library, category, query) {
        const needle = String(query || '').trim().toLocaleLowerCase();
        return (library?.items || []).filter(item => item && promptLibraryContent(item) &&
            (!category || item.category === category) &&
            (!needle || [item.name, item.scene, promptLibraryContent(item)].join('\n').toLocaleLowerCase().includes(needle)));
    }

    function applyLibraryPrompt(input, item, append) {
        const content = promptLibraryContent(item);
        if (!content) return;
        input.value = append && input.value.trim() ? `${input.value.trimEnd()}\n\n${content}` : content;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function mount(button) {
        const input = document.getElementById(button.dataset.promptLibraryTarget);
        if (!input) return;
        const dialog = document.createElement('dialog');
        dialog.className = 'prompt-library-dialog';
        dialog.setAttribute('aria-label', '提示词库');
        dialog.innerHTML = `
            <header class="prompt-library-header"><div><strong>提示词库</strong><p>与素材库共用 · 选择后填入当前提示词</p></div><button type="button" data-close aria-label="关闭提示词库">×</button></header>
            <div class="prompt-library-filters">
                <label>词库<select data-library></select></label>
                <label>分类<select data-category></select></label>
                <label>搜索<input type="search" data-search placeholder="名称、内容或备注" autocomplete="off"></label>
            </div>
            <p class="prompt-library-status" data-status role="status" aria-live="polite"></p>
            <div class="prompt-library-body">
                <div class="prompt-library-list" data-list aria-label="提示词列表"></div>
                <section class="prompt-library-preview"><h3 data-title>提示词预览</h3><p data-note></p><label>完整正文<textarea data-content readonly></textarea></label></section>
            </div>
            <footer class="prompt-library-footer"><button type="button" data-close>取消</button><span></span><button type="button" data-append disabled>追加到末尾</button><button type="button" data-replace disabled class="prompt-library-primary">替换正文</button></footer>`;
        document.body.appendChild(dialog);
        const get = selector => dialog.querySelector(selector);
        const librarySelect = get('[data-library]');
        const categorySelect = get('[data-category]');
        const search = get('[data-search]');
        const list = get('[data-list]');
        const status = get('[data-status]');
        const replace = get('[data-replace]');
        const append = get('[data-append]');
        let libraries = [], selected = null, controller = null;

        function library() { return libraries.find(item => item.id === librarySelect.value); }
        function preview(item) {
            selected = item || null;
            get('[data-title]').textContent = item?.name || '提示词预览';
            get('[data-note]').textContent = item?.scene || '';
            get('[data-content]').value = item ? promptLibraryContent(item) : '';
            replace.disabled = append.disabled = !item;
            [...list.children].forEach(row => row.setAttribute('aria-pressed', String(row.dataset.id === item?.id)));
        }
        function renderItems() {
            const items = matchingPromptItems(library(), categorySelect.value, search.value);
            const preferredId = selected?.id;
            list.replaceChildren();
            items.forEach(item => {
                const row = document.createElement('button');
                row.type = 'button';
                row.dataset.id = item.id;
                const title = document.createElement('strong');
                title.textContent = item.name || '未命名提示词';
                const snippet = document.createElement('span');
                const content = promptLibraryContent(item);
                snippet.textContent = content.length > 140 ? `${content.slice(0, 140)}…` : content;
                row.append(title, snippet);
                row.onclick = () => preview(item);
                list.appendChild(row);
            });
            status.textContent = items.length ? `${items.length} 条提示词` : (library()?.items?.length ? '没有匹配的提示词，试试其他分类或关键词。' : '这个词库还没有提示词，可在素材库中添加。');
            preview(items.find(item => item.id === preferredId) || items[0]);
        }
        function renderCategories() {
            categorySelect.replaceChildren(new Option('全部分类', ''));
            (library()?.categories || []).forEach(category => categorySelect.add(new Option(category.name, category.id)));
            selected = null;
            renderItems();
        }
        librarySelect.onchange = renderCategories;
        categorySelect.onchange = renderItems;
        search.oninput = renderItems;
        dialog.querySelectorAll('[data-close]').forEach(close => close.onclick = () => dialog.close());
        dialog.addEventListener('close', () => { controller?.abort(); button.focus(); });
        for (const [action, shouldAppend] of [[replace, false], [append, true]]) {
            action.onclick = () => {
                if (!selected) return;
                applyLibraryPrompt(input, selected, shouldAppend);
                dialog.close();
                input.focus();
            };
        }
        try {
            const channel=new BroadcastChannel('studio-prompts');
            channel.onmessage=async event=>{
                if(event.data?.type!=='prompt-libraries-changed' || !dialog.open)return;
                const previousLibrary=librarySelect.value,previousCategory=categorySelect.value;
                try {
                    const response=await fetch('/api/prompt-libraries',{cache:'no-store'});
                    if(!response.ok)throw new Error('刷新失败');
                    const data=await response.json();if(!dialog.open)return;
                    libraries=(data.library?.libraries || []).filter(item=>item && Array.isArray(item.items));
                    librarySelect.replaceChildren();libraries.forEach(item=>librarySelect.add(new Option(item.name,item.id)));
                    if(libraries.some(item=>item.id===previousLibrary))librarySelect.value=previousLibrary;
                    renderCategories();
                    if((library()?.categories || []).some(cat=>cat.id===previousCategory))categorySelect.value=previousCategory;
                    renderItems();
                }catch(_){status.textContent='顺序已更新，关闭后重新打开即可刷新。';}
            };
        }catch(_){}
        button.onclick = async () => {
            if (dialog.open) return;
            const previousLibrary = librarySelect.value;
            libraries = [];
            librarySelect.replaceChildren();
            categorySelect.replaceChildren();
            list.replaceChildren();
            search.value = '';
            preview(null);
            status.textContent = '正在加载提示词库…';
            dialog.showModal();
            controller?.abort();
            const request = controller = new AbortController();
            const timeout = setTimeout(() => request.abort(), 15000);
            try {
                const response = await fetch('/api/prompt-libraries', { signal: request.signal, cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                if (controller !== request || !dialog.open) return;
                libraries = (data.library?.libraries || []).filter(item => item && Array.isArray(item.items));
                libraries.forEach(item => librarySelect.add(new Option(item.name, item.id)));
                const preferred = previousLibrary || data.library?.active_library_id;
                if (libraries.some(item => item.id === preferred)) librarySelect.value = preferred;
                renderCategories();
                if (!libraries.length) status.textContent = '暂无提示词库，请先在提示词页中添加。';
                search.focus();
            } catch (error) {
                if (controller === request && dialog.open) status.textContent = '提示词库加载失败，请关闭后重试。';
            } finally {
                clearTimeout(timeout);
            }
        };
    }
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-prompt-library-target]').forEach(mount);
    });
})();
