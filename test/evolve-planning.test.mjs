import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { DISCOVERY_AREAS } from '../riff/lib/delivery-contract.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const cliPath = path.join(repository, 'riff/bin/riff.mjs');
const roots = [];
function write(root, relative, value) {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
}
const read = (root, relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const state = (root) => read(root, '.riff-codex-state/state.json');
function cli(root, ...args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: root, encoding: 'utf8',
    env: { ...process.env, HOME: path.join(root, '.fixture-home'), CODEX_HOME: path.join(root, '.fixture-home/.codex') },
  });
  return { status: result.status, text: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}
function ok(root, ...args) {
  const result = cli(root, ...args);
  assert.equal(result.status, 0, result.text);
  return result.text;
}
function fixture() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'riff-evolve-planning-')));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  ok(root, 'init', '--project-root', root, '--non-interactive');
  return root;
}
function review(root) {
  const snapshot = JSON.parse(ok(root, 'discovery', 'snapshot'));
  write(root, '.riff-codex-state/discovery-input.json', {
    version: 1, candidate: snapshot.digest, type: 'discovery', status: 'pass',
    reviewer: { id: 'fixture-reviewer', independent: true },
    evidence: ['Synthetic lifecycle fixture, not a product review.'], findings: [],
  });
  ok(root, 'discovery', 'review', '--evidence', '.riff-codex-state/discovery-input.json');
  ok(root, 'discovery', 'check');
  return snapshot.digest;
}
test.after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

test('init and resync expose evolve without onboarding or activating an application', () => {
  const root = fixture();
  const link = path.join(root, '.agents/skills/riff-codex-evolve');
  const source = path.join(repository, 'riff/skills/evolve');
  assert.equal(realpathSync(link), source);
  const skill = readFileSync(path.join(link, 'SKILL.md'), 'utf8');
  const metadata = YAML.parse(skill.split('---')[1]);
  assert.deepEqual(Object.keys(metadata).sort(), ['description', 'name']);
  assert.equal(metadata.name, 'evolve');
  const ui = YAML.parse(readFileSync(path.join(link, 'agents/openai.yaml'), 'utf8'));
  assert.match(ui.interface.default_prompt, /\$evolve/);
  assert.ok(ui.interface.short_description.length >= 25 && ui.interface.short_description.length <= 64);
  for (const [, relative] of skill.matchAll(/\]\((\.\.\/[^)]+)\)/g)) {
    assert.ok(existsSync(path.resolve(source, relative)), relative);
  }
  assert.equal(existsSync(path.join(root, 'PROJECT.md')), false);
  assert.equal(existsSync(path.join(root, 'ROADMAP.yaml')), false);
  assert.equal(state(root).activeWave, null);
  const before = readFileSync(path.join(root, '.riff-codex-state/state.json'), 'utf8');
  unlinkSync(link);
  ok(root, 'resync');
  assert.equal(realpathSync(link), source);
  assert.equal(readFileSync(path.join(root, '.riff-codex-state/state.json'), 'utf8'), before);
});

test('a scoped evolution reuses discovery readiness while legacy planning stays unenrolled and inactive', () => {
  const root = fixture();
  write(root, 'PROJECT.md', '# Existing app\nIndividual accounts keep their private records.\n');
  write(root, 'taste.md', '# Existing conventions\nReuse the current identity boundary.\n');
  const roadmap = { version: 1, project: { name: 'Invitations' }, phases: [] };
  write(root, 'ROADMAP.yaml', roadmap);
  ok(root, 'wave', 'sync');
  assert.deepEqual(state(root).phases, [], 'onboarding needs no invented historical phases');
  roadmap.phases.push({ id: 'invite', title: 'Invite a colleague', outcome: 'An invited colleague can access only the shared workspace.', priority: 'P1' });
  write(root, 'ROADMAP.yaml', roadmap);
  ok(root, 'wave', 'sync');
  assert.equal(state(root).discovery, null);
  assert.equal(state(root).activeWave, null);
  assert.equal(state(root).phases[0].status, 'ready');

  // Explicit full-version enrollment reuses the existing discovery implementation.
  const analysis = 'docs/specs/evolutions/team.md';
  write(root, analysis, '# Team change\nPrivate records stay private; accepted invitations grant shared workspace access.\n');
  write(root, 'docs/specs/readiness.json', { version: 1, areas: Object.fromEntries(
    DISCOVERY_AREAS.map((area) => [area, { files: area === 'decisions' ? [analysis] : ['PROJECT.md'] }]),
  ) });
  const previous = review(root);
  const before = state(root).discovery.review;
  ok(root, 'wave', 'sync');
  assert.deepEqual(state(root).discovery.review, before);
  assert.equal(state(root).activeWave, null, 'successful planning does not activate execution');

  write(root, analysis, '# Team change\nRevocation removes workspace access; private records remain inaccessible.\n');
  const rejected = cli(root, 'wave', 'activate', 'invite');
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.text, /stale/);
  assert.equal(state(root).activeWave, null);
  assert.notEqual(review(root), previous);
  assert.equal(state(root).activeWave, null);
  ok(root, 'wave', 'activate', 'invite');
  assert.equal(state(root).activeWave.phase, 'invite', 'only a separate explicit wave activates work');
});
