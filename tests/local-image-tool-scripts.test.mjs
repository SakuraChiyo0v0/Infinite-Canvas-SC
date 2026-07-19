import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const name of ['enhance.html', 'klein.html', 'angle.html']) {
  const html = readFileSync(new URL(`../static/${name}`, import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attributes]) => !attributes.includes('src=') && !attributes.includes('importmap') && !attributes.includes('type="module"'))
    .map(([, , source]) => source);
  assert.ok(scripts.length > 0, `${name} must contain inline behavior scripts`);
  scripts.forEach(source => new Function(source));
}
