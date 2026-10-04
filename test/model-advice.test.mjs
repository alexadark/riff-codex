import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadCatalog, normalizeInput, eligibleProfiles, recommend } from '../riff/lib/model-advice.mjs';
import { withLock } from '../riff/lib/safety.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'riff/bin/riff.mjs');
const catalog = loadCatalog();
const brief = (extra = {}) => ({ task: 'Test one bounded public function', reasoningDifficulty: 'Known contract', dependencies: 'One independent unit', autonomy: 'Complete with automatic checks', verification: 'Unit tests', lateErrorCost: 'Local reversible change', ...extra });
const localAdvice = { profile: 'sol_medium', reason: 'Stable bounded contract', reconsiderWhen: 'Cross-component dependencies appear' };
const eligible = eligibleProfiles(normalizeInput(brief(), catalog), catalog);
const response = (overrides = {}) => Response.json({ model: 'typesafe/jev-test', usage: { cost: 0.0002 }, answers: { recommended_profile: { type: 'choice', choice: 'sol_medium', confidence: 0.8, probabilities: Object.fromEntries(eligible.map((p) => [p.id, p.id === 'sol_medium' ? 1 : 0])) } }, ...overrides });

test('model advice distinguishes local judgment, real provider response and effective identity', async () => {
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls++;
    assert.equal(url, 'https://openrouter.ai/api/alpha/decisions');
    assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body);
    assert.equal(body.questions.recommended_profile.type, 'choice');
    assert.equal(Object.keys(body.questions.recommended_profile.criteria).length, 9);
    assert.deepEqual(body.state.rules, catalog.rules);
    assert.ok(!JSON.stringify(body).includes('localAdvice'));
    assert.ok(!JSON.stringify(body).includes('effectiveModel'));
    return response();
  };
  const input = brief({ localAdvice, effectiveModel: { model: 'gpt-6-astra', effort: 'medium', evidence: 'user-declared' } });
  const local = await recommend(input, { fetchImpl });
  assert.equal(local.origin, 'local');
  assert.equal(local.profile, 'sol_medium');
  assert.equal(local.effectiveModel.model, 'gpt-6-astra');
  assert.equal(calls, 0);
  const paid = await recommend(input, { mode: 'jev', allowJev: true, apiKey: 'test-key', fetchImpl });
  assert.equal(paid.origin, 'jev');
  assert.equal(paid.jev.model, 'typesafe/jev-test');
  assert.equal(paid.jev.cost, 0.0002);
  assert.equal(paid.reason, undefined, 'Jev does not inherit the local alternative explanation');
  assert.equal(calls, 1);
  assert.equal((await recommend(brief({ localAdvice }))).effectiveModel, null);
});

test('restrictions filter providers and zero/one choice before network; invalid choices fail closed', async () => {
  let calls = 0;
  const opts = { mode: 'jev', allowJev: true, apiKey: 'test-key', fetchImpl: async () => { calls++; return response({ answers: { recommended_profile: { type: 'choice', choice: 'deepseek_high', probabilities: { deepseek_high: 1 } } } }); } };
  assert.equal((await recommend(brief({ constraints: { dataPolicy: 'local-only' } }), opts)).status, 'no-eligible-profile');
  assert.equal((await recommend(brief({ constraints: { allowedProfiles: ['luna_low'] } }), opts)).origin, 'constraint');
  assert.equal(calls, 0);
  assert.equal((await recommend(brief({ localAdvice }), opts)).providerStatus, 'invalid-response');
  assert.equal(calls, 1);
  const c = { providers: ['ollama'], deepseek: { available: true, dataAllowed: true, benefit: 'preserve-quota' } };
  assert.deepEqual(eligibleProfiles(normalizeInput(brief({ constraints: c }), catalog), catalog).map((p) => p.id), ['deepseek_low', 'deepseek_high']);
  c.deepseek.dataAllowed = false;
  assert.equal(eligibleProfiles(normalizeInput(brief({ constraints: c }), catalog), catalog).length, 0);
  assert.equal(eligibleProfiles(normalizeInput(brief({ constraints: { availableProfiles: [] } }), catalog), catalog).length, 0);
  await assert.rejects(recommend(brief({ constraints: { allowedProfiles: ['unknown'] } })), /invalid allowedProfiles/);
  await assert.rejects(recommend(brief({ secret: 'never forward arbitrary fields' })), /invalid input fields/);
});

test('consent, missing key, HTTP errors and timeouts are explicit without retries or fabricated Jev', async () => {
  let calls = 0;
  const input = brief({ localAdvice });
  const options = { mode: 'jev', apiKey: 'test-key', fetchImpl: async () => { calls++; return new Response('sensitive body must not be echoed', { status: 429 }); } };
  assert.equal((await recommend(input, options)).providerStatus, 'consent-required');
  assert.equal(calls, 0);
  assert.equal((await recommend(input, { ...options, allowJev: true, apiKey: '' })).providerStatus, 'missing-key');
  const failed = await recommend(input, { ...options, allowJev: true });
  assert.equal(failed.providerStatus, 'http-429');
  assert.equal(failed.origin, 'local');
  assert.equal(failed.jev, undefined);
  assert.ok(!JSON.stringify(failed).includes('sensitive body'));
  assert.equal(calls, 1);
  const timeout = await recommend(brief(), { mode: 'jev', allowJev: true, apiKey: 'test', timeoutMs: 5, fetchImpl: async (_, { signal }) => {
    await new Promise((resolve) => setTimeout(resolve, 15));
    signal.throwIfAborted();
  } });
  assert.equal(timeout.providerStatus, 'timeout');
  assert.equal(timeout.status, 'needs-local-advice');
});

test('recovery reuses decisions including failures, explicit reason refreshes, async lock survives await', async () => {
  let calls = 0;
  const options = { mode: 'jev', allowJev: true, apiKey: 'test', fetchImpl: async () => { calls++; return response(); } };
  const first = await recommend(brief(), options);
  const again = await recommend(brief(), { ...options, previous: first });
  assert.equal(again.reused, true);
  assert.equal(calls, 1);
  await recommend(brief(), { ...options, previous: first, reason: 'New diagnosis requested' });
  assert.equal(calls, 2);
  await recommend(brief({ dependencies: 'Two coupled components' }), { ...options, previous: first });
  assert.equal(calls, 3);
  const failed = await recommend(brief({ localAdvice }), { ...options, apiKey: '' });
  assert.equal((await recommend(brief({ localAdvice }), { ...options, previous: failed })).reused, true);
  assert.equal(calls, 3, 'restoring key alone does not cause a retry');
  const repaired = await recommend(brief(), { ...options, previous: { ...first, model: 'forged-model', effort: 'made-up', privateExtra: 'must not survive' } });
  assert.equal(repaired.reused, false);
  assert.equal(repaired.model, 'gpt-6-sol');
  assert.equal(repaired.privateExtra, undefined);
  const invalidProvider = await recommend(brief(), { ...options, previous: { ...first, jev: { ...first.jev, model: false } } });
  assert.equal(invalidProvider.reused, false);
  assert.equal(invalidProvider.jev.model, 'typesafe/jev-test');
  assert.equal(calls, 5, 'malformed cached results are validated before any reuse');
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'riff-advice-lock-')));
  try {
    await withLock(directory, async () => {
      await Promise.resolve();
      assert.equal(existsSync(path.join(directory, '.riff-data/write.lock')), true);
      assert.throws(() => withLock(directory, () => {}), /busy/);
    });
    assert.equal(existsSync(path.join(directory, '.riff-data/write.lock')), false);
    await assert.rejects(withLock(directory, async () => { throw new Error('failure'); }), /failure/);
    assert.equal(existsSync(path.join(directory, '.riff-data/write.lock')), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('CLI integration preserves wave state, consent, projections and private input across a disposable project', () => {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'riff-advice-cli-')));
  const env = { ...process.env, HOME: path.join(directory, '.home'), CODEX_HOME: path.join(directory, '.home/.codex'), OPENROUTER_API_KEY: '' };
  const invoke = (...args) => JSON.parse(execFileSync(process.execPath, [cli, ...args], { cwd: directory, env, encoding: 'utf8' }));
  const run = (args, input) => spawnSync(process.execPath, [cli, ...args], { cwd: directory, env, encoding: 'utf8', input: JSON.stringify(input) });
  try {
    execFileSync('git', ['init', '-q'], { cwd: directory });
    execFileSync(process.execPath, [cli, 'init', '--non-interactive'], { cwd: directory, env });
    const stateFile = path.join(directory, '.riff-codex-state/state.json');
    const readState = () => JSON.parse(readFileSync(stateFile, 'utf8'));
    const initial = readState();
    initial.phases = [{ id: 'test', status: 'active', attempts: 1 }];
    initial.activeWave = { phase: 'test' };
    initial.model = { name: 'reviewer-only' };
    writeFileSync(stateFile, JSON.stringify(initial));
    const base = readState();
    assert.equal(invoke('model-advice', 'show').preference.mode, 'local');
    const request = brief({ phase: 'test', task: 'PRIVATE INPUT SENTINEL', localAdvice });
    const args = ['model-advice', 'recommend', '--input', '-'];
    const result = run(args, request);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).origin, 'local');
    assert.equal(JSON.parse(run(args, request).stdout).reused, true);
    assert.deepEqual(readState().phases, base.phases);
    assert.deepEqual(readState().activeWave, base.activeWave);
    assert.deepEqual(readState().model, base.model);
    assert.ok(!readFileSync(stateFile, 'utf8').includes('PRIVATE INPUT SENTINEL'));
    assert.ok(!readFileSync(path.join(directory, '.riff-codex-state/events.ndjson'), 'utf8').includes('PRIVATE INPUT SENTINEL'));
    assert.equal(run(['model-advice', 'configure', '--mode', 'jev'], {}).status, 1);
    assert.equal(invoke('model-advice', 'configure', '--mode', 'jev', '--allow-jev-summary').allowJevSummary, true);
    assert.equal(JSON.parse(run(args, request).stdout).providerStatus, 'missing-key');
    assert.equal(invoke('model-advice', 'configure', '--mode', 'off').allowJevSummary, false);
    assert.equal(JSON.parse(run(args, request).stdout).status, 'disabled');
    assert.equal(run([...args, '--endpoint', 'https://untrusted.invalid'], request).status, 1);
    assert.equal(run(args, brief({ phase: 'missing' })).status, 1);
    const hooks = readFileSync(path.join(directory, '.codex/hooks.json'), 'utf8');
    assert.ok(!hooks.includes('model-advice'));
    assert.equal(realpathSync(path.join(directory, '.agents/skills/riff-codex-wave')), path.join(root, 'riff/skills/wave'));
    assert.deepEqual(invoke('model-advice', 'catalog'), catalog);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('Opus 5.5 is opt-in Anthropic advice and respects provider, availability and data filters', async () => {
  const opus = catalog.profiles.filter((p) => p.provider === 'anthropic');
  assert.deepEqual(opus.map((p) => p.effort), ['low', 'medium', 'high', 'xhigh', 'max']);
  assert.ok(opus.every((p) => p.model === 'claude-opus-5-5'));
  assert.ok(eligible.every((p) => p.provider === 'openai'));
  const constraints = { providers: ['anthropic'], availableProfiles: ['opus_5_5_medium'] };
  assert.deepEqual(eligibleProfiles(normalizeInput(brief({ constraints }), catalog), catalog).map((p) => p.id), ['opus_5_5_medium']);
  const result = await recommend(brief({ constraints }));
  assert.equal(result.profile, 'opus_5_5_medium');
  assert.equal(result.origin, 'constraint');
  assert.deepEqual(eligibleProfiles(normalizeInput(brief({ constraints: { ...constraints, dataPolicy: 'local-only' } }), catalog), catalog), []);
});
