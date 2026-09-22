(function (global) {
    let stylesInstalled = false;

    function escapeHtml(value) {
        const node = document.createElement('span');
        node.textContent = String(value ?? '');
        return node.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function t(key, fallback) {
        return global.StudioI18n?.t?.(key) || fallback;
    }

    function eligibleProviders(providers) {
        if (!Array.isArray(providers)) return [];
        return providers.filter(item => item?.enabled !== false && !['modelscope','runninghub','volcengine'].includes(item.id)
            && item.image_configured === true
            && Array.isArray(item.image_models)
            && item.image_models.length > 0);
    }

    function installStyles() {
        if (stylesInstalled) return;
        stylesInstalled = true;
        const style = document.createElement('style');
        style.textContent = `
            /* 共享控件尺寸与字号统一走 theme.css 的 --ui-* 变量 */
            .cli-provider-picker { position: relative; }
            .cli-provider-trigger { width: 100%; min-height: var(--ui-control-h, 40px); display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 1px solid var(--ui-border, #e4e4e7); border-radius: var(--ui-radius-input, 8px); background: var(--ui-panel, #fff); color: var(--ui-text, #18181b); font-family: inherit; font-size: var(--ui-font-body, 14px); font-weight: 600; line-height: 1.3; text-align: left; cursor: pointer; transition: border-color .15s ease, box-shadow .15s ease; }
            .cli-provider-trigger:hover, .cli-provider-trigger[aria-expanded="true"] { border-color: var(--ui-accent, #4f46e5); }
            .cli-provider-trigger:focus-visible { outline: none; box-shadow: var(--ui-focus-ring, 0 0 0 3px rgba(79, 70, 229, .28)); }
            .cli-provider-trigger:disabled { color: var(--ui-text-3, #71717a); cursor: not-allowed; background: var(--ui-panel-soft, #f1f3f5); }
            .cli-provider-caret { width: 12px; height: 12px; flex: 0 0 auto; transition: transform .15s ease; }
            .cli-provider-trigger[aria-expanded="true"] .cli-provider-caret { transform: rotate(180deg); }
            .cli-provider-menu { position: absolute; z-index: 60; top: calc(100% + 5px); left: 0; right: 0; display: grid; gap: 2px; padding: 4px; border: 1px solid var(--ui-border, #e4e4e7); border-radius: var(--ui-radius-input, 8px); background: var(--ui-panel, #fff); box-shadow: 0 12px 26px rgba(15, 23, 42, .16); max-height: 260px; overflow-y: auto; }
            .cli-provider-menu.hidden { display: none; }
            .cli-provider-option { width: 100%; padding: 9px 9px; border: 0; border-radius: 6px; background: transparent; color: var(--ui-text-2, #52525b); font-family: inherit; font-size: var(--ui-font-body, 14px); font-weight: 500; line-height: 1.35; text-align: left; cursor: pointer; }
            .cli-provider-option:hover, .cli-provider-option[aria-selected="true"] { background: var(--ui-panel-soft, #f1f3f5); color: var(--ui-text, #18181b); }
            .cli-provider-option[aria-selected="true"]::after { content: '✓'; float: right; color: var(--ui-accent, #4f46e5); }
            .cli-size-control { display: grid; gap: 8px; margin-top: 4px; font-family: inherit; }
            .cli-size-label { color: var(--ui-text-2, #52525b); font-family: inherit; font-size: var(--ui-font-label, 14px); font-weight: 600; line-height: 1.3; }
            .cli-size-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; align-items: start; }
            .cli-size-field { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
            .cli-size-select, .cli-size-custom { width: 100%; min-width: 0; max-width: 100%; height: var(--ui-control-h, 40px); border: 1px solid var(--ui-border, #e4e4e7); border-radius: var(--ui-radius-input, 8px); background: var(--ui-panel, #fff); color: var(--ui-text, #18181b); outline: none; padding: 0 10px; font-family: inherit; font-size: var(--ui-font-body, 14px); font-weight: 500; line-height: 1; }
            .cli-size-select:focus-visible, .cli-size-custom:focus-visible { border-color: var(--ui-accent, #4f46e5); box-shadow: var(--ui-focus-ring, 0 0 0 3px rgba(79, 70, 229, .28)); }
            .cli-size-select { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .cli-size-select:disabled { opacity: .55; cursor: not-allowed; }
            .cli-size-pair { display: none; grid-template-columns: 1fr 1fr; gap: 6px; }
            .cli-size-field.custom .cli-size-pair { display: grid; }
            .cli-size-pair .cli-size-custom { display: block; }
            .cli-size-sub { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
            .cli-size-sub > span { color: var(--ui-text-3, #71717a); font-size: var(--ui-font-caption, 12px); font-weight: 500; line-height: 1.2; }
            .cli-size-summary { color: var(--ui-text-3, #71717a); font-family: inherit; font-size: var(--ui-font-caption, 12px); font-weight: 500; line-height: 1.4; }
            @media (max-width: 640px) { .cli-size-row { grid-template-columns: 1fr; } }
            html.studio-theme-dark .cli-provider-trigger, html.studio-theme-dark .cli-provider-menu { background: var(--ui-panel, #1f2937); border-color: var(--ui-border, #475569); color: var(--ui-text, #e5e7eb); }
            html.studio-theme-dark .cli-provider-trigger:disabled { background: var(--ui-panel-soft, #1f2937); color: var(--ui-text-3, #94a3b8); }
            html.studio-theme-dark .cli-provider-option { color: var(--ui-text-2, #cbd5e1); }
            html.studio-theme-dark .cli-provider-option:hover, html.studio-theme-dark .cli-provider-option[aria-selected="true"] { background: var(--ui-panel-soft, #334155); color: var(--ui-text, #fff); }
            html.studio-theme-dark .cli-size-select, html.studio-theme-dark .cli-size-custom { border-color: var(--ui-border, #475569); background: var(--ui-panel, #1f2937); color: var(--ui-text, #cbd5e1); }
        `;
        document.head.appendChild(style);
    }

    function create(options) {
        const {selectId, hintId, wrapId, storageKey, localModel, onChange} = options;
        let providers = [];
        let selectedKey = localStorage.getItem(`${storageKey}:model`) || '';
        const localEnabled = () => global.StudioImageCapabilities?.localEnabled() === true;
        const choices = () => [
            ...(localEnabled() ? [{id:'local-comfy', name:'本地 ComfyUI', image_models:[localModel], local:true}] : []),
            ...providers.flatMap(p => p.image_models.map(model => ({...p, image_models:[model]})))
        ];
        const key = p => JSON.stringify([p.id, p.image_models[0]]);
        const selected = () => choices().find(p => key(p) === selectedKey) || null;
        function render(){
            if (!selectedKey || (!localEnabled() && selectedKey.startsWith('["local-comfy",'))) {
                const first = choices().find(p => !p.local) || choices()[0];
                selectedKey = first ? key(first) : '';
                if (selectedKey) localStorage.setItem(`${storageKey}:model`, selectedKey);
            }
            const wrap = document.getElementById(wrapId), picker = document.getElementById(selectId), hint = document.getElementById(hintId);
            if(!wrap || !picker) return;
            wrap.classList.remove('hidden');
            picker.innerHTML = `<select class="cli-size-select" aria-label="模型">${selected() ? '' : '<option value="" selected disabled>原模型不可用，请重新选择</option>'}${choices().map(p => `<option value="${escapeHtml(key(p))}" ${key(p) === selectedKey ? 'selected' : ''}>${escapeHtml(p.image_models[0])} · ${escapeHtml(p.name || p.id)}</option>`).join('')}</select>`;
            if(hint) hint.textContent = '';
            picker.querySelector('select').onchange = event => {
                selectedKey = event.target.value; localStorage.setItem(`${storageKey}:model`, selectedKey);
                onChange?.(selected()?.local ? 'local' : 'cli');
            };
        }
        installStyles();
        async function refresh(){
            try {
                const response = await fetch('/api/providers');
                if(!response.ok) throw new Error('模型配置加载失败');
                const data = await response.json();
                providers = eligibleProviders(data.providers || []);
            } catch(error) { console.warn('模型配置加载失败', error); }
            render();
            onChange?.(selected()?.local ? 'local' : 'cli');
        }
        window.addEventListener('message', event => { if(event.data?.type === 'providers-changed') refresh(); });
        window.addEventListener('studio-lang-change', render);
        window.addEventListener('studio-local-comfy-change', () => { render(); onChange?.(selected()?.local ? 'local' : 'cli'); });
        return {refresh, selected, setActive(){ render(); }};
    }

    function createSizeControl(options) {
        const { wrapId, storageKey } = options;
        const nativeSize = () => global.StudioImageCapabilities?.nativeResolution(options.getModel?.()) === true;
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
            const targetEdge = nativeSize() ? 1024 : ({ '1k': 1024, '2k': 2048, '4k': 3840 }[resolution] || 1024);
            const [ratioWidth, ratioHeight] = selectedRatio();
            const ratioEdge = Math.max(ratioWidth, ratioHeight);
            if (!ratioEdge) return fitToLimits(targetEdge, targetEdge);
            const scale = targetEdge / ratioEdge;
            return fitToLimits(ratioWidth * scale, ratioHeight * scale);
        }

        function dimensions() {
            return !nativeSize() && resolution === 'custom'
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
            wrap.innerHTML = `<div class="cli-size-control"><div class="cli-size-label">${escapeHtml(t('studio.outputSize', '输出尺寸'))}</div><div class="cli-size-row"><label class="cli-size-field${resolution === 'custom' ? ' custom' : ''}"><select class="cli-size-select" data-size-resolution aria-label="${escapeHtml(t('studio.resolution', '清晰度'))}">${resolutionOptions.map(([id, label]) => `<option value="${id}"${resolution === id ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select><span class="cli-size-pair"><label class="cli-size-sub"><span>${escapeHtml(t('online.width', '宽度'))}</span><input class="cli-size-custom" data-custom-width type="number" min="16" max="3840" step="1" aria-label="${escapeHtml(t('online.width', '宽度'))}" value="${customWidth}"></label><label class="cli-size-sub"><span>${escapeHtml(t('online.height', '高度'))}</span><input class="cli-size-custom" data-custom-height type="number" min="16" max="3840" step="1" aria-label="${escapeHtml(t('online.height', '高度'))}" value="${customHeight}"></label></span></label><label class="cli-size-field${visibleRatio === 'custom' ? ' custom' : ''}"><select class="cli-size-select" data-size-ratio aria-label="${escapeHtml(t('studio.aspectRatio', '画幅'))}"${resolution === 'custom' ? ' disabled' : ''}>${ratioOptions.map(([id, label]) => `<option value="${id}"${visibleRatio === id ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select><span class="cli-size-pair"><label class="cli-size-sub"><span>${escapeHtml(t('online.ratioWidth', '宽'))}</span><input class="cli-size-custom" data-ratio-width type="number" min="1" step="1" aria-label="${escapeHtml(t('online.ratioWidth', '宽'))}" value="${customRatioWidth}"></label><label class="cli-size-sub"><span>${escapeHtml(t('online.ratioHeight', '高'))}</span><input class="cli-size-custom" data-ratio-height type="number" min="1" step="1" aria-label="${escapeHtml(t('online.ratioHeight', '高'))}" value="${customRatioHeight}"></label></span></label></div><div class="cli-size-summary">${escapeHtml(customPrefix + sourcePrefix + value() + ' ' + unit)}</div></div>`;
            if (nativeSize()) {
                const resolutionField = wrap.querySelector('[data-size-resolution]').closest('label.cli-size-field');
                resolutionField.hidden = true;
                resolutionField.style.display = 'none';
                wrap.querySelector('.cli-size-row').style.gridTemplateColumns = 'minmax(0, 1fr)';
                wrap.querySelector('[data-size-ratio]').disabled = false;
                wrap.querySelector('.cli-size-summary').textContent = '原生分辨率 · 画幅作为生成要求，实际尺寸以结果为准';
            }
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
