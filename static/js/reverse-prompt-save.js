(function () {
    'use strict';
    const storageKey = 'studio_reverse_save_location';
    function suggestName(prompt) {
        const lines = String(prompt || '').split(/\r?\n/).map(line => line.replace(/^\s*(?:#{1,6}\s*|[-*]\s+)/, '').trim()).filter(Boolean);
        const first = lines.find(line => !/^(?:提示词|正向提示词|prompt)[：:]?$/i.test(line)) || '';
        const phrase = first.split(/[，,。！？\n]/)[0].replace(/[*`]/g, '').trim();
        return [...phrase].slice(0, 28).join('') || '图片反推提示词';
    }
    function create({ api, getPrompt, isBusy, setSaving, persist }) {
        const $ = id => document.getElementById(id);
        let libraries = [], loading = false, saving = false, loaded = false, feedbackKey = '', memory = {};
        try { memory = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch (_) {}
        if (typeof memory !== 'object' || Array.isArray(memory)) memory = {};
        const selectedLibrary = () => libraries.find(lib => lib.id === $('library').value);
        const signature = () => JSON.stringify([$('library').value, $('category').value, getPrompt().trim()]);
        const duplicate = () => (selectedLibrary()?.items || []).find(item => item.category === $('category').value && String(item.positive || '').trim() === getPrompt().trim() && !String(item.negative || '').trim());
        function message(text, error = false) {
            $('saveStatus').textContent = text;
            $('saveStatus').dataset.error = String(error);
            feedbackKey = signature();
        }
        function refresh() {
            const text = getPrompt().trim(), locked = isBusy() || saving, existing = text && duplicate();
            $('promptName').placeholder = text ? suggestName(text) : '有提示词后会自动建议名称';
            for (const id of ['promptName', 'library', 'category']) $(id).disabled = locked || (id !== 'promptName' && (loading || !loaded));
            $('retryLibraries').disabled = locked || loading;
            $('savePrompt').disabled = locked || loading || !loaded || !text || !selectedLibrary() || !$('category').value || !!existing;
            $('savePrompt').textContent = saving ? '正在保存…' : existing ? '✓ 已在库中' : '保存到提示词库';
            if (!saving && feedbackKey !== signature()) message(text ? '选好位置即可保存，名称可以不填。' : '先反推一张图片，或在上方粘贴提示词。');
            if (existing && !saving) message(`已收录于「${selectedLibrary().name} / ${$('category').selectedOptions[0]?.textContent}」：${existing.name}`);
        }
        function categories(preferred) {
            const list = [...(selectedLibrary()?.categories || [])];
            if (!list.some(cat => cat.id === 'custom')) list.push({ id: 'custom', name: '我的' });
            $('category').replaceChildren(...list.map(cat => new Option(cat.name, cat.id)));
            $('category').value = list.some(cat => cat.id === preferred) ? preferred : 'custom';
        }
        function render(data, preferredLibrary, preferredCategory) {
            libraries = (data.library?.libraries || []).filter(lib => !lib.readonly);
            $('library').replaceChildren(...libraries.map(lib => new Option(lib.name, lib.id)));
            const target = libraries.find(lib => lib.id === preferredLibrary) || libraries.find(lib => lib.id === data.library?.active_library_id) || libraries[0];
            if (target) $('library').value = target.id;
            else $('library').add(new Option('暂无可用提示词库', ''));
            categories(target?.id === preferredLibrary ? preferredCategory : memory.groups?.[target?.id]);
            loaded = true;
        }
        async function load() {
            if (loading || saving) return;
            loading = true; refresh();
            try {
                const data = await api('/api/prompt-libraries');
                render(data, memory.library, memory.groups?.[memory.library]);
                $('retryLibraries').hidden = true;
                message(libraries.length ? '会记住上次保存的位置，名称可留空。' : '暂无可用提示词库，请先在提示词页创建。');
            } catch (error) {
                loaded = false;
                $('library').replaceChildren(new Option('提示词库加载失败', ''));
                message(`提示词库加载失败：${error.message}`, true);
                $('retryLibraries').hidden = false;
            } finally { loading = false; refresh(); }
        }
        function remember(library, category) {
            memory = { library, groups: { ...memory.groups, [library]: category } };
            try { localStorage.setItem(storageKey, JSON.stringify(memory)); } catch (_) { /* Saving the item must not depend on browser storage. */ }
        }
        $('library').onchange = () => { categories(memory.groups?.[$('library').value]); feedbackKey = ''; refresh(); };
        $('category').onchange = () => { feedbackKey = ''; refresh(); };
        $('retryLibraries').onclick = load;
        $('savePrompt').onclick = async () => {
            if ($('savePrompt').disabled || saving || isBusy()) return;
            const libraryId = $('library').value, categoryId = $('category').value, positive = getPrompt().trim();
            const name = $('promptName').value.trim() || suggestName(positive);
            saving = true; setSaving(true); refresh(); message('正在保存，请稍候…');
            try {
                // Refresh before writing: a library may have been changed in another tab.
                const latest = await api('/api/prompt-libraries');
                const target = latest.library?.libraries?.find(lib => lib.id === libraryId && !lib.readonly);
                render(latest, libraryId, categoryId);
                if (!target || (categoryId !== 'custom' && !target.categories?.some(cat => cat.id === categoryId))) {
                    throw Error('原来的库或分组已不存在，请重新选择保存位置');
                }
                const existing = duplicate();
                if (!existing) {
                    const result = await api('/api/prompt-libraries/items', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ library_id: libraryId, category: categoryId, name, positive, negative: '', scene: '从图片反推，可按需要调整主体和画风。' })
                    });
                    render(result, libraryId, categoryId);
                }
                remember(libraryId, categoryId);
                persist();
                message(`已保存到「${target.name} / ${$('category').selectedOptions[0]?.textContent}」`);
            } catch (error) {
                message(`未能保存：${error.message}。内容已保留，可重试。`, true);
            } finally { saving = false; setSaving(false); refresh(); }
        };
        return { load, refresh };
    }
    window.ReversePromptSave = { create, suggestName };
})();
