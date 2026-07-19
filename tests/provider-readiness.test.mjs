import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backend = readFileSync(new URL('../main.py', import.meta.url), 'utf8');
const apiSettings = readFileSync(new URL('../static/js/api-settings.js', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../static/css/api-settings.css', import.meta.url), 'utf8');

assert.match(backend, /async def public_api_providers_with_image_configuration\(/, 'provider responses must calculate readiness on the backend');
assert.match(backend, /provider\["image_configured"\]\s*=\s*image_configured/, 'provider responses must expose image_configured');
assert.match(backend, /await public_api_providers_with_image_configuration\(\)/, 'GET and save responses must return the readiness-enriched provider list');
assert.match(apiSettings, /item\.image_configured \?/, 'provider cards must render a configured indicator from backend readiness');
assert.match(apiSettings, /provider-configured-check/, 'provider cards must include the configured checkmark element');
assert.match(stylesheet, /\.provider-configured-check/, 'configured checkmarks must have visible styling');
