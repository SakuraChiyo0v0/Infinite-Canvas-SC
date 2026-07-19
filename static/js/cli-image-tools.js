(function (global) {
    let stylesInstalled = false;

    function escapeHtml(value) {
        const node = document.createElement('span');
        node.textContent = String(value ?? '');
        return node.innerHTML;
    }

    function t(key, fallback) {
        return global.StudioI18n?.t?.(key) || fallback;
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
            .cli-provider-trigger { width: 100%; min-height: 34px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; border: 1px solid #dbe2ec; border-radius: 10px; background: #fff; color: #334155; font-family: inherit; font-size: 11px; font-weight: 700; line-height: 1.25; text-align: left; cursor: pointer; transition: border-color .15s ease, box-shadow .15s ease; }
            .cli-provider-trigger:hover, .cli-provider-trigger[aria-expanded="true"] { border-color: #94a3b8; box-shadow: 0 0 0 3px rgba(148, 163, 184, .15); }
            .cli-provider-trigger:disabled { color: #94a3b8; cursor: not-allowed; background: #f8fafc; }
            .cli-provider-caret { width: 12px; height: 12px; flex: 0 0 auto; transition: transform .15s ease; }
            .cli-provider-trigger[aria-expanded="true"] .cli-provider-caret { transform: rotate(180deg); }
            .cli-provider-menu { position: absolute; z-index: 60; top: calc(100% + 5px); left: 0; right: 0; display: grid; gap: 3px; padding: 4px; border: 1px solid #dbe2ec; border-radius: 10px; background: #fff; box-shadow: 0 12px 26px rgba(15, 23, 42, .16); }
            .cli-provider-menu.hidden { display: none; }
            .cli-provider-option { width: 100%; padding: 8px 9px; border: 0; border-radius: 7px; background: transparent; color: #475569; font-family: inherit; font-size: 11px; font-weight: 700; line-height: 1.25; text-align: left; cursor: pointer; }
            .cli-provider-option:hover, .cli-provider-option[aria-selected="true"] { background: #eef2f7; color: #0f172a; }
            .cli-provider-option[aria-selected="true"]::after { content: '✓'; float: right; color: #475569; }
            html.studio-theme-dark .cli-provider-trigger, html.studio-theme-dark .cli-provider-menu { background: #1f2937; border-color: #475569; color: #e5e7eb; }
            html.studio-theme-dark .cli-provider-trigger:disabled { background: #1f2937; color: #94a3b8; }
            html.studio-theme-dark .cli-provider-option { color: #cbd5e1; }
            html.studio-theme-dark .cli-provider-option:hover, html.studio-theme-dark .cli-provider-option[aria-selected="true"] { background: #334155; color: #fff; }
            .cli-size-control { display: grid; gap: 7px; margin-top: 9px; padding-top: 9px; border-top: 1px solid #edf2f7; font-family: inherit; }
            .cli-size-label { color: #94a3b8; font-family: inherit; font-size: 10px; font-weight: 700; line-height: 1.2; letter-spacing: .04em; }
            .cli-size-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; align-items: start; }
            .cli-size-field { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
            .cli-size-select, .cli-size-custom { width: 100%; min-width: 0; max-width: 100%; height: 34px; border: 1px solid #edf2f7; border-radius: 14px; background: #f8fafc; color: #111827; outline: none; padding: 0 10px; font-family: inherit; font-size: 11px; font-weight: 700; line-height: 1; }
            .cli-size-select { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .cli-size-select:disabled { opacity: .55; cursor: not-allowed; }
            .cli-size-pair { display: none; grid-template-columns: 1fr 1fr; gap: 6px; }
            .cli-size-field.custom .cli-size-pair { display: grid; }
            .cli-size-pair .cli-size-custom { display: block; }
            .cli-size-summary { color: #94a3b8; font-family: inherit; font-size: 9px; font-weight: 600; line-height: 1.3; }
            @media (max-width: 640px) { .cli-size-row { grid-template-columns: 1fr; } }
            html.studio-theme-dark .cli-size-control { border-color: #475569; }
            html.studio-theme-dark .cli-size-select, html.studio-theme-dark .cli-size-custom { border-color: #475569; background: #1f2937; color: #cbd5e1; }
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
                picker.innerHTML = `<button type="button" class="cli-provider-trigger" disabled><span>${escapeHtml(t('studio.noConfiguredImageApi', '未配置可用图像 API'))}</span><span class="cli-provider-caret">⌄</span></button>`;
                hint.textContent = t('studio.configureImageApiHint', '请先在 API 设置中启用图像 API，并配置图像模型。');
                return;
            }
            if (!selected()) selectedId = providers[0].id;
            const activeProvider = selected();
            const activeLabel = `${activeProvider.name || activeProvider.id} · ${activeProvider.image_models?.[0] || ''}`;
            picker.innerHTML = `<button type="button" class="cli-provider-trigger" aria-haspopup="listbox" aria-expanded="false"><span>${escapeHtml(activeLabel)}</span><svg class="cli-provider-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="m2 4 4 4 4-4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/></svg></button><div class="cli-provider-menu hidden" role="listbox">${providers.map(item => {
                const label = `${item.name || item.id} · ${item.image_models?.[0] || ''}`;
                return `<button type="button" class="cli-provider-option" role="option" data-provider-id="${escapeHtml(item.id)}" aria-selected="${item.id === selectedId}">${escapeHtml(label)}</button>`;
            }).join('')}</div>`;
            hint.textContent = t('studio.configuredImageApiHint', '仅显示 API 设置中已配置完成的图像 API。');
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
        window.addEventListener('studio-lang-change', render);

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
        const ratios = {
            square: [1, 1],
            portrait: [2, 3],
            landscape: [3, 2],
            portrait43: [3, 4],
            landscape43: [4, 3],
            story: [9, 16],
            wide: [16, 9]
        };
        let active = false;
        let sourceWidth = 0;
        let sourceHeight = 0;
        let resolution = localStorage.getItem(storageKey) || '1k';
        let ratio = localStorage.getItem(`${storageKey}:ratio`) || 'source';
        let customWidth = Number(localStorage.getItem(`${storageKey}:width`)) || 1024;
        let customHeight = Number(localStorage.getItem(`${storageKey}:height`)) || 1024;
        let customRatioWidth = Number(localStorage.getItem(`${storageKey}:ratioWidth`)) || 1;
        let customRatioHeight = Number(localStorage.getItem(`${storageKey}:ratioHeight`)) || 1;

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

        function selectedRatio() {
            if (ratio === 'source' && sourceWidth && sourceHeight) return [sourceWidth, sourceHeight];
            if (ratio === 'custom') return [customRatioWidth, customRatioHeight];
            return ratios[ratio] || ratios.square;
        }

        function presetDimensions() {
            const targetEdge = { '1k': 1024, '2k': 2048, '4k': 3840 }[resolution] || 1024;
            const [ratioWidth, ratioHeight] = selectedRatio();
            const ratioEdge = Math.max(ratioWidth, ratioHeight);
            if (!ratioEdge) return fitToLimits(targetEdge, targetEdge);
            const scale = targetEdge / ratioEdge;
            return fitToLimits(ratioWidth * scale, ratioHeight * scale);
        }

        function dimensions() {
            return resolution === 'custom'
                ? fitToLimits(customWidth, customHeight)
                : presetDimensions();
        }

        function value() {
            const { width, height } = dimensions();
            return `${width}x${height}`;
        }

        function persist() {
            localStorage.setItem(storageKey, resolution);
            localStorage.setItem(`${storageKey}:ratio`, ratio);
            localStorage.setItem(`${storageKey}:width`, String(customWidth));
            localStorage.setItem(`${storageKey}:height`, String(customHeight));
            localStorage.setItem(`${storageKey}:ratioWidth`, String(customRatioWidth));
            localStorage.setItem(`${storageKey}:ratioHeight`, String(customRatioHeight));
        }

        function render() {
            const wrap = document.getElementById(wrapId);
            if (!wrap) return;
            wrap.classList.toggle('hidden', !active);
            if (!active) return;
            const hasSource = sourceWidth > 0 && sourceHeight > 0;
            const visibleRatio = ratio === 'source' && !hasSource ? 'square' : ratio;
            const resolutionOptions = [['1k', '1K'], ['2k', '2K'], ['4k', '4K'], ['custom', t('studio.customSize', '自定义尺寸')]];
            const ratioOptions = [
                ...(hasSource ? [['source', t('studio.followSourceRatio', '跟随原图比例')]] : []),
                ['square', t('online.square', '1:1 方图')], ['portrait', t('online.portrait', '2:3 竖图')], ['landscape', t('online.landscape', '3:2 横图')],
                ['portrait43', t('studio.portrait43', '3:4 竖图')], ['landscape43', t('studio.landscape43', '4:3 横图')], ['story', t('online.story', '9:16 竖屏')],
                ['wide', t('online.wide', '16:9 宽屏')], ['custom', t('online.customRatio', '自定义比例')]
            ];
            const unit = t('studio.pixels', '像素');
            const customPrefix = resolution === 'custom' ? `${t('studio.customSize', '自定义尺寸')} · ` : '';
            const sourcePrefix = hasSource && ratio === 'source' && resolution !== 'custom' ? `${t('studio.followSourceRatio', '跟随原图比例')} · ` : '';
            wrap.innerHTML = `<div class="cli-size-control"><div class="cli-size-label">${escapeHtml(t('studio.outputSize', '输出尺寸'))}</div><div class="cli-size-row"><label class="cli-size-field${resolution === 'custom' ? ' custom' : ''}"><select class="cli-size-select" data-size-resolution aria-label="${escapeHtml(t('studio.resolution', '清晰度'))}">${resolutionOptions.map(([id, label]) => `<option value="${id}"${resolution === id ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select><span class="cli-size-pair"><input class="cli-size-custom" data-custom-width type="number" min="16" max="3840" step="1" aria-label="${escapeHtml(t('online.width', '自定义宽度'))}" value="${customWidth}"><input class="cli-size-custom" data-custom-height type="number" min="16" max="3840" step="1" aria-label="${escapeHtml(t('online.height', '自定义高度'))}" value="${customHeight}"></span></label><label class="cli-size-field${visibleRatio === 'custom' ? ' custom' : ''}"><select class="cli-size-select" data-size-ratio aria-label="${escapeHtml(t('studio.aspectRatio', '画幅'))}"${resolution === 'custom' ? ' disabled' : ''}>${ratioOptions.map(([id, label]) => `<option value="${id}"${visibleRatio === id ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select><span class="cli-size-pair"><input class="cli-size-custom" data-ratio-width type="number" min="1" step="1" aria-label="${escapeHtml(t('online.ratioWidth', '自定义比例宽度'))}" value="${customRatioWidth}"><input class="cli-size-custom" data-ratio-height type="number" min="1" step="1" aria-label="${escapeHtml(t('online.ratioHeight', '自定义比例高度'))}" value="${customRatioHeight}"></span></label></div><div class="cli-size-summary">${escapeHtml(customPrefix + sourcePrefix + value() + ' ' + unit)}</div></div>`;
            wrap.querySelector('[data-size-resolution]').addEventListener('change', event => {
                resolution = event.currentTarget.value || '1k';
                persist();
                render();
            });
            wrap.querySelector('[data-size-ratio]').addEventListener('change', event => {
                ratio = event.currentTarget.value || 'square';
                persist();
                render();
            });
            wrap.querySelector('[data-custom-width]').addEventListener('change', event => { customWidth = cleanDimension(event.currentTarget.value) || customWidth; persist(); render(); });
            wrap.querySelector('[data-custom-height]').addEventListener('change', event => { customHeight = cleanDimension(event.currentTarget.value) || customHeight; persist(); render(); });
            wrap.querySelector('[data-ratio-width]').addEventListener('change', event => { customRatioWidth = Math.max(1, Math.round(Number(event.currentTarget.value) || customRatioWidth)); persist(); render(); });
            wrap.querySelector('[data-ratio-height]').addEventListener('change', event => { customRatioHeight = Math.max(1, Math.round(Number(event.currentTarget.value) || customRatioHeight)); persist(); render(); });
        }

        installStyles();
        window.addEventListener('studio-lang-change', render);
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
