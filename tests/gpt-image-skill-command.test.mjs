import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backend = readFileSync(new URL('../main.py', import.meta.url), 'utf8');

assert.match(backend, /def gpt_image_2_skill_command\(/, 'the backend must construct a cross-platform GPT Image 2 Skill command');
assert.match(backend, /gpt_image_2_skill\.cjs/, 'the backend must prefer the supported Node Skill wrapper');
assert.match(backend, /args\s*=\s*\[\*command,\s*"--json"\]/, 'generation must preserve the executable-and-wrapper command prefix');
assert.match(backend, /"--out",\s*out_path/, 'generation must pass the required output path explicitly');
assert.doesNotMatch(backend, /args\s*=\s*\[\s*exe,\s*"--json"\s*\]/, 'generation must not directly invoke a Windows command-script shim');
