import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const zimage = readFileSync(new URL('../static/zimage.html', import.meta.url), 'utf8');
const backend = readFileSync(new URL('../main.py', import.meta.url), 'utf8');
const index = readFileSync(new URL('../static/index.html', import.meta.url), 'utf8');
const apiSettings = readFileSync(new URL('../static/js/api-settings.js', import.meta.url), 'utf8');

assert.match(zimage, /id="modeCli"/, 'zimage must expose a CLI engine source');
assert.match(zimage, /id="cliProviderSelect"/, 'zimage must let the user select a configured CLI provider');
assert.match(zimage, /id="zimageSizeWrap"/, 'zimage must expose shared output-size controls');
assert.match(zimage, /createSizeControl\(/, 'zimage must initialize the shared output-size controls');
assert.match(zimage, /size:\s*zimageSizeControl\.value\(\)/, 'zimage CLI requests must use the selected output size');
assert.match(zimage, /fetch\('\/api\/providers'/, 'zimage must load configured providers');
assert.match(zimage, /providers-changed[\s\S]*?loadCliImageProviders/, 'zimage must refresh CLI providers after API settings changes');
assert.match(zimage, /function eligibleCliImageProviders\(providers\)[\s\S]*?item\.image_configured === true[\s\S]*?Array\.isArray\(item\.image_models\)[\s\S]*?item\.image_models\.length > 0/, 'zimage must select only configured image providers');
assert.doesNotMatch(zimage, /BUILT_IN_REMOTE_PROVIDER_IDS|CLI_PROTOCOLS/, 'zimage must not discard valid providers by protocol or provider ID');
assert.match(index, /frame-zimage" data-src="\/static\/zimage\.html\?v=[^"]+"/, 'local text-to-image iframe must load a versioned resource');
assert.match(index, /frame-angle" data-src="\/static\/angle\.html\?v=[^"]+"/, 'local angle iframe must load a versioned resource');
assert.match(apiSettings, /本机 CLI 已就绪[\s\S]*?本机 CLI 未就绪/, 'API settings must show local CLI readiness instead of a missing address');
assert.match(zimage, /fetch\('\/api\/online-image'/, 'CLI image generation must use the provider-aware image endpoint');
assert.match(zimage, /history_type:\s*['"]zimage['"]/, 'CLI requests must preserve zimage history');
assert.match(zimage, /if \(!cliImageProviders\.length\)[\s\S]*?请先在 API 设置中添加可用的 CLI 图像引擎/, 'zimage must explain missing CLI configuration without submitting a request');
assert.match(backend, /history_type:\s*str\s*=\s*["']online["']/, 'online-image requests must default their history type to online');
assert.match(backend, /["']type["']:\s*payload\.history_type/, 'online-image results must store the caller history type');
