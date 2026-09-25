import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recommendPlan } from '../riff/lib/model-advice-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'riff/bin/riff.mjs');
const brief = (extra = {}) => ({ task: 'Implement a bounded module', reasoningDifficulty: 'Settled interface', dependencies: 'Independent owner', autonomy: 'Complete and verify', verification: 'Unit checks', lateErrorCost: 'Reversible local change', ...extra });
const localAdvice = { profile: 'sol_medium', reason: 'Bounded connected work', reconsiderWhen: 'Interfaces change' };
const plan = () => ({ task: 'Deliver a small feature with documentation', runtime: { delegationAllowed: true, modelSelection: true }, roles: [
  { id: 'pilot', kind: 'primary', input: brief({ localAdvice }) },
  { id: 'docs', kind: 'subagent', input: brief({ task: 'Document the settled feature', constraints: { availableProfiles: ['sol_medium', 'luna_medium'] }, localAdvice }) },
] });
const provider = (requests, edit = (v) => v) => async (url, options) => {
  assert.equal(url, 'https://openrouter.ai/api/alpha/decisions');
  const body = JSON.parse(options.body);
  requests.push(body);
  return Response.json(edit({ model: 'typesafe/jev-test', usage: { cost: 0.0003 }, answers: Object.fromEntries(Object.entries(body.questions).map(([id, q]) => [id, {
    type: 'choice', choice: 'sol_medium', probabilities: Object.fromEntries(Object.keys(q.criteria).map((profile) => [profile, profile === 'sol_medium' ? 1 : 0])),
  }])) }));
};

test('role plan batches once, filters each role, and prepares native dispatch without claiming execution', async () => {
  const requests = [];
  const result = await recommendPlan(plan(), { mode: 'jev', allowJev: true, apiKey: 'test', fetchImpl: provider(requests) });
  assert.equal(requests.length, 1);
  assert.deepEqual(Object.keys(requests[0].questions), ['pilot', 'docs']);
  assert.deepEqual(Object.keys(requests[0].questions.docs.criteria), ['luna_medium', 'sol_medium']);
  assert.ok(!JSON.stringify(requests).includes('localAdvice'));
  assert.ok(!JSON.stringify(requests).includes('delegationAllowed'));
  assert.equal(result.callCost, 0.0003, 'one batch cost, not a sum of role metadata');
  assert.equal(result.roles[0].dispatch.status, 'manual');
  assert.deepEqual(result.roles[1].dispatch, { status: 'ready', model: 'gpt-6-sol', effort: 'medium' });
  assert.equal(result.roles[1].advice.effectiveModel, null);
});

test('role recovery is selective and rechecks launch capability without paying again', async () => {
  const requests = [];
  const options = { mode: 'jev', allowJev: true, apiKey: 'test', fetchImpl: provider(requests) };
  const input = plan();
  const first = await recommendPlan(input, options);
  const repeated = await recommendPlan(input, { ...options, previous: first });
  assert.equal(repeated.reused, true);
  assert.equal(repeated.providerCalls, 0);
  input.runtime.modelSelection = false;
  const unavailable = await recommendPlan(input, { ...options, previous: first });
  assert.equal(unavailable.roles[1].dispatch.status, 'model-selection-unavailable');
  assert.equal(requests.length, 1);
  input.roles[1].input.dependencies = 'Documentation now spans two modules';
  const changed = await recommendPlan(input, { ...options, previous: first });
  assert.equal(changed.roles[0].advice.reused, true);
  assert.deepEqual(Object.keys(requests[1].questions), ['docs']);
  const tampered = structuredClone(changed);
  tampered.roles[0].advice.model = 'forged';
  await recommendPlan(input, { ...options, previous: tampered });
  assert.deepEqual(Object.keys(requests[2].questions), ['pilot']);
  await recommendPlan(input, { ...options, previous: changed, reason: 'New shared diagnosis' });
  assert.deepEqual(Object.keys(requests[3].questions), ['pilot', 'docs']);
});

test('consent, privacy, availability, explicit restrictions and delegation remain independent gates', async () => {
  const requests = [];
  const options = { mode: 'jev', apiKey: 'test', fetchImpl: provider(requests) };
  const noConsent = await recommendPlan(plan(), options);
  assert.equal(noConsent.roles[0].advice.providerStatus, 'consent-required');
  assert.equal(noConsent.roles[0].advice.origin, 'local');
  assert.equal(requests.length, 0);
  const input = plan();
  input.roles[1].input.constraints.dataPolicy = 'local-only';
  await assert.rejects(recommendPlan(input, { ...options, allowJev: true }), /local-only role/);
  assert.equal(requests.length, 0);
  delete input.roles[1].input.constraints.dataPolicy;
  input.runtime.delegationAllowed = false;
  assert.equal((await recommendPlan(input)).roles[1].dispatch.status, 'delegation-not-authorized');
  input.runtime.delegationAllowed = true;
  delete input.roles[1].input.constraints.availableProfiles;
  assert.equal((await recommendPlan(input)).roles[1].dispatch.status, 'availability-unverified');
  input.roles[1].input.constraints.allowedProfiles = ['luna_medium'];
  assert.equal((await recommendPlan(input)).roles[1].advice.profile, 'luna_medium');
  input.roles[1].id = 'pilot';
  await assert.rejects(recommendPlan(input), /unique/);
  const bad = plan();
  bad.roles[1].input.secret = 'must not be sent';
  await assert.rejects(recommendPlan(bad, { ...options, allowJev: true }), /invalid input/);
});

test('partial provider failure rejects the whole batch and reuses explicit local fallbacks', async () => {
  const requests = [];
  const options = { mode: 'jev', allowJev: true, apiKey: 'test', fetchImpl: provider(requests, (raw) => { delete raw.answers.docs; return raw; }) };
  const failed = await recommendPlan(plan(), options);
  assert.ok(failed.roles.every((r) => r.advice.origin === 'local' && r.advice.providerStatus === 'invalid-response'));
  assert.equal(failed.callCost, null);
  const again = await recommendPlan(plan(), { ...options, previous: failed });
  assert.equal(again.reused, true);
  assert.equal(requests.length, 1);
  const missing = await recommendPlan(plan(), { ...options, apiKey: '' });
  assert.equal(missing.providerCalls, 0);
  assert.ok(missing.roles.every((r) => r.advice.providerStatus === 'missing-key'));
});

test('CLI persists a separate role plan and wave instructions require advice before dispatch', () => {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'riff-role-plan-')));
  const env = { ...process.env, HOME: path.join(directory, '.home'), CODEX_HOME: path.join(directory, '.home/.codex'), OPENROUTER_API_KEY: '' };
  const run = (args, input) => spawnSync(process.execPath, [cli, ...args], { cwd: directory, env, encoding: 'utf8', input: JSON.stringify(input) });
  try {
    execFileSync('git', ['init', '-q'], { cwd: directory });
    execFileSync(process.execPath, [cli, 'init', '--non-interactive'], { cwd: directory, env });
    const stateFile = path.join(directory, '.riff-codex-state/state.json');
    const state = JSON.parse(readFileSync(stateFile));
    state.phases = [{ id: 'test', status: 'active', attempts: 1 }];
    state.activeWave = { phase: 'test' };
    state.model = { name: 'receipt-only' };
    state.modelAdvice = { sentinel: 'retain primary-only advice' };
    writeFileSync(stateFile, JSON.stringify(state));
    const input = { ...plan(), phase: 'test', task: 'PRIVATE PLAN SENTINEL' };
    const args = ['model-advice', 'plan', '--input', '-'];
    const first = run(args, input);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(JSON.parse(first.stdout).roles[1].dispatch.status, 'ready');
    const resumed = JSON.parse(run(args, input).stdout);
    assert.equal(resumed.reused, true);
    assert.equal(resumed.recordedAt, JSON.parse(first.stdout).recordedAt);
    const saved = JSON.parse(readFileSync(stateFile));
    for (const field of ['phases', 'activeWave', 'model', 'modelAdvice']) assert.deepEqual(saved[field], state[field]);
    assert.ok(!readFileSync(stateFile, 'utf8').includes('PRIVATE PLAN SENTINEL'));
    assert.ok(!readFileSync(path.join(directory, '.riff-codex-state/events.ndjson'), 'utf8').includes('PRIVATE PLAN SENTINEL'));
    assert.equal(JSON.parse(run(['model-advice', 'show']).stdout).plan.kind, 'wave-model-plan');
    assert.equal(JSON.parse(run(['wave', 'context', 'test']).stdout).modelAdvicePlan.phase, 'test');
    assert.equal(run(args, { ...input, phase: 'missing' }).status, 1);
    const wave = readFileSync(path.join(root, 'riff/skills/wave/SKILL.md'), 'utf8');
    const routing = readFileSync(path.join(root, 'riff/references/model-routing.md'), 'utf8');
    assert.match(wave, /model-advice plan/);
    assert.match(routing, /dispatch\.status/);
    assert.match(routing, /advice-only/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
