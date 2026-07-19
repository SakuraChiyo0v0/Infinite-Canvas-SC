import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const markup = readFileSync(new URL('../static/api-settings.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../static/js/api-settings.js', import.meta.url), 'utf8');

assert.match(markup, /id="providerList"/, 'the platform list remains the API provider entry point');
assert.doesNotMatch(markup, /cli-quick-group|cli-quick-btn|cli-quick-note/, 'API settings must not render a duplicate CLI shortcut list');
assert.doesNotMatch(script, /function addCliProvider\(/, 'the removed shortcut list must not retain an unused CLI shortcut action');
