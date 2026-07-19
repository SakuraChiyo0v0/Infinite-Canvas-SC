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
            .cli-size-control { display: grid; gap: 7px; margin-top: 9px; padding-top: 9px; border-top: 1px solid #edf2f7; }
            .cli-size-label { color: #94a3b8; font: 700 10px/1.2 inherit; letter-spacing: .04em; }
            .cli-size-options { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
            .cli-size-option { min-height: 30px; border: 1px solid #dbe2ec; border-radius: 8px; background: #fff; color: #64748b; font: 700 10px/1 inherit; cursor: pointer; }
            .cli-size-option:hover, .cli-size-option[aria-pressed="true"] { border-color: #334155; background: #334155; color: #fff; }
            .cli-size-custom { display: flex; align-items: center; gap: 5px; color: #94a3b8; font: 600 10px/1 inherit; }
            .cli-size-custom.hidden { display: none; }
            .cli-size-custom input { width: 0; min-width: 0; flex: 1; padding: 6px 7px; border: 1px solid #dbe2ec; border-radius: 7px; color: #334155; font: 700 10px/1 inherit; }
            .cli-size-summary { color: #94a3b8; font: 600 9px/1.3 inherit; }
            html.studio-theme-dark .cli-size-control { border-color: #475569; }
            html.studio-theme-dark .cli-size-option, html.studio-theme-dark .cli-size-custom input { border-color: #475569; background: #1f2937; color: #cbd5e1; }
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

    function createSizeControl(options) {
        const { wrapId, storageKey } = options;
        const limits = { maxEdge: 3840, maxPixels: 8294400 };
        let active = false;
        let sourceWidth = 0;
        let sourceHeight = 0;
        let mode = localStorage.getItem(storageKey) || '1k';
        let customWidth = Number(localStorage.getItem(`${storageKey}:width`)) || 1024;
        let customHeight = Number(localStorage.getItem(`${storageKey}:height`)) || 1024;

        function cleanDimension(value) {
            const number = Math.round(Number(value));
            return Number.isFinite(number) ? Math.max(16, Math.min(limits.maxEdge, number)) : 0;
        }

        function fitToLimits(width, height) {
            let w = cleanDimension(width);
            let h = cleanDimension(height);
            if (!w || !h) return { width: 1024, height: 1024 };
            const scale = Math.min(1, limits.maxEdge / Math.max(w, h), Math.sqrt(limits.maxPixels / (w * h)));
            w = Math.max(16, Math.round((w * scale) / 16) * 16);
            h = Math.max(16, Math.round((h * scale) / 16) * 16);
            return { width: w, height: h };
        }

        function presetDimensions() {
            const targetEdge = { '1k': 1024, '2k': 2048, '4k': 3840 }[mode] || 1024;
            const sourceEdge = Math.max(sourceWidth, sourceHeight);
            if (!sourceEdge) return fitToLimits(targetEdge, targetEdge);
            const scale = targetEdge / sourceEdge;
            return fitToLimits(sourceWidth * scale, sourceHeight * scale);
        }

        function dimensions() {
            return mode === 'custom'
                ? fitToLimits(customWidth, customHeight)
                : presetDimensions();
        }

        function value() {
            const { width, height } = dimensions();
            return `${width}x${height}`;
        }

        function persist() {
            localStorage.setItem(storageKey, mode);
            localStorage.setItem(`${storageKey}:width`, String(customWidth));
            localStorage.setItem(`${storageKey}:height`, String(customHeight));
        }

        function render() {
            const wrap = document.getElementById(wrapId);
            if (!wrap) return;
            wrap.classList.toggle('hidden', !active);
            if (!active) return;
            const isCustom = mode === 'custom';
            const hasSource = sourceWidth > 0 && sourceHeight > 0;
            wrap.innerHTML = `<div class="cli-size-control"><div class="cli-size-label">输出尺寸</div><div class="cli-size-options">${[
                ['1k', '1K'], ['2k', '2K'], ['4k', '4K'], ['custom', '自定义']
            ].map(([id, label]) => `<button type="button" class="cli-size-option" data-size-mode="${id}" aria-pressed="${mode === id}">${label}</button>`).join('')}</div><div class="cli-size-custom${isCustom ? '' : ' hidden'}"><input type="number" min="16" max="3840" step="1" aria-label="自定义宽度" value="${customWidth}"><span>×</span><input type="number" min="16" max="3840" step="1" aria-label="自定义高度" value="${customHeight}"></div><div class="cli-size-summary">${hasSource && !isCustom ? '跟随原图比例 · ' : ''}${value()} 像素</div></div>`;
            wrap.querySelectorAll('[data-size-mode]').forEach(button => button.addEventListener('click', () => {
                mode = button.dataset.sizeMode || '1k';
                persist();
                render();
            }));
            const inputs = wrap.querySelectorAll('.cli-size-custom input');
            if (inputs.length === 2) {
                inputs[0].addEventListener('change', () => { customWidth = cleanDimension(inputs[0].value) || customWidth; persist(); render(); });
                inputs[1].addEventListener('change', () => { customHeight = cleanDimension(inputs[1].value) || customHeight; persist(); render(); });
            }
        }

        installStyles();
        return {
            value,
            setActive(value) {
                active = Boolean(value);
                render();
            },
            setSourceDimensions(width, height) {
                sourceWidth = cleanDimension(width);
                sourceHeight = cleanDimension(height);
                render();
            }
        };
    }

    global.StudioCliImageTools = { create, createSizeControl };
})(window);
