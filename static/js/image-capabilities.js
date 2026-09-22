(function (global) {
    // Only the explicitly named web adapter lacks a pixel-size contract.
    // Standard GPT Image API models continue to expose their normal sizes.
    function nativeResolution(model) {
        return /^(?:ChatGPT\s*网页版|chatgpt[-_ ]?web)\//i.test(String(model || '').trim());
    }
    function localEnabled() {
        try { return global.localStorage.getItem('studio_local_comfy_enabled') === 'true'; }
        catch (_) { return false; }
    }
    function syncLocalUI() {
        document.querySelectorAll('[data-local-comfy]').forEach(element => {
            element.hidden = !localEnabled();
            element.style.display = localEnabled() ? '' : 'none';
            if (element.tagName === 'OPTION') element.disabled = !localEnabled();
        });
    }
    function localChanged() {
        syncLocalUI();
        global.dispatchEvent(new Event('studio-local-comfy-change'));
    }
    function setLocalEnabled(enabled) {
        global.localStorage.setItem('studio_local_comfy_enabled', String(Boolean(enabled)));
        localChanged();
    }
    global.addEventListener?.('storage', event => {
        if (event.key === 'studio_local_comfy_enabled') localChanged();
    });
    if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', syncLocalUI);
    global.StudioImageCapabilities = { nativeResolution, localEnabled, setLocalEnabled };
})(window);
