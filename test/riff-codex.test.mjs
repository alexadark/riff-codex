import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
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

function runCliFailure(root, ...args) {
  try {
    runCli(root, ...args);
  } catch (error) {
    return `${error.stderr ?? ''}${error.stdout ?? ''}`;
  }
  assert.fail(`expected riff-codex ${args.join(' ')} to fail`);
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
  assert.equal(JSON.parse(readFileSync(path.join(root, '.riff-codex-state', 'config.json'), 'utf8')).preferences.autonomy, 'loop');
  assert.match(runCli(root, 'doctor'), /0 error\(s\)/);
});

test('session start exposes portable taste guidance without modifying shared conventions', () => {
  for (const scope of ['production', 'scratch']) {
    const root = fixture();
    const taste = '# Existing Claude taste\n\nPreserve the approved design.\n';
    writeFileSync(path.join(root, 'taste.md'), taste);
    runCli(root, 'init', '--project-root', root, '--non-interactive', '--scope', scope);
    const output = execFileSync(process.execPath, [CLI, 'hook', 'session-start'], {
      cwd: root,
      encoding: 'utf8',
      input: JSON.stringify({ source: 'resume' }),
    });
    const hook = JSON.parse(output).hookSpecificOutput;
    assert.equal(hook.hookEventName, 'SessionStart');
    assert.match(hook.additionalContext, /read project taste\.md when present/);
    assert.match(hook.additionalContext, /apply the relevant design skills/);
    assert.match(hook.additionalContext, /verify the rendered result in the browser/);
    assert.match(hook.additionalContext, /\$riff:learn-stack/);
    for (const relative of ['references/taste.md', 'references/taste/frontend.md', 'references/taste/stacks/nowstack.md', 'skills/learn-stack/SKILL.md']) {
      assert.equal(existsSync(path.join(root, '.riff-codex', relative)), true, relative);
    }
    assert.equal(readFileSync(path.join(root, 'taste.md'), 'utf8'), taste);
    assert.equal(existsSync(path.join(root, 'taste')), false, 'init and session start do not bootstrap project taste');
    assert.equal(existsSync(path.join(root, 'references')), false, 'hooks do not create research artifacts');
  }
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

function invokeHook(root, name, input = {}, tool = 'Bash') {
  const result = spawnSync(process.execPath, [CLI, 'hook', name], {
    cwd: root, encoding: 'utf8',
    input: JSON.stringify({ tool_name: tool, tool_input: input }),
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('Git pre-commit scans index bytes despite unstaged edits, missing files and unusual names', () => {
  const root = fixture();
  runCli(root, 'init', '--project-root', root, '--non-interactive');
  const file = 'credential with space\nand newline.txt';
  const absolute = path.join(root, file);
  const secret = 'AK' + 'IA' + 'A'.repeat(16);
  const stage = () => execFileSync('git', ['add', '--', file], { cwd: root });
  const check = () => spawnSync(path.join(root, '.git/hooks/pre-commit'), [], { cwd: root, encoding: 'utf8' });
  writeFileSync(absolute, secret);
  stage();
  writeFileSync(absolute, 'redacted');
  assert.equal(check().status, 1, 'unstaged redaction cannot hide an indexed secret');
  rmSync(absolute);
  assert.equal(check().status, 1, 'worktree removal cannot hide an indexed secret');
  writeFileSync(absolute, 'redacted');
  stage();
  writeFileSync(absolute, secret);
  assert.equal(check().status, 0, 'only the safe staged bytes are being committed');
  execFileSync('git', ['-c', 'user.name=Hook Test', '-c', 'user.email=hook@example.invalid', 'commit', '-qm', 'Safe fixture'], { cwd: root });
  rmSync(absolute);
  symlinkSync(secret, absolute);
  stage();
  assert.equal(check().status, 1, 'a staged file type change must also be scanned');
});

test('pre-commit rejects private env files but permits sanitized example templates', () => {
  const root = fixture();
  for (const file of ['.env', 'nested/.env.production', '.env.example', 'nested/.env.production.example', '.envoy']) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), 'SERVICE_URL=https://example.invalid\n');
    execFileSync('git', ['add', '--', file], { cwd: root });
    const result = spawnSync(process.execPath, [CLI, 'hook', 'git-pre-commit'], { cwd: root, encoding: 'utf8' });
    const privateFile = file === '.env' || file === 'nested/.env.production';
    assert.equal(result.status, privateFile ? 1 : 0, `${file}: ${result.stderr}`);
    if (privateFile) assert.match(result.stderr, /Private environment file/);
    execFileSync('git', ['rm', '--cached', '--', file], { cwd: root });
  }
});

test('live Stripe secrets are detected before tools, after edits and before commits', () => {
  const root = fixture();
  for (const prefix of ['sk', 'rk']) {
    const secret = prefix + '_live_' + 'A'.repeat(32);
    const before = invokeHook(root, 'pre-tool', { cmd: `echo ${secret}` });
    assert.equal(before.hookSpecificOutput.permissionDecision, 'deny');
    writeFileSync(path.join(root, 'credential.txt'), secret);
    assert.equal(invokeHook(root, 'post-tool', {}, 'apply_patch').decision, 'block');
    execFileSync('git', ['add', '--', 'credential.txt'], { cwd: root });
    const commit = spawnSync(process.execPath, [CLI, 'hook', 'git-pre-commit'], { cwd: root, encoding: 'utf8' });
    assert.equal(commit.status, 1, commit.stderr);
  }
  assert.deepEqual(invokeHook(root, 'pre-tool', { command: 'echo sk_test_example' }), {});
});

test('destructive guard rejects force pushes and table drops while retaining safe controls', () => {
  const root = fixture();
  const denied = [
    ['git', 'push', '--force'], ['git', 'push', 'origin', 'main', '-f'],
    ['git', 'push', '--force=true'], ['git', 'push', '--force;', 'echo', 'done'], ['DROP', 'TABLE', 'customers'],
    ['git', 'reset', '--hard'],
  ];
  for (const words of denied) {
    for (const field of ['command', 'cmd']) {
      const result = invokeHook(root, 'pre-tool', { [field]: words.join(' ') });
      assert.equal(result.hookSpecificOutput?.permissionDecision, 'deny', words.join(' '));
    }
  }
  for (const words of [['git', 'push', 'origin', 'main'], ['git', 'push', '--force-with-lease'], ['git', 'diff'], ['SELECT', '*', 'FROM', 'customers']]) {
    assert.deepEqual(invokeHook(root, 'pre-tool', { command: words.join(' ') }), {});
  }
});

test('boundary warnings distinguish the current root, descendants, siblings and legacy RIFF', () => {
  const root = fixture();
  assert.deepEqual(invokeHook(root, 'pre-tool', { command: `cat "${root}/file with spaces.md"` }), {});
  assert.deepEqual(invokeHook(root, 'pre-tool', { file_path: root }), {});
  assert.deepEqual(invokeHook(REPOSITORY, 'pre-tool', { command: `cat "${REPOSITORY}/README.md"` }), {});
  const sibling = invokeHook(root, 'pre-tool', { command: `cat ${root}-other/file.md` });
  assert.match(sibling.hookSpecificOutput.additionalContext, /outside the current Git repository/);
  const parent = invokeHook(root, 'pre-tool', { command: `cat ${root}/../outside.md` });
  assert.match(parent.hookSpecificOutput.additionalContext, /outside the current Git repository/);
  const legacyPath = path.join('/Users/webstantly/DEV/frameworks', 'riff', 'README.md');
  const legacy = invokeHook(root, 'pre-tool', { command: `cat ${legacyPath}` });
  assert.match(legacy.hookSpecificOutput.additionalContext, /read-only legacy RIFF/);
});

test('loop mode follows dependencies by priority and permits only hard blocker kinds', () => {
  const root = fixture();
  runCli(root, 'init', '--project-root', root, '--non-interactive');
  const phase = (id, priority, status = 'ready', depends_on = []) => ({
    id,
    title: id,
    outcome: id,
    demo: '',
    priority,
    depends_on,
    blocking_edges: [],
    risks: [],
    sensitive: false,
    status,
    commit: null,
    attempts: 0,
    reason: null,
    blockerKind: null,
  });
  writeJson(path.join(root, '.riff-codex-state', 'state.json'), baseState([
    phase('low-ready', 'P2'),
    phase('blocked-p0', 'P0', 'ready', ['dependency']),
    phase('high-ready', 'P1', 'ready', ['completed-dependency']),
    phase('dependency', 'P3'),
    phase('completed-dependency', 'P3', 'completed'),
  ]));

  assert.equal(JSON.parse(runCli(root, 'wave', 'select')).id, 'high-ready');
  runCli(root, 'wave', 'activate', 'high-ready');
  assert.match(
    runCliFailure(root, 'wave', 'await', 'high-ready', '--reason', 'Need a product decision'),
    /loop mode may stop only with --kind/,
  );
  assert.match(
    runCliFailure(root, 'wave', 'park', 'high-ready', '--kind', 'validation-failure', '--reason', 'No evidence'),
    /requires a recorded failed validation or review/,
  );

  runCli(root, 'wave', 'await', 'high-ready', '--kind', 'credentials-or-access', '--reason', 'Production token is missing');
  let state = JSON.parse(readFileSync(path.join(root, '.riff-codex-state', 'state.json'), 'utf8'));
  assert.deepEqual(state.humanAction, {
    phase: 'high-ready',
    status: 'awaiting_human',
    kind: 'credentials-or-access',
    reason: 'Production token is missing',
  });

  runCli(root, 'wave', 'resume', 'high-ready', '--reason', 'Production token is available');
  state = JSON.parse(readFileSync(path.join(root, '.riff-codex-state', 'state.json'), 'utf8'));
  assert.equal(state.phases.find((item) => item.id === 'high-ready').status, 'active');
  assert.equal(state.phases.find((item) => item.id === 'high-ready').blockerKind, null);
  assert.equal(state.humanAction, null);

  writeJson(path.join(root, '.riff-codex-state', 'state.json'), baseState([
    phase('cycle-a', 'P1', 'ready', ['cycle-b']),
    phase('cycle-b', 'P1', 'ready', ['cycle-a']),
  ]));
  assert.match(runCliFailure(root, 'wave', 'select'), /dependency cycle detected/);
});

test('guided mode preserves product decision handoffs without blocker kinds', () => {
  const root = fixture();
  runCli(root, 'init', '--project-root', root, '--non-interactive', '--autonomy', 'guided');
  const config = JSON.parse(readFileSync(path.join(root, '.riff-codex-state', 'config.json'), 'utf8'));
  assert.equal(config.preferences.autonomy, 'guided');
  const active = {
    id: 'guided-phase',
    title: 'Guided phase',
    outcome: 'Confirm a product choice',
    demo: '',
    priority: 'P1',
    depends_on: [],
    blocking_edges: [],
    risks: [],
    sensitive: false,
    status: 'active',
    commit: null,
    attempts: 0,
    reason: null,
  };
  writeJson(path.join(root, '.riff-codex-state', 'state.json'), {
    ...baseState([active]),
    activeWave: { phase: active.id, startedAt: '2026-01-01T00:00:00.000Z', checkpointAt: '2026-01-01T00:00:00.000Z' },
  });

  runCli(root, 'wave', 'await', active.id, '--reason', 'Choose the product direction');
  const state = JSON.parse(readFileSync(path.join(root, '.riff-codex-state', 'state.json'), 'utf8'));
  assert.equal(state.phases[0].status, 'awaiting_human');
  assert.equal(state.humanAction.kind, null);
  assert.equal(state.humanAction.reason, 'Choose the product direction');
});

function lifecycleFixture(scope = 'production') {
  const root = fixture();
  writeFileSync(path.join(root, '.gitignore'), '.riff-codex\n.agents/\n.codex/\n.home/\n');
  writeFileSync(path.join(root, 'README.md'), '# Fixture\n');
  execFileSync('git', ['add', '--', '.gitignore', 'README.md'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Fixture baseline'], { cwd: root });
  runCli(root, 'init', '--project-root', root, '--non-interactive', '--scope', scope);
  return root;
}
function roadmapFixture(root, phases) {
  writeJson(path.join(root, 'ROADMAP.yaml'), { version: 1, project: { name: 'Fixture' }, phases });
  runCli(root, 'wave', 'sync');
}
const fixturePhase = (id, priority = 'P2', depends_on = []) => ({ id, title: id, outcome: 'Visible result', priority, depends_on });
function proofFile(root, type, candidate, status = 'pass') {
  const file = path.join(root, '.riff-codex-state', `${type}-review.json`);
  writeJson(file, { version: 1, candidate, type, status, reviewer: { id: 'fresh-test-reviewer', independent: true }, evidence: ['README.md:1 inspected'], findings: [] });
  return file;
}

test('installation preflight protects shared directories and preserves linked hook sources', () => {
  const container = fixture();
  const outside = path.join(container, 'shared');
  mkdirSync(outside);
  for (const mode of ['absolute', 'relative', 'directory-link', 'dangling']) {
    const root = path.join(container, mode);
    mkdirSync(root); execFileSync('git', ['init', '-q'], { cwd: root });
    if (mode === 'absolute' || mode === 'relative') execFileSync('git', ['config', 'core.hooksPath', mode === 'absolute' ? outside : '../shared'], { cwd: root });
    if (mode === 'directory-link') { symlinkSync(outside, path.join(root, 'hooks')); execFileSync('git', ['config', 'core.hooksPath', 'hooks'], { cwd: root }); }
    if (mode === 'dangling') symlinkSync(path.join(outside, 'missing'), path.join(root, '.git/hooks/pre-commit'));
    assert.match(runCliFailure(root, 'init', '--project-root', root, '--non-interactive'), /outside|symlink|regular file/);
    assert.equal(existsSync(path.join(root, '.riff-codex')), false, 'preflight must precede installation writes');
  }
  const root = path.join(container, 'linked'); mkdirSync(root); execFileSync('git', ['init', '-q'], { cwd: root });
  const foreign = path.join(outside, 'foreign.sh');
  const bytes = '#!/bin/sh\nprintf chained > .foreign-ran\n';
  writeFileSync(foreign, bytes); chmodSync(foreign, 0o755);
  symlinkSync(foreign, path.join(root, '.git/hooks/pre-commit'));
  runCli(root, 'init', '--project-root', root, '--non-interactive');
  assert.equal(readFileSync(foreign, 'utf8'), bytes);
  assert.equal(lstatSync(path.join(root, '.git/hooks/pre-commit')).isSymbolicLink(), false);
  execFileSync(path.join(root, '.git/hooks/pre-commit'), { cwd: root });
  assert.equal(readFileSync(path.join(root, '.foreign-ran'), 'utf8'), 'chained');
});

test('phase completion requires executed scoped validation and intact independent review evidence', () => {
  const root = lifecycleFixture();
  roadmapFixture(root, [fixturePhase('a'), fixturePhase('b', 'P2', ['a'])]);
  runCli(root, 'wave', 'activate', 'a');
  assert.match(runCliFailure(root, 'wave', 'complete', 'b', '--commit', 'HEAD'), /active with completed dependencies/);
  assert.match(runCliFailure(root, 'wave', 'complete', 'a', '--commit', 'HEAD'), /executed validation/);
  runCli(root, 'wave', 'validate', 'a', '--status', 'pass', '--command', 'not-executed', '--summary', 'Declaration');
  assert.match(runCliFailure(root, 'wave', 'complete', 'a', '--commit', 'HEAD'), /executed validation/);
  execFileSync('git', ['add', '--', 'ROADMAP.yaml'], { cwd: root });
  assert.match(runCliFailure(root, 'wave', 'validate', 'a', '--run', '--command', '["node","-e","process.exit(1)"]', '--paths', '["ROADMAP.yaml"]'), /Validation fail/);
  assert.match(runCliFailure(root, 'wave', 'review', 'a', '--type', 'functional', '--status', 'pass', '--summary', 'Review'), /executed validation/);
  assert.match(runCliFailure(root, 'wave', 'validate', 'a', '--run', '--command', '["node","-e","process.exit(0)"]', '--paths', '["README.md"]'), /exceeds declared scope/);
  const result = runCli(root, 'wave', 'validate', 'a', '--run', '--command', JSON.stringify(['node', '-e', 'console.log("observed pass")']), '--paths', '["ROADMAP.yaml"]');
  assert.match(result, /Report: .*report.html/);
  const candidate = execFileSync('git', ['write-tree'], { cwd: root, encoding: 'utf8' }).trim();
  assert.match(runCliFailure(root, 'wave', 'validate', 'a', '--run', '--command', 'bad-json'), /JSON|Unexpected token/);
  const proof = proofFile(root, 'functional', candidate);
  const validProof = readFileSync(proof, 'utf8');
  writeJson(proof, { ...JSON.parse(validProof), reviewer: { id: true, independent: true } });
  assert.match(runCliFailure(root, 'wave', 'review', 'a', '--type', 'functional', '--status', 'pass', '--summary', 'Invalid identity', '--evidence', proof), /review artifact needs/);
  writeFileSync(proof, validProof);
  const reportPath = result.split('Report: ')[1].trim();
  const reportBytes = readFileSync(reportPath);
  writeFileSync(reportPath, 'changed report');
  assert.match(runCliFailure(root, 'wave', 'review', 'a', '--type', 'functional', '--status', 'pass', '--summary', 'Report changed', '--evidence', proof), /report is missing or changed/);
  writeFileSync(reportPath, reportBytes);
  runCli(root, 'wave', 'review', 'a', '--type', 'functional', '--status', 'pass', '--summary', 'Reviewed behavior', '--evidence', proof);
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Verified phase'], { cwd: root });
  assert.match(runCli(root, 'wave', 'complete', 'a', '--commit', 'HEAD'), /a completed/);
  assert.match(runCli(root, 'wave', 'complete', 'a', '--commit', 'HEAD'), /already completed/);
  assert.equal(JSON.parse(runCli(root, 'wave', 'select')).id, 'b');
});

test('state synchronization, locking and displayed priorities preserve lifecycle invariants', () => {
  const root = lifecycleFixture();
  const phases = [fixturePhase('low', 'P3'), fixturePhase('urgent', 'P0')];
  roadmapFixture(root, phases);
  assert.equal(JSON.parse(runCli(root, 'wave', 'select')).id, 'urgent');
  assert.match(runCli(root, 'status'), /Next: urgent/);
  const lock = path.join(root, '.riff-codex-state/write.lock');
  writeJson(lock, { pid: process.pid });
  assert.match(runCliFailure(root, 'wave', 'sync'), /busy/);
  rmSync(lock);
  for (const file of [path.join(root, '.git/riff-codex-install.lock'), path.join(root, '.home/.config/riff-dashboard/registry.json.lock')]) {
    writeJson(file, { pid: process.pid });
    assert.match(runCliFailure(root, 'resync'), /busy/);
    rmSync(file);
  }
  runCli(root, 'wave', 'activate', 'urgent');
  writeJson(path.join(root, 'ROADMAP.yaml'), { version: 1, project: {}, phases: [phases[0]] });
  assert.match(runCliFailure(root, 'wave', 'sync'), /cannot remove referenced phase urgent/);
  assert.match(runCli(root, 'status'), /Active: urgent/);
  writeJson(path.join(root, 'ROADMAP.yaml'), { version: 1, project: {}, phases: [fixturePhase('../../outside')] });
  assert.match(runCliFailure(root, 'wave', 'sync'), /invalid phase id/);
});

test('verification report embeds real image bytes, escapes content and rejects stale or missing evidence', () => {
  const root = lifecycleFixture();
  const candidate = execFileSync('git', ['write-tree'], { cwd: root, encoding: 'utf8' }).trim();
  const image = path.join(root, '.riff-codex-state/screen.png');
  writeFileSync(image, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4E8AAAAASUVORK5CYII=', 'base64'));
  const file = path.join(root, '.riff-codex-state/verification.json');
  const manifest = { version: 1, candidate, title: 'Report <script>alert(1)</script>', steps: [{ name: 'Visual example', status: 'pass', observed: 'Fixture image attached', screenshot: image, viewport: '320 × 600' }, { name: 'External check', status: 'unverified', observed: 'Access unavailable' }] };
  writeJson(file, manifest);
  const output = runCli(root, 'report', '--evidence', file);
  assert.match(output, /UNVERIFIED/);
  const html = readFileSync(output.split('\n')[0], 'utf8');
  assert.match(html, /data:image\/png;base64/);
  assert.match(html, /1 unverified/);
  assert.equal(html.includes('<script>alert'), false);
  writeJson(file, { ...manifest, candidate: 'stale' });
  assert.match(runCliFailure(root, 'report', '--evidence', file), /current candidate/);
  writeJson(file, { ...manifest, steps: [{ ...manifest.steps[0], screenshot: 'missing.png' }] });
  assert.match(runCliFailure(root, 'report', '--evidence', file), /ENOENT/);
});

test('production promotion requires reviews and incident capture remains append-only and idempotent', () => {
  const root = lifecycleFixture('scratch');
  roadmapFixture(root, []);
  writeFileSync(path.join(root, 'PROJECT.md'), '# Project\nReal production boundaries.\n');
  writeFileSync(path.join(root, 'taste.md'), '# Taste\nPreserve user data.\n');
  execFileSync('git', ['add', '--', 'PROJECT.md', 'ROADMAP.yaml', 'taste.md'], { cwd: root });
  assert.match(runCliFailure(root, 'init', '--project-root', root, '--non-interactive', '--scope', 'production'), /use promote/);
  assert.match(runCliFailure(root, 'promote', '--apply'), /architecture is required/);
  const candidate = execFileSync('git', ['write-tree'], { cwd: root, encoding: 'utf8' }).trim();
  const architecture = proofFile(root, 'architecture', candidate);
  const roadmap = proofFile(root, 'roadmap', candidate);
  const functional = proofFile(root, 'functional', candidate);
  assert.match(runCliFailure(root, 'promote', '--apply', '--architecture', architecture, '--roadmap', roadmap), /functional is required/);
  assert.match(runCli(root, 'promote', '--apply', '--architecture', architecture, '--roadmap', roadmap, '--functional', functional), /Scope promoted/);
  const file = path.join(root, '.riff-codex-state/incident.json');
  writeJson(file, { id: 'incident-1', title: 'Fixture incident', severity: 'low', impact: 'Observed interruption', rootCause: 'Test condition', prevention: 'Regression check' });
  runCli(root, 'incident', 'log', '--evidence', file);
  const before = readFileSync(path.join(root, 'INCIDENTS.md'), 'utf8');
  runCli(root, 'incident', 'log', '--evidence', file);
  assert.equal(readFileSync(path.join(root, 'INCIDENTS.md'), 'utf8'), before);
  assert.match(runCliFailure(root, 'finish', '--check'), /pending project changes/);
  execFileSync('git', ['add', '--', 'INCIDENTS.md'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Production records'], { cwd: root });
  assert.match(runCli(root, 'finish', '--check'), /Ready for explicit Git finalization/);
});

test('resume reconciles an interrupted verified commit once and preserves dirty work', () => {
  const root = lifecycleFixture();
  roadmapFixture(root, [fixturePhase('recover')]);
  runCli(root, 'wave', 'activate', 'recover');
  execFileSync('git', ['add', '--', 'ROADMAP.yaml'], { cwd: root });
  runCli(root, 'wave', 'validate', 'recover', '--run', '--command', '["node","-e","process.exit(0)"]', '--paths', '["ROADMAP.yaml"]');
  const candidate = execFileSync('git', ['write-tree'], { cwd: root, encoding: 'utf8' }).trim();
  runCli(root, 'wave', 'review', 'recover', '--type', 'functional', '--status', 'pass', '--summary', 'Observed fixture', '--evidence', proofFile(root, 'functional', candidate));
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Interrupted delivery'], { cwd: root });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const readState = () => JSON.parse(readFileSync(path.join(root, '.riff-codex-state/state.json')));
  writeFileSync(path.join(root, 'README.md'), 'unfinished work\n');
  assert.match(runCli(root, 'wave', 'resume'), /preserved working tree/);
  assert.equal(readState().phases[0].status, 'active');
  assert.equal(readFileSync(path.join(root, 'README.md'), 'utf8'), 'unfinished work\n');
  writeFileSync(path.join(root, 'README.md'), '# Fixture\n');
  const report = path.join(root, readState().phases[0].validation.verification.path);
  const bytes = readFileSync(report);
  writeFileSync(report, 'tampered');
  assert.match(runCli(root, 'wave', 'resume'), /report is missing or changed/);
  assert.equal(readState().phases[0].status, 'active');
  writeFileSync(report, bytes);
  assert.match(runCli(root, 'wave', 'resume'), /recover completed/);
  assert.match(runCli(root, 'wave', 'resume'), /Roadmap complete/);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }), commit);
});

test('legacy smoke requirement uses existing journey evidence instead of accepting command-only checks', () => {
  const root = lifecycleFixture();
  roadmapFixture(root, [{ ...fixturePhase('smoke'), smoke_test: true }]);
  runCli(root, 'wave', 'activate', 'smoke');
  execFileSync('git', ['add', '--', 'ROADMAP.yaml'], { cwd: root });
  const args = ['wave', 'validate', 'smoke', '--run', '--command', '["node","-e","process.exit(0)"]', '--paths', '["ROADMAP.yaml"]'];
  assert.match(runCliFailure(root, ...args), /Validation fail/);
  const candidate = execFileSync('git', ['write-tree'], { cwd: root, encoding: 'utf8' }).trim();
  const evidence = path.join(root, '.riff-codex-state/smoke.json');
  writeJson(evidence, { version: 1, candidate, steps: [{ name: 'Essential journey', kind: 'browser', status: 'pass', observed: 'Confirmation visible after submitting', url: 'http://localhost:3000' }] });
  assert.match(runCli(root, ...args, '--verification', evidence), /Validation pass/);
});
