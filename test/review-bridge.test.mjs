import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const CLI = fileURLToPath(new URL('../riff/bin/riff.mjs', import.meta.url));
const roots = [];
const areas = ['product', 'stories', 'journeys', 'wireframes', 'design', 'data', 'architecture', 'verification', 'risks', 'roadmap', 'decisions', 'diagrams'];
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
function write(root, file, value) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
}
const read = (root, file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));

// Fake reviewer CLIs: each model's behavior comes from fake-plan.json, every call is logged.
const FAKE = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const via = process.env.FAKE_VIA_OVERRIDE || path.basename(process.argv[1]).replace('fake-', '');
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log(via === 'codex' ? 'codex-cli 0.0.0-fake' : '0.0.0 (Claude Code fake)'); process.exit(0); }
if (args[0] === 'login') process.exit(0);
const dir = path.dirname(process.argv[1]);
const plan = JSON.parse(fs.readFileSync(path.join(dir, 'fake-plan.json'), 'utf8'));
const model = args[args.indexOf(via === 'codex' ? '-m' : '--model') + 1];
const prompt = fs.readFileSync(0, 'utf8');
fs.appendFileSync(path.join(dir, 'fake-calls.log'), via + ':' + model + ' ' + (prompt.includes('Review type: ') ? 'prompt-ok' : 'prompt-missing') + (prompt.includes('Already deferred to a human security expert') ? ' deferred' : '') + '\\n');
const behavior = plan[via + ':' + model] || 'pass';
if (behavior === 'quota') { console.error("ERROR: You've hit your usage limit."); process.exit(1); }
const verdicts = {
  pass: { status: 'pass', summary: 'Fake reviewer saw the outcome.', evidence: ['Read README.md and the staged diff.'], findings: [] },
  'pass-with-high': { status: 'pass', summary: 'Looks fine.', evidence: ['Read README.md.'], findings: [{ severity: 'HIGH', title: 'Missing authorization check', location: 'README.md:1', evidence: 'No check before write.', recommendation: 'Add the check.' }] },
};
const body = behavior === 'invalid' ? 'not json' : JSON.stringify(verdicts[behavior]);
if (via === 'codex') fs.writeFileSync(args[args.indexOf('-o') + 1], body);
else console.log(JSON.stringify({ is_error: false, result: body, structured_output: behavior === 'invalid' ? undefined : JSON.parse(body), modelUsage: { 'claude-opus-5-5': {} } }));
`;

function cli(root, env, ...args) {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...baseEnv(root), ...env } });
  return { status: result.status, text: `${result.stdout ?? ''}${result.stderr ?? ''}`, stdout: result.stdout };
}
function baseEnv(root) {
  return { HOME: path.join(root, '.fixture-home'), CODEX_HOME: path.join(root, '.fixture-home/.codex'), RIFF_IDEAS_FILE: path.join(root, '.fixture-home/ideas.ndjson'),
    RIFF_REVIEW_CODEX_BIN: path.join(root, '.fixture-home/fake-codex'), RIFF_REVIEW_CLAUDE_BIN: path.join(root, '.fixture-home/fake-claude'), CLAUDECODE: '1' };
}
function ok(root, ...args) {
  const result = cli(root, {}, ...args);
  assert.equal(result.status, 0, result.text);
  return result.stdout;
}
function rejected(root, pattern, ...args) {
  const result = cli(root, {}, ...args);
  assert.notEqual(result.status, 0, result.text);
  assert.match(result.text, pattern);
}
function plan(root, value) { write(root, '.fixture-home/fake-plan.json', value); }
const calls = (root) => { try { return readFileSync(path.join(root, '.fixture-home/fake-calls.log'), 'utf8').trim().split('\n').filter(Boolean); } catch { return []; } };
function review(root, ...args) { return JSON.parse(ok(root, 'review', 'run', ...args)); }
// Runs the record command exactly as the bridge printed it.
function record(root, command) {
  const result = spawnSync('sh', ['-c', command.replace(/^riff /, `"${process.execPath}" "${CLI}" `)], { cwd: root, encoding: 'utf8', env: { ...process.env, ...baseEnv(root) } });
  return { status: result.status, text: `${result.stdout}${result.stderr}` };
}
function commit(root, message = 'Fixture change') {
  git(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', message);
}
function fixture() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'riff-review-bridge-')));
  roots.push(root);
  git(root, 'init', '-q');
  for (const via of ['codex', 'claude']) { write(root, `.fixture-home/fake-${via}`, FAKE); chmodSync(path.join(root, `.fixture-home/fake-${via}`), 0o755); }
  plan(root, {});
  write(root, '.gitignore', '.fixture-home/\n.riff-codex\n.agents/\n.codex/\n.claude/\n');
  write(root, 'README.md', 'baseline\n');
  write(root, 'PROJECT.md', 'Fixture contract\n');
  write(root, 'taste.md', 'Fixture conventions\n');
  write(root, 'ROADMAP.yaml', { version: 1, project: { name: 'Fixture' }, phases: [{ id: 'a', title: 'Fixture a', outcome: 'README announces the feature', priority: 'P2', depends_on: [], done_when: ['README contains feature'] }] });
  git(root, 'add', '--', '.gitignore', 'README.md', 'PROJECT.md', 'taste.md', 'ROADMAP.yaml');
  commit(root, 'Baseline');
  ok(root, 'init', '--project-root', root, '--non-interactive');
  ok(root, 'wave', 'sync');
  return root;
}
function enroll(root) {
  write(root, 'docs/specs/readiness.json', { version: 1, areas: Object.fromEntries(areas.map((area) => [area, { files: ['PROJECT.md'] }])) });
  ok(root, 'discovery', 'snapshot');
}
function validatedCandidate(root) {
  ok(root, 'wave', 'activate', 'a');
  write(root, 'README.md', 'feature\n');
  git(root, 'add', '--', 'README.md');
  ok(root, 'wave', 'validate', 'a', '--run', '--command', JSON.stringify([process.execPath, '-e',
    'require("node:assert/strict").match(require("node:fs").readFileSync("README.md", "utf8"), /feature/)']), '--paths', '["README.md"]');
}
test.after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

test('a functional review from Astra produces an artifact the existing wave review command accepts', () => {
  const root = fixture();
  validatedCandidate(root);
  const result = review(root, '--type', 'functional');
  assert.equal(result.status, 'pass');
  assert.equal(result.reviewer.id, 'codex:gpt-6-astra@medium');
  assert.equal(result.reviewer.sameFamily, false);
  assert.equal(result.reviewer.cli, 'codex-cli 0.0.0-fake');
  assert.deepEqual(result.reviewer.skipped, []);
  assert.deepEqual(calls(root), ['codex:gpt-6-astra prompt-ok']);
  const recorded = record(root, result.record);
  assert.equal(recorded.status, 0, recorded.text);
  const receipt = read(root, '.riff-data/receipts/a-functional.json');
  assert.equal(receipt.reviewer.id, 'codex:gpt-6-astra@medium');
  assert.equal(receipt.model, 'codex:gpt-6-astra');
});

test('a blocking finding fails the review even when the model says pass, without falling back or parking the phase, and the unchanged candidate cannot be re-reviewed', () => {
  const root = fixture();
  plan(root, { 'codex:gpt-6-astra': 'pass-with-high' });
  validatedCandidate(root);
  const result = review(root, '--type', 'security');
  assert.equal(result.status, 'fail');
  assert.equal(result.reviewer.id, 'codex:gpt-6-astra@high');
  assert.deepEqual(result.reviewer.skipped, []);
  assert.equal(calls(root).length, 1);
  assert.match(result.record, /--severity HIGH --what-could-happen/);
  const recorded = record(root, result.record.replace(/'<[^']*>'/g, "'Fixture detail'"));
  assert.equal(recorded.status, 0, recorded.text);
  assert.equal(read(root, '.riff-data/state.json').phases[0].status, 'active');
  rejected(root, /failed on this unchanged candidate/, 'review', 'run', '--type', 'security');
  assert.equal(calls(root).length, 1);
});

test('an unavailable reviewer falls back visibly; malformed output gets one retry; an empty chain is an error', () => {
  const root = fixture();
  plan(root, { 'codex:gpt-6-astra': 'quota', 'codex:gpt-6.1-sol': 'invalid' });
  validatedCandidate(root);
  const result = review(root, '--type', 'functional');
  assert.equal(result.reviewer.id, 'claude:claude-opus-5-5@medium');
  assert.equal(result.reviewer.sameFamily, true);
  assert.deepEqual(result.reviewer.skipped.map((item) => item.reason), ['quota', 'invalid-output: output is not JSON']);
  assert.deepEqual(calls(root).map((line) => line.split(' ')[0]), ['codex:gpt-6-astra', 'codex:gpt-6.1-sol', 'codex:gpt-6.1-sol', 'claude:opus']);
  plan(root, { 'codex:gpt-6-astra': 'quota', 'codex:gpt-6.1-sol': 'quota', 'claude:opus': 'quota' });
  rejected(root, /no reviewer in the chain could run/, 'review', 'run', '--type', 'functional');
  assert.match(readFileSync(path.join(root, '.riff-data/events.ndjson'), 'utf8'), /review_unavailable/);
});

test('discovery and delivery artifacts are accepted by their record commands, and a fourth failed dossier round is refused', () => {
  const root = fixture();
  enroll(root);
  plan(root, { 'codex:gpt-6-astra': 'pass-with-high' });
  for (let round = 1; round <= 3; round += 1) {
    const failed = review(root, '--type', 'discovery');
    assert.equal(failed.status, 'fail');
    assert.equal(record(root, failed.record).status, 0);
    write(root, 'PROJECT.md', `Fixture contract revision ${round}\n`);
    ok(root, 'discovery', 'snapshot');
  }
  rejected(root, /3 dossier review rounds failed/, 'review', 'run', '--type', 'discovery');
  const fresh = fixture();
  enroll(fresh);
  const passed = review(fresh, '--type', 'discovery');
  assert.equal(record(fresh, passed.record).status, 0);
  ok(fresh, 'discovery', 'check');
  git(fresh, 'add', '--', 'docs/specs/readiness.json');
  commit(fresh, 'Dossier');
  rejected(fresh, /unfinished phases remain/, 'review', 'run', '--type', 'delivery');
  validatedCandidate(fresh);
  assert.equal(record(fresh, review(fresh, '--type', 'functional').record).status, 0);
  commit(fresh);
  ok(fresh, 'wave', 'checkpoint', 'a', '--summary', 'Feature verified', '--next', 'Verify delivery');
  write(fresh, '.riff-data/a-improvements.json', []);
  ok(fresh, 'improve', 'record', '--phase', 'a', '--file', '.riff-data/a-improvements.json');
  ok(fresh, 'wave', 'complete', 'a', '--commit', 'HEAD');
  const delivery = review(fresh, '--type', 'delivery');
  assert.equal(delivery.reviewer.id, 'codex:gpt-6-astra@high');
  const recorded = record(fresh, delivery.record);
  assert.equal(recorded.status, 0, recorded.text);
  assert.equal(read(fresh, '.riff-data/state.json').deliveryReview.reviewer.id, 'codex:gpt-6-astra@high');
});

test('a finding deferred to a security expert lets phases continue, is passed to later reviewers and blocks delivery until decided', () => {
  const root = fixture();
  enroll(root);
  assert.equal(record(root, review(root, '--type', 'discovery').record).status, 0);
  git(root, 'add', '--', 'docs/specs/readiness.json');
  commit(root, 'Dossier');
  plan(root, { 'codex:gpt-6-astra': 'pass-with-high' });
  validatedCandidate(root);
  const failed = review(root, '--type', 'security');
  assert.equal(record(root, failed.record.replace(/'<[^']*>'/g, "'Needs a threat model'")).status, 0);
  const finding = JSON.parse(ok(root, 'observations', 'list')).find((item) => item.status === 'pending' && item.severity === 'HIGH');
  ok(root, 'observations', 'review', '--id', finding.id, '--revision', finding.revision, '--status', 'expert_review', '--note', 'Threat model decision for a security expert');
  plan(root, {});
  write(root, 'README.md', 'feature reworked\n');
  git(root, 'add', '--', 'README.md');
  ok(root, 'wave', 'validate', 'a', '--run', '--command', JSON.stringify([process.execPath, '-e', 'process.exit(0)']), '--paths', '["README.md"]');
  assert.equal(record(root, review(root, '--type', 'security').record).status, 0);
  assert.match(calls(root).at(-1), / deferred$/);
  assert.equal(record(root, review(root, '--type', 'functional').record).status, 0);
  commit(root);
  ok(root, 'wave', 'checkpoint', 'a', '--summary', 'Feature verified', '--next', 'Verify delivery');
  write(root, '.riff-data/a-improvements.json', []);
  ok(root, 'improve', 'record', '--phase', 'a', '--file', '.riff-data/a-improvements.json');
  ok(root, 'wave', 'complete', 'a', '--commit', 'HEAD');
  assert.equal(record(root, review(root, '--type', 'delivery').record).status, 0);
  rejected(root, /await a security expert/, 'finish', '--check');
  const deferred = JSON.parse(ok(root, 'observations', 'list')).find((item) => item.id === finding.id);
  ok(root, 'observations', 'review', '--id', deferred.id, '--revision', deferred.revision, '--status', 'resolved', '--note', 'Security expert accepted the threat model');
  assert.doesNotMatch(cli(root, {}, 'finish', '--check').text, /security expert/);
});
