(function (global) {
    let stylesInstalled = false;

    function escapeHtml(value) {
        const node = document.createElement('span');
        node.textContent = String(value ?? '');
        return node.innerHTML;
    }

    function eligibleProviders(providers) {
        if (!Array.isArray(providers)) return [];
        return providers.filter(item => item?.enabled !== false
            && item.image_configured === true
            && Array.isArray(item.image_models)
            && item.image_models.length > 0);
    }

    function installStyles() {
        if (stylesInstalled) return;
        stylesInstalled = true;
        const style = document.createElement('style');
        style.textContent = `
            .cli-provider-picker { position: relative; }
            .cli-provider-trigger { width: 100%; min-height: 34px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; border: 1px solid #dbe2ec; border-radius: 10px; background: #fff; color: #334155; font: 700 11px/1.25 inherit; text-align: left; cursor: pointer; transition: border-color .15s ease, box-shadow .15s ease; }
            .cli-provider-trigger:hover, .cli-provider-trigger[aria-expanded="true"] { border-color: #94a3b8; box-shadow: 0 0 0 3px rgba(148, 163, 184, .15); }
            .cli-provider-trigger:disabled { color: #94a3b8; cursor: not-allowed; background: #f8fafc; }
            .cli-provider-caret { width: 12px; height: 12px; flex: 0 0 auto; transition: transform .15s ease; }
            .cli-provider-trigger[aria-expanded="true"] .cli-provider-caret { transform: rotate(180deg); }
            .cli-provider-menu { position: absolute; z-index: 60; top: calc(100% + 5px); left: 0; right: 0; display: grid; gap: 3px; padding: 4px; border: 1px solid #dbe2ec; border-radius: 10px; background: #fff; box-shadow: 0 12px 26px rgba(15, 23, 42, .16); }
            .cli-provider-menu.hidden { display: none; }
            .cli-provider-option { width: 100%; padding: 8px 9px; border: 0; border-radius: 7px; background: transparent; color: #475569; font: 700 11px/1.25 inherit; text-align: left; cursor: pointer; }
            .cli-provider-option:hover, .cli-provider-option[aria-selected="true"] { background: #eef2f7; color: #0f172a; }
            .cli-provider-option[aria-selected="true"]::after { content: '✓'; float: right; color: #475569; }
            html.studio-theme-dark .cli-provider-trigger, html.studio-theme-dark .cli-provider-menu { background: #1f2937; border-color: #475569; color: #e5e7eb; }
            html.studio-theme-dark .cli-provider-trigger:disabled { background: #1f2937; color: #94a3b8; }
            html.studio-theme-dark .cli-provider-option { color: #cbd5e1; }
            html.studio-theme-dark .cli-provider-option:hover, html.studio-theme-dark .cli-provider-option[aria-selected="true"] { background: #334155; color: #fff; }
        `;
        document.head.appendChild(style);
    }

    function create(options) {
        const { selectId, hintId, wrapId, storageKey } = options;
        let providers = [];
        let active = false;
        let selectedId = localStorage.getItem(storageKey) || '';

        const selected = () => providers.find(item => item.id === selectedId) || null;

        function closeMenu() {
            const picker = document.getElementById(selectId);
            picker?.querySelector('.cli-provider-menu')?.classList.add('hidden');
            picker?.querySelector('.cli-provider-trigger')?.setAttribute('aria-expanded', 'false');
        }

        function render() {
            const wrap = document.getElementById(wrapId);
            const picker = document.getElementById(selectId);
            const hint = document.getElementById(hintId);
            if (!wrap || !picker || !hint) return;
            wrap.classList.toggle('hidden', !active);
            if (!active) return;
            if (!providers.length) {
                picker.innerHTML = '<button type="button" class="cli-provider-trigger" disabled><span>未配置可用图像 API</span><span class="cli-provider-caret">⌄</span></button>';
                hint.textContent = '请先在 API 设置中启用图像 API，并配置图像模型。';
                return;
            }
            if (!selected()) selectedId = providers[0].id;
            const activeProvider = selected();
            const activeLabel = `${activeProvider.name || activeProvider.id} · ${activeProvider.image_models?.[0] || ''}`;
            picker.innerHTML = `<button type="button" class="cli-provider-trigger" aria-haspopup="listbox" aria-expanded="false"><span>${escapeHtml(activeLabel)}</span><svg class="cli-provider-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="m2 4 4 4 4-4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/></svg></button><div class="cli-provider-menu hidden" role="listbox">${providers.map(item => {
                const label = `${item.name || item.id} · ${item.image_models?.[0] || ''}`;
                return `<button type="button" class="cli-provider-option" role="option" data-provider-id="${escapeHtml(item.id)}" aria-selected="${item.id === selectedId}">${escapeHtml(label)}</button>`;
            }).join('')}</div>`;
            hint.textContent = '仅显示 API 设置中已配置完成的图像 API。';
            const trigger = picker.querySelector('.cli-provider-trigger');
            const menu = picker.querySelector('.cli-provider-menu');
            trigger.addEventListener('click', () => {
                const isOpen = !menu.classList.contains('hidden');
                menu.classList.toggle('hidden', isOpen);
                trigger.setAttribute('aria-expanded', String(!isOpen));
            });
            picker.querySelectorAll('.cli-provider-option').forEach(option => option.addEventListener('click', () => {
                selectedId = option.dataset.providerId || '';
                localStorage.setItem(storageKey, selectedId);
                render();
            }));
        }

        installStyles();
        async function refresh() {
            try {
                const response = await fetch('/api/providers');
                const data = await response.json();
                providers = eligibleProviders(data.providers || []);
            } catch (error) {
                providers = [];
            }
            render();
        }

        document.addEventListener('click', event => {
            const picker = document.getElementById(selectId);
            if (picker && !picker.contains(event.target)) closeMenu();
        });
        window.addEventListener('message', event => {
            if (event.data?.type === 'providers-changed') refresh();
        });

        return {
            refresh,
            selected,
            setActive(value) {
                active = Boolean(value);
                render();
            }
        };
    }

    global.StudioCliImageTools = { create };
})(window);
