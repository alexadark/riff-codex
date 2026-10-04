import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { AGENTS_DIR, claudeAgents } from '../riff/lib/claude-agents.mjs';

const RIFF = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'riff');
const catalog = JSON.parse(readFileSync(path.join(RIFF, 'references', 'model-profiles.json'), 'utf8'));

test('Claude Code subagents match every Anthropic catalog profile', () => {
  const expected = claudeAgents(catalog);
  assert.deepEqual(readdirSync(AGENTS_DIR).filter((file) => file.endsWith('.md')).sort(), expected.map((agent) => agent.file).sort(), 'run node riff/lib/claude-agents.mjs');
  for (const agent of expected) assert.equal(readFileSync(path.join(AGENTS_DIR, agent.file), 'utf8'), agent.content, `${agent.file} is stale: run node riff/lib/claude-agents.mjs`);
  assert.match(expected.find((agent) => agent.file === 'opus-5-5-medium.md').content, /\nmodel: claude-opus-5-5\neffort: medium\n/);
  assert.doesNotMatch(expected.find((agent) => agent.file === 'haiku-4-5.md').content, /effort:/);
});

test('the riff plugin exposes every skill except the Codex-only deep-audit', () => {
  const marketplace = JSON.parse(readFileSync(path.join(RIFF, '.claude-plugin', 'marketplace.json'), 'utf8'));
  const plugin = marketplace.plugins.find((entry) => entry.name === 'riff');
  assert.equal(plugin.source, '.');
  const skills = readdirSync(path.join(RIFF, 'skills')).filter((name) => name !== 'deep-audit').sort();
  assert.deepEqual(plugin.skills, skills.map((name) => `./skills/${name}`));
  for (const entry of marketplace.plugins) assert.equal(existsSync(path.join(RIFF, entry.source)), true, entry.source);
});
