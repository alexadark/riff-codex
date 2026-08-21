import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(REPOSITORY, 'riff', 'bin', 'riff.mjs');
const PLUGIN_ROOT = path.join(REPOSITORY, 'riff');
const roots = [];

function fixture() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'riff-codex-test-')));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  mkdirSync(path.join(root, '.home'), { recursive: true });
  return root;
}

function runCli(root, ...args) {
  return execFileSync(process.execPath, [CLI, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, HOME: path.join(root, '.home'), CODEX_HOME: path.join(root, '.home', '.codex') },
  });
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function baseState(phases = []) {
  return {
    version: 1,
    project: { name: 'Test', objective: 'Verify coexistence' },
    roadmap: { source: 'ROADMAP.yaml', out_of_scope: [] },
    phases,
    activeWave: null,
    lastCommit: null,
    lastValidation: null,
    reviews: { functional: null, security: null },
    securityFindings: [],
    humanAction: null,
    validationNeeds: [],
    model: null,
    updatedAt: null,
  };
}

test.after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

test('installs beside foreign Claude RIFF paths without changing shared artifacts', () => {
  const root = fixture();
  mkdirSync(path.join(root, 'claude-riff'));
  writeFileSync(path.join(root, 'claude-riff', 'sentinel'), 'foreign framework\n');
  symlinkSync('claude-riff', path.join(root, '.riff'));
  const foreignConfig = { version: 1, managed: { cli: '.riff/riff', pluginRoot: '/foreign/claude-riff' }, unknown: 'untouched' };
  writeJson(path.join(root, '.riff-state', 'config.json'), foreignConfig);
  writeFileSync(path.join(root, '.riff-state', 'sentinel'), 'foreign state\n');
  const project = '# Shared project\n\nOwned by both runtimes.\n';
  const roadmap = '# Claude layout\nname: Shared\nphase-alpha:\n  title: First\n  status: todo\n  custom: keep-me\n';
  writeFileSync(path.join(root, 'PROJECT.md'), project);
  writeFileSync(path.join(root, 'ROADMAP.yaml'), roadmap);

  runCli(root, 'init', '--project-root', root, '--non-interactive');

  assert.equal(lstatSync(path.join(root, '.riff')).isSymbolicLink(), true);
  assert.equal(readlinkSync(path.join(root, '.riff')), 'claude-riff');
  assert.equal(readFileSync(path.join(root, '.riff-state', 'sentinel'), 'utf8'), 'foreign state\n');
  assert.deepEqual(JSON.parse(readFileSync(path.join(root, '.riff-state', 'config.json'), 'utf8')), foreignConfig);
  assert.equal(readFileSync(path.join(root, 'PROJECT.md'), 'utf8'), project);
  assert.equal(readFileSync(path.join(root, 'ROADMAP.yaml'), 'utf8'), roadmap);
  assert.equal(lstatSync(path.join(root, '.riff-codex')).isSymbolicLink(), true);
  assert.equal(existsSync(path.join(root, '.riff-codex-state', 'state.json')), true);
  assert.equal(existsSync(path.join(root, '.agents', 'skills', 'riff-codex-wave')), true);
  assert.match(runCli(root, 'doctor'), /0 error\(s\)/);
});

test('migrates an owned legacy Codex install without losing active state or evidence', () => {
  const root = fixture();
  symlinkSync(PLUGIN_ROOT, path.join(root, '.riff'));
  const approvedHash = 'approved-legacy-hooks';
  const config = {
    version: 1,
    language: 'fr',
    hooks: { approvedHash },
    managed: { cli: '.riff/bin/riff.mjs', pluginRoot: PLUGIN_ROOT, hooksHash: approvedHash },
    unknown: { preserve: true },
  };
  const phase = { id: 'phase-active', title: 'Active', outcome: 'Keep moving', demo: '', priority: 'P1', depends_on: [], blocking_edges: [], risks: [], sensitive: false, status: 'active', commit: null, attempts: 0, reason: null };
  const state = { ...baseState([phase]), activeWave: { phase: phase.id, startedAt: '2026-01-01T00:00:00.000Z', checkpointAt: '2026-01-01T00:01:00.000Z' } };
  writeJson(path.join(root, '.riff-state', 'config.json'), config);
  writeJson(path.join(root, '.riff-state', 'state.json'), state);
  writeFileSync(path.join(root, '.riff-state', 'events.ndjson'), '{"type":"before-migration"}\n');
  writeJson(path.join(root, '.riff-state', 'receipts', 'phase-active-functional.json'), { status: 'pass', candidate: 'tree', unknown: true });

  const previous = path.join(root, '.riff-state', 'git-hooks', 'pre-commit.foreign.previous');
  mkdirSync(path.dirname(previous), { recursive: true });
  writeFileSync(previous, '#!/bin/sh\nexit 0\n');
  chmodSync(previous, 0o755);
  const hooksDir = path.join(root, '.git', 'hooks');
  writeFileSync(path.join(hooksDir, 'pre-commit'), `#!/bin/sh\n# RIFF managed wrapper\nRIFF_PREVIOUS=${JSON.stringify(previous)}\n/usr/bin/env node "$(git rev-parse --show-toplevel)/.riff/bin/riff.mjs" hook git-pre-commit\n`);
  writeFileSync(path.join(hooksDir, 'commit-msg'), '#!/bin/sh\n# RIFF managed wrapper\nRIFF_PREVIOUS=""\n/usr/bin/env node "$(git rev-parse --show-toplevel)/.riff/bin/riff.mjs" hook git-commit-msg "$@"\n');

  runCli(root, 'init', '--project-root', root, '--non-interactive');

  assert.equal(existsSync(path.join(root, '.riff')), false);
  assert.equal(existsSync(path.join(root, '.riff-state')), false);
  assert.deepEqual(JSON.parse(readFileSync(path.join(root, '.riff-codex-state', 'state.json'), 'utf8')), state);
  assert.deepEqual(JSON.parse(readFileSync(path.join(root, '.riff-codex-state', 'receipts', 'phase-active-functional.json'), 'utf8')), { status: 'pass', candidate: 'tree', unknown: true });
  assert.match(readFileSync(path.join(root, '.riff-codex-state', 'events.ndjson'), 'utf8'), /^\{"type":"before-migration"\}\n/);
  const migratedConfig = JSON.parse(readFileSync(path.join(root, '.riff-codex-state', 'config.json'), 'utf8'));
  assert.deepEqual(migratedConfig.unknown, config.unknown);
  assert.equal(migratedConfig.hooks.approvedHash, migratedConfig.managed.hooksHash);
  assert.match(readFileSync(path.join(hooksDir, 'pre-commit'), 'utf8'), /\.riff-codex-state\/git-hooks\/pre-commit\.foreign\.previous/);
});

test('synchronizes Codex and Claude roadmap formats without rewriting either file', () => {
  const cases = [
    {
      format: 'codex',
      roadmap: '# preserve codex comment\nversion: 1\nproject:\n  name: Codex\n  objective: Ship\nunknown_root: yes\nphases:\n  - id: build\n    title: Build\n    outcome: Works\n    priority: P1\n    status: ready\n    depends_on: []\n    custom_phase: keep\n',
      expected: [{ id: 'build', status: 'ready', depends_on: [] }],
    },
    {
      format: 'claude',
      roadmap: '# preserve claude comment\nname: Claude\nunknown_root: yes\nphase-alpha:\n  name: Alpha\n  description: Existing result\n  status: skipped\n  custom_phase: keep\nphase-beta:\n  title: Beta\n  goal: Next result\n  status: todo\n  depends_on: [phase-alpha]\n',
      expected: [
        { id: 'alpha', status: 'skipped', depends_on: [] },
        { id: 'beta', status: 'ready', depends_on: ['alpha'] },
      ],
    },
  ];

  for (const entry of cases) {
    const root = fixture();
    runCli(root, 'init', '--project-root', root, '--non-interactive');
    writeFileSync(path.join(root, 'ROADMAP.yaml'), entry.roadmap);
    runCli(root, 'wave', 'sync');
    assert.equal(readFileSync(path.join(root, 'ROADMAP.yaml'), 'utf8'), entry.roadmap);
    const state = JSON.parse(readFileSync(path.join(root, '.riff-codex-state', 'state.json'), 'utf8'));
    assert.equal(state.roadmap.format, entry.format);
    assert.deepEqual(state.phases.map(({ id, status, depends_on }) => ({ id, status, depends_on })), entry.expected);
  }
});

test('reinstallation is idempotent and keeps foreign Codex and Git hooks chained', () => {
  const root = fixture();
  writeJson(path.join(root, '.codex', 'hooks.json'), {
    description: 'foreign hooks',
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command: 'node /foreign/.riff/bin/riff.mjs hook --id riff-hook:claude' }] }],
      PreToolUse: [{ hooks: [{ type: 'command', command: 'printf foreign' }] }],
    },
  });
  const foreignHook = path.join(root, '.git', 'hooks', 'pre-commit');
  writeFileSync(foreignHook, '#!/bin/sh\n# RIFF managed wrapper\n# foreign command: /.riff/bin/riff.mjs\nprintf chained > .foreign-hook-ran\n');
  chmodSync(foreignHook, 0o755);

  runCli(root, 'init', '--project-root', root, '--non-interactive');
  runCli(root, 'doctor', '--record-hooks-approved');
  runCli(root, 'resync');
  const firstWrapper = readFileSync(foreignHook, 'utf8');
  const firstHooks = readFileSync(path.join(root, '.codex', 'hooks.json'), 'utf8');
  const firstApproval = JSON.parse(readFileSync(path.join(root, '.riff-codex-state', 'config.json'), 'utf8')).hooks.approvedHash;
  runCli(root, 'resync');

  const hooks = JSON.parse(readFileSync(path.join(root, '.codex', 'hooks.json'), 'utf8'));
  const commands = Object.values(hooks.hooks).flat().flatMap((group) => group.hooks ?? []).map((hook) => hook.command);
  assert.equal(commands.filter((command) => command.includes('riff-codex-hook:')).length, 6);
  assert.equal(commands.includes('node /foreign/.riff/bin/riff.mjs hook --id riff-hook:claude'), true);
  assert.equal(commands.includes('printf foreign'), true);
  assert.equal(readFileSync(foreignHook, 'utf8'), firstWrapper);
  assert.equal(readFileSync(path.join(root, '.codex', 'hooks.json'), 'utf8'), firstHooks);
  assert.equal(JSON.parse(readFileSync(path.join(root, '.riff-codex-state', 'config.json'), 'utf8')).hooks.approvedHash, firstApproval);
  assert.equal(readdirSync(path.join(root, '.riff-codex-state', 'git-hooks')).filter((name) => name.startsWith('pre-commit.')).length, 1);
  execFileSync(foreignHook, { cwd: root });
  assert.equal(readFileSync(path.join(root, '.foreign-hook-ran'), 'utf8'), 'chained');
});
