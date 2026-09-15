import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(REPOSITORY, 'riff', 'bin', 'riff.mjs');
const roots = [];

function fixture() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'riff-evolve-sync-test-')));
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

function stateFile(root) {
  return path.join(root, '.riff-codex-state', 'state.json');
}

test.after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

test('rejects protected plan drift and removal of referenced history without rewriting state', () => {
  const root = fixture();
  runCli(root, 'init', '--project-root', root, '--non-interactive');
  writeFileSync(path.join(root, 'ROADMAP.yaml'), `version: 1
project:
  name: Protected
  objective: Preserve execution history
phases:
  - id: active
    title: Active phase
    outcome: Active outcome
    priority: P1
    smoke_test: true
    status: active
    depends_on: []
  - id: completed
    title: Completed phase
    outcome: Completed outcome
    priority: P2
    status: completed
    depends_on: []
  - id: referenced
    title: Referenced phase
    outcome: Pending outcome
    priority: P3
    status: ready
    depends_on: []
`);
  runCli(root, 'wave', 'sync');

  const state = JSON.parse(readFileSync(stateFile(root), 'utf8'));
  state.activeWave = { phase: 'active', startedAt: '2026-01-01T00:00:00.000Z', checkpointAt: '2026-01-01T00:01:00.000Z' };
  state.reviews.functional = { phase: 'referenced', status: 'pass', candidate: 'tree' };
  state.phases.find((phase) => phase.id === 'active').checkpoint = { candidate: 'tree', summary: 'Saved work', next: 'Continue' };
  state.phases.find((phase) => phase.id === 'completed').commit = 'completed-commit';
  state.phases.find((phase) => phase.id === 'completed').validation = { phase: 'completed', status: 'pass', candidate: 'tree', evidence: { path: 'evidence.json', hash: 'hash' } };
  state.phases.find((phase) => phase.id === 'referenced').attempts = 1;
  writeJson(stateFile(root), state);
  writeJson(path.join(root, '.riff-codex-state', 'receipts', 'referenced-functional.json'), { phase: 'referenced', status: 'pass', candidate: 'tree' });

  const beforeDrift = readFileSync(stateFile(root));
  writeFileSync(path.join(root, 'ROADMAP.yaml'), `version: 1
project:
  name: Protected
  objective: Preserve execution history
phases:
  - id: active
    title: Active phase
    outcome: Changed active outcome
    priority: P1
    status: ready
    depends_on: []
  - id: completed
    title: Completed phase
    outcome: Completed outcome
    priority: P2
    status: ready
  - id: referenced
    title: Referenced phase
    outcome: Pending outcome
    priority: P3
    status: ready
    depends_on: []
`);
  assert.match(runCliFailure(root, 'wave', 'sync'), /cannot change normalized plan fields for active phase active: outcome/);
  assert.deepEqual(readFileSync(stateFile(root)), beforeDrift);

  const beforeVerificationDrift = readFileSync(stateFile(root));
  writeFileSync(path.join(root, 'ROADMAP.yaml'), `version: 1
project:
  name: Protected
  objective: Preserve execution history
phases:
  - id: active
    title: Active phase
    outcome: Active outcome
    priority: P1
    status: ready
    depends_on: []
  - id: completed
    title: Completed phase
    outcome: Completed outcome
    priority: P2
    status: ready
  - id: referenced
    title: Referenced phase
    outcome: Pending outcome
    priority: P3
    status: ready
    depends_on: []
`);
  assert.match(runCliFailure(root, 'wave', 'sync'), /cannot change normalized plan fields for active phase active: verificationRequired/);
  assert.deepEqual(readFileSync(stateFile(root)), beforeVerificationDrift);

  const beforeTerminalDrift = readFileSync(stateFile(root));
  writeFileSync(path.join(root, 'ROADMAP.yaml'), `version: 1
project:
  name: Protected
  objective: Preserve execution history
phases:
  - id: active
    title: Active phase
    outcome: Active outcome
    priority: P1
    smoke_test: true
    status: ready
    depends_on: []
  - id: completed
    title: Changed completed title
    outcome: Completed outcome
    priority: P2
    status: ready
  - id: referenced
    title: Referenced phase
    outcome: Pending outcome
    priority: P3
    status: ready
    depends_on: []
`);
  assert.match(runCliFailure(root, 'wave', 'sync'), /cannot change normalized plan fields for completed phase completed: title/);
  assert.deepEqual(readFileSync(stateFile(root)), beforeTerminalDrift);

  const currentState = JSON.parse(readFileSync(stateFile(root), 'utf8'));
  currentState.reviews.functional = null;
  writeJson(stateFile(root), currentState);
  unlinkSync(path.join(root, '.riff-codex-state', 'receipts', 'referenced-functional.json'));
  const beforeRemoval = readFileSync(stateFile(root));
  writeFileSync(path.join(root, 'ROADMAP.yaml'), `version: 1
project:
  name: Protected
  objective: Preserve execution history
phases:
  - id: active
    title: Active phase
    outcome: Active outcome
    priority: P1
    smoke_test: true
    status: ready
    depends_on: []
  - id: completed
    title: Completed phase
    outcome: Completed outcome
    priority: P2
    status: ready
    depends_on: []
`);
  assert.match(runCliFailure(root, 'wave', 'sync'), /cannot remove referenced phase referenced/);
  assert.deepEqual(readFileSync(stateFile(root)), beforeRemoval);

  const receiptState = JSON.parse(readFileSync(stateFile(root), 'utf8'));
  receiptState.phases.find((phase) => phase.id === 'referenced').attempts = 0;
  writeJson(stateFile(root), receiptState);
  writeJson(path.join(root, '.riff-codex-state', 'receipts', 'referenced-functional.json'), { phase: 'referenced', status: 'pass', candidate: 'tree' });
  const beforeReceiptRemoval = readFileSync(stateFile(root));
  assert.match(runCliFailure(root, 'wave', 'sync'), /cannot remove referenced phase referenced/);
  assert.deepEqual(readFileSync(stateFile(root)), beforeReceiptRemoval);
});

test('revises and replaces pending Claude phases while preserving unknown roadmap fields and receipts', () => {
  const root = fixture();
  runCli(root, 'init', '--project-root', root, '--non-interactive');
  const initialRoadmap = `# keep this comment
name: Shared roadmap
description: Preserve complete receipts
unknown_root: keep-me
phase-done:
  name: Done
  description: Delivered result
  status: done
  custom_phase: preserve-me
phase-pending:
  title: Pending
  goal: Pending result
  status: todo
`;
  writeFileSync(path.join(root, 'ROADMAP.yaml'), initialRoadmap);
  runCli(root, 'wave', 'sync');

  const receipt = { phase: 'done', type: 'functional', status: 'pass', candidate: 'completed-tree', unknown: { keep: true } };
  const receiptFile = path.join(root, '.riff-codex-state', 'receipts', 'done-functional.json');
  writeJson(receiptFile, receipt);
  const state = JSON.parse(readFileSync(stateFile(root), 'utf8'));
  const completed = state.phases.find((phase) => phase.id === 'done');
  completed.commit = 'completed-commit';
  state.reviews.functional = { ...receipt, evidence: { path: '.riff-codex-state/receipts/done-functional.json', hash: 'fixture' } };
  writeJson(stateFile(root), state);
  const receiptBytes = readFileSync(receiptFile);

  const revisedRoadmap = `# keep this comment
name: Shared roadmap
description: Preserve complete receipts
unknown_root: keep-me
phase-done:
  name: Done
  description: Delivered result
  status: todo
  custom_phase: preserve-me
phase-pending:
  title: Revised pending
  goal: Revised result
  status: done
phase-replacement:
  title: Replacement
  goal: Replacement result
  status: todo
  depends_on: [phase-done]
  unknown_phase: keep-me
`;
  writeFileSync(path.join(root, 'ROADMAP.yaml'), revisedRoadmap);
  runCli(root, 'wave', 'sync');
  assert.equal(readFileSync(path.join(root, 'ROADMAP.yaml'), 'utf8'), revisedRoadmap);
  let synced = JSON.parse(readFileSync(stateFile(root), 'utf8'));
  assert.equal(synced.phases.find((phase) => phase.id === 'done').status, 'completed');
  assert.equal(synced.phases.find((phase) => phase.id === 'done').commit, 'completed-commit');
  assert.equal(synced.phases.find((phase) => phase.id === 'pending').status, 'ready');
  assert.equal(synced.phases.find((phase) => phase.id === 'pending').title, 'Revised pending');
  assert.deepEqual(synced.phases.find((phase) => phase.id === 'replacement').depends_on, ['done']);
  assert.deepEqual(synced.reviews.functional, state.reviews.functional);
  assert.deepEqual(readFileSync(receiptFile), receiptBytes);

  const replacementRoadmap = `# keep this comment
name: Shared roadmap
description: Preserve complete receipts
unknown_root: keep-me
phase-done:
  name: Done
  description: Delivered result
  status: todo
  custom_phase: preserve-me
phase-replacement:
  title: Replacement
  goal: Replacement result
  status: todo
  depends_on: [phase-done]
  unknown_phase: keep-me
`;
  writeFileSync(path.join(root, 'ROADMAP.yaml'), replacementRoadmap);
  runCli(root, 'wave', 'sync');
  synced = JSON.parse(readFileSync(stateFile(root), 'utf8'));
  assert.deepEqual(synced.phases.map(({ id, status }) => ({ id, status })), [
    { id: 'done', status: 'completed' },
    { id: 'replacement', status: 'ready' },
  ]);
  assert.deepEqual(synced.reviews.functional, state.reviews.functional);
  assert.deepEqual(readFileSync(receiptFile), receiptBytes);
});
