import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../static/${name}`, import.meta.url), 'utf8');
const enhance = read('enhance.html');
const klein = read('klein.html');
const angle = read('angle.html');
const cliHelpers = readFileSync(new URL('../static/js/cli-image-tools.js', import.meta.url), 'utf8');
const studioI18n = readFileSync(new URL('../static/js/i18n/studio.js', import.meta.url), 'utf8');

for (const [name, source, historyType] of [
  ['enhance', enhance, 'enhance'],
  ['klein', klein, 'klein'],
  ['angle', angle, 'angle'],
]) {
  assert.match(source, /StudioCliImageTools/, `${name} must configure shared CLI provider discovery`);
  assert.match(source, /cli-image-tools\.js\?v=/, `${name} must load the current shared provider picker version`);
  assert.match(source, /\/api\/online-image/, `${name} must use the provider-aware image endpoint`);
  assert.match(source, new RegExp(`history_type:\\s*['\"]${historyType}['\"]`), `${name} must retain its tool history type`);
  assert.match(source, /reference_images/, `${name} must send uploaded images as references`);
  assert.match(source, /createSizeControl\(/, `${name} must expose CLI output-size controls`);
  assert.match(source, /size:\s*cliSizeControl\.value\(\)/, `${name} must submit the selected CLI output size`);
}

assert.match(cliHelpers, /fetch\('\/api\/providers'/, 'shared CLI helper must discover configured providers');
assert.match(cliHelpers, /providers-changed/, 'shared CLI helper must refresh providers after API settings changes');
assert.match(cliHelpers, /function createSizeControl\(/, 'shared CLI helper must provide reusable output-size controls');
assert.match(cliHelpers, /跟随原图比例/, 'preset output sizes must follow the uploaded source image ratio');
assert.match(cliHelpers, /cli-size-row/, 'output-size controls must use the online image page two-column layout');
assert.match(cliHelpers, /data-size-resolution/, 'output-size controls must expose a resolution selector');
assert.match(cliHelpers, /data-size-ratio/, 'output-size controls must expose an aspect-ratio selector');
assert.match(cliHelpers, /studio-lang-change/, 'output-size controls must rerender when the language changes');
assert.match(cliHelpers, /font-family:\s*inherit/, 'shared controls must inherit each page font family');
assert.match(cliHelpers, /\['1k', '1K'\], \['2k', '2K'\], \['4k', '4K'\], \['custom', t\('studio\.customSize', '自定义尺寸'\)\]/, 'output-size controls must offer 1K, 2K, 4K, and custom sizes');
assert.match(cliHelpers, /\['square', t\('online\.square', '1:1 方图'\)\][\s\S]*?\['wide', t\('online\.wide', '16:9 宽屏'\)\]/, 'output-size controls must offer the online image page aspect-ratio choices');
assert.match(studioI18n, /"studio\.outputSize"[\s\S]*?"studio\.followSourceRatio"[\s\S]*?"studio\.pixels"/, 'size-control labels must be registered for both languages');
assert.match(cliHelpers, /function eligibleProviders\(providers\)[\s\S]*?item\.image_configured === true[\s\S]*?Array\.isArray\(item\.image_models\)[\s\S]*?item\.image_models\.length > 0/, 'shared picker must select only configured image providers');
assert.doesNotMatch(cliHelpers, /BUILT_IN_REMOTE_PROVIDER_IDS|CLI_PROTOCOLS/, 'shared picker must not discard valid providers by protocol or provider ID');

assert.match(enhance, /id="cliProviderSelect"/, 'enhancement must expose CLI provider selection');
assert.match(klein, /id="cliBtn"/, 'image editing must expose a CLI engine source');
assert.match(angle, /id="modeCli"/, 'angle control must expose a CLI engine source');
