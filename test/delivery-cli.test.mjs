import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const CLI = fileURLToPath(new URL('../riff/bin/riff.mjs', import.meta.url));
const roots = [];
const areas = ['product', 'stories', 'journeys', 'wireframes', 'design', 'data', 'architecture', 'verification', 'risks', 'roadmap', 'decisions', 'diagrams'];
const read = (root, file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
function write(root, file, value) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
}
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
function cli(root, ...args) {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8',
    env: { ...process.env, HOME: path.join(root, '.fixture-home'), CODEX_HOME: path.join(root, '.fixture-home/.codex') } });
  return { status: result.status, text: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}
function ok(root, ...args) {
  const result = cli(root, ...args);
  assert.equal(result.status, 0, result.text);
  return result.text;
}
function rejected(root, pattern, ...args) {
  const result = cli(root, ...args);
  assert.notEqual(result.status, 0, result.text);
  assert.match(result.text, pattern);
}
function commit(root, message = 'Fixture change') {
  git(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', message);
}
function proof(root, type, candidate, status = 'pass') {
  const file = `.riff-codex-state/${type}-input.json`;
  write(root, file, { version: 1, candidate, type, status,
    reviewer: { id: 'independent-fixture-reviewer', independent: true },
    evidence: ['Fixture lifecycle assertion observed by the test runner.'], findings: [] });
  return file;
}
function enroll(root) {
  write(root, 'docs/specs/readiness.json', { version: 1,
    areas: Object.fromEntries(areas.map((area) => [area, { files: ['PROJECT.md'] }])) });
  const snapshot = JSON.parse(ok(root, 'discovery', 'snapshot'));
  ok(root, 'discovery', 'review', '--evidence', proof(root, 'discovery', snapshot.digest));
  ok(root, 'discovery', 'check');
  return snapshot;
}
function fixture({ enrolled = true, phases = ['a'], unborn = false } = {}) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'riff-delivery-cli-')));
  roots.push(root);
  git(root, 'init', '-q');
  write(root, '.gitignore', '.fixture-home/\n.riff-codex\n.agents/\n.codex/\n');
  write(root, 'README.md', 'baseline\n');
  write(root, 'PROJECT.md', 'Fixture contract\n');
  write(root, 'taste.md', 'Fixture conventions\n');
  write(root, 'ROADMAP.yaml', { version: 1, project: { name: 'Fixture' }, phases: phases.map((id, index) => ({
    id, title: `Fixture ${id}`, outcome: 'Visible fixture outcome', priority: 'P2', depends_on: index ? [phases[index - 1]] : [],
  })) });
  git(root, 'add', '--', '.gitignore', 'README.md', 'PROJECT.md', 'taste.md', 'ROADMAP.yaml');
  if (!unborn) commit(root, 'Baseline');
  ok(root, 'init', '--project-root', root, '--non-interactive');
  ok(root, 'wave', 'sync');
  if (enrolled) {
    enroll(root);
    git(root, 'add', '--', 'docs/specs/readiness.json');
    if (!unborn) commit(root, 'Dossier');
  }
  return root;
}
function validate(root, id = 'a') {
  return ok(root, 'wave', 'validate', id, '--run', '--command', JSON.stringify([process.execPath, '-e',
    'require("node:assert/strict").match(require("node:fs").readFileSync("README.md", "utf8"), /feature/)']), '--paths', '["README.md"]');
}
function candidate(root) {
  write(root, 'README.md', 'feature\n');
  git(root, 'add', '--', 'README.md');
  validate(root);
  const tree = git(root, 'write-tree');
  ok(root, 'wave', 'review', 'a', '--type', 'functional', '--status', 'pass', '--summary', 'Fixture behavior verified', '--evidence', proof(root, 'functional', tree));
  return tree;
}
function checkpoint(root) {
  ok(root, 'wave', 'checkpoint', 'a', '--summary', 'Fixture feature verified', '--next', 'Consult ROADMAP.yaml and verify delivery');
}
function injectFinding(root, severity = 'LOW') {
  // Deliberately seed test state, never a real consumer's state.
  const state = read(root, '.riff-codex-state/state.json');
  state.securityFindings.push({ kind: 'fixture-warning', severity, summary: 'Synthetic lifecycle warning', phase: 'a', reviewedAt: new Date().toISOString() });
  write(root, '.riff-codex-state/state.json', state);
  return JSON.parse(ok(root, 'observations', 'list')).find((item) => item.kind === 'fixture-warning');
}
test.after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

test('discovery enrollment gates activation, preserves review on snapshot, and invalidates changed or removed contracts', () => {
  const unborn = fixture({ unborn: true });
  ok(unborn, 'wave', 'activate', 'a');
  checkpoint(unborn);
  assert.equal(JSON.parse(ok(unborn, 'wave', 'context', 'a')).checkpoint.head, null);
  const legacy = fixture({ enrolled: false });
  ok(legacy, 'wave', 'activate', 'a');
  const root = fixture();
  const review = read(root, '.riff-codex-state/state.json').discovery.review;
  ok(root, 'discovery', 'snapshot');
  assert.deepEqual(read(root, '.riff-codex-state/state.json').discovery.review, review);
  ok(root, 'discovery', 'check');
  write(root, 'taste.md', 'Revised conventions\n');
  rejected(root, /stale/, 'wave', 'activate', 'a');
  const snapshot = JSON.parse(ok(root, 'discovery', 'snapshot'));
  rejected(root, /review/, 'discovery', 'check');
  ok(root, 'discovery', 'review', '--evidence', proof(root, 'discovery', snapshot.digest));
  ok(root, 'wave', 'activate', 'a');
  ok(root, 'wave', 'block', 'a', '--kind', 'credentials-or-access', '--reason', 'Synthetic missing fixture access');
  rmSync(path.join(root, 'docs/specs/readiness.json'));
  rejected(root, /discovery|missing/, 'wave', 'resume', 'a', '--reason', 'Access recovered');
});

test('enrolled completion needs a current checkpoint and explicit observation handling; final verification accounts for new warnings', () => {
  const root = fixture();
  ok(root, 'wave', 'activate', 'a');
  const tree = candidate(root);
  commit(root);
  rejected(root, /checkpoint/, 'wave', 'complete', 'a', '--commit', 'HEAD');
  checkpoint(root);
  const context = JSON.parse(ok(root, 'wave', 'context', 'a'));
  assert.equal(context.checkpoint.candidate, tree);
  assert.equal(context.checkpointStale, false);
  const warning = injectFinding(root, 'HIGH');
  rejected(root, /HIGH.*blocks/, 'wave', 'complete', 'a', '--commit', 'HEAD');
  ok(root, 'observations', 'review', '--id', warning.id, '--revision', warning.revision, '--status', 'false_positive', '--note', 'Synthetic fixture injection, not a real code defect.');
  ok(root, 'wave', 'complete', 'a', '--commit', 'HEAD');
  rejected(root, /delivery review/, 'finish', '--check');
  write(root, '.riff-codex-state/write.lock', { pid: process.pid });
  rejected(root, /busy/, 'finish', '--review', proof(root, 'delivery', tree));
  rmSync(path.join(root, '.riff-codex-state/write.lock'));
  ok(root, 'finish', '--review', proof(root, 'delivery', tree));
  ok(root, 'finish', '--check');
  const later = injectFinding(root);
  rejected(root, /observation/, 'finish', '--check');
  ok(root, 'observations', 'review', '--id', later.id, '--revision', later.revision, '--status', 'false_positive', '--note', 'Synthetic final verification fixture, no production defect.');
  ok(root, 'finish', '--check');
  write(root, 'README.md', 'feature corrected\n');
  git(root, 'add', '--', 'README.md');
  commit(root);
  rejected(root, /delivery review/, 'finish', '--check');
});

test('nonblocking observations require a literal unfinished follow-up phase, and checkpoints become stale on edits', () => {
  const root = fixture({ phases: ['a', 'phase.follow-up'] });
  ok(root, 'wave', 'activate', 'a');
  candidate(root);
  checkpoint(root);
  assert.equal(JSON.parse(ok(root, 'wave', 'context', 'a')).checkpointStale, false, 'staging alone must not stale the checkpoint');
  write(root, 'README.md', 'feature changed\n');
  assert.equal(JSON.parse(ok(root, 'wave', 'context', 'a')).checkpointStale, true);
  git(root, 'add', '--', 'README.md');
  validate(root);
  const tree = git(root, 'write-tree');
  ok(root, 'wave', 'review', 'a', '--type', 'functional', '--status', 'pass', '--summary', 'Updated fixture', '--evidence', proof(root, 'functional', tree));
  commit(root);
  rejected(root, /checkpoint/, 'wave', 'complete', 'a', '--commit', 'HEAD');
  checkpoint(root);
  const warning = injectFinding(root);
  ok(root, 'observations', 'review', '--id', warning.id, '--revision', warning.revision, '--status', 'pending', '--note', 'Follow up in phaseXfollow-up because that phase owns the affected fixture.');
  rejected(root, /follow-up/, 'wave', 'complete', 'a', '--commit', 'HEAD');
  ok(root, 'observations', 'review', '--id', warning.id, '--revision', warning.revision, '--status', 'pending', '--note', 'Follow up in phase.follow-up because that phase owns the affected fixture.');
  ok(root, 'wave', 'complete', 'a', '--commit', 'HEAD');
});

test('failed unchanged attempts cannot turn into success through repeated review or recovery', () => {
  const root = fixture();
  const digest = JSON.parse(ok(root, 'discovery', 'snapshot')).digest;
  ok(root, 'discovery', 'review', '--evidence', proof(root, 'discovery', digest, 'fail'));
  rejected(root, /review/, 'discovery', 'check');
  ok(root, 'discovery', 'snapshot');
  rejected(root, /unchanged|failure/, 'discovery', 'review', '--evidence', proof(root, 'discovery', digest));
  write(root, 'PROJECT.md', 'Corrected fixture contract\n');
  enroll(root);
  git(root, 'add', '--', 'PROJECT.md');
  commit(root);
  ok(root, 'wave', 'activate', 'a');
  write(root, 'README.md', 'feature\n');
  git(root, 'add', '--', 'README.md');
  const failCommand = JSON.stringify([process.execPath, '-e', 'process.exit(1)']);
  rejected(root, /Validation fail/, 'wave', 'validate', 'a', '--run', '--command', failCommand, '--paths', '["README.md"]');
  rejected(root, /unchanged/, 'wave', 'validate', 'a', '--run', '--command', JSON.stringify([process.execPath, '-e', 'process.exit(0)']), '--paths', '["README.md"]');
  rejected(root, /unchanged/, 'wave', 'validate', 'a', '--status', 'pass', '--command', 'declaration', '--summary', 'Attempted reset');
  write(root, 'README.md', 'feature fixed without retry\n');
  git(root, 'add', '--', 'README.md');
  rejected(root, /requires wave retry/, 'wave', 'validate', 'a', '--run', '--command', failCommand, '--paths', '["README.md"]');
  ok(root, 'wave', 'retry', 'a', '--reason', 'Correct fixture cause');
  checkpoint(root);
  ok(root, 'wave', 'resume');
  assert.equal(read(root, '.riff-codex-state/state.json').phases[0].attempts, 1);
  write(root, 'README.md', 'feature\n');
  git(root, 'add', '--', 'README.md');
  rejected(root, /unchanged|correction/, 'wave', 'validate', 'a', '--run', '--command', failCommand, '--paths', '["README.md"]');
  write(root, 'README.md', 'feature corrected\n');
  git(root, 'add', '--', 'README.md');
  validate(root);
  const tree = git(root, 'write-tree');
  ok(root, 'wave', 'review', 'a', '--type', 'functional', '--status', 'fail', '--summary', 'Synthetic review failure', '--evidence', proof(root, 'functional', tree, 'fail'));
  rejected(root, /unchanged|failure/, 'wave', 'review', 'a', '--type', 'functional', '--status', 'pass', '--summary', 'Unchanged review attempt', '--evidence', proof(root, 'functional', tree));
});
