import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROMPTS = fileURLToPath(new URL('../references/review-prompts/', import.meta.url));
export const SCHEMA_FILE = path.join(PROMPTS, 'output.schema.json');
export const REVIEW_TYPES = ['discovery', 'functional', 'security', 'delivery'];
const SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const BLOCKING = new Set(['HIGH', 'CRITICAL']);
const FAMILY = { codex: 'openai', claude: 'anthropic' };

export const DEFAULT_REVIEWERS = {
  chain: [
    { via: 'codex', model: 'gpt-6-astra' },
    { via: 'codex', model: 'gpt-6.1-sol' },
    { via: 'claude', model: 'opus', fresh: true },
  ],
  effort: { default: 'medium', security: 'high', delivery: 'high' },
  timeoutSeconds: 1200,
};

export function reviewerConfig(config) {
  const custom = config?.reviewers ?? {};
  return {
    chain: Array.isArray(custom.chain) && custom.chain.length ? custom.chain : DEFAULT_REVIEWERS.chain,
    effort: { ...DEFAULT_REVIEWERS.effort, ...(custom.effort ?? {}) },
    timeoutSeconds: Number(custom.timeoutSeconds) > 0 ? Number(custom.timeoutSeconds) : DEFAULT_REVIEWERS.timeoutSeconds,
    builderFamily: custom.builderFamily ?? null,
  };
}

// The family of the agent asking for the review, so a same-family reviewer is labeled as such.
export function builderFamily(settings, env = process.env) {
  if (settings.builderFamily) return settings.builderFamily;
  if (env.CLAUDECODE) return 'anthropic';
  if (Object.keys(env).some((key) => key.startsWith('CODEX_') && key !== 'CODEX_HOME')) return 'openai';
  return null;
}

export function buildPrompt(type, context) {
  if (!REVIEW_TYPES.includes(type)) throw new Error(`unknown review type ${type}`);
  return [readFileSync(path.join(PROMPTS, 'shared.md'), 'utf8'), readFileSync(path.join(PROMPTS, `${type}.md`), 'utf8'), '## Context', context].join('\n\n');
}

function binary(via, env) {
  return via === 'codex' ? env.RIFF_REVIEW_CODEX_BIN || 'codex' : env.RIFF_REVIEW_CLAUDE_BIN || 'claude';
}

// Child CLIs must not believe they run inside the calling host session.
function childEnv(env) {
  const copy = { ...env };
  for (const key of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT']) delete copy[key];
  return copy;
}

function version(bin, env) {
  const result = spawnSync(bin, ['--version'], { encoding: 'utf8', env, timeout: 30000 });
  if (result.error || result.status !== 0) return null;
  return (result.stdout || '').trim().split('\n')[0] || null;
}

// Only a reviewer that could not run is skipped. A negative review is a result, never a reason to move on.
export function unavailableReason(text) {
  const value = String(text ?? '');
  if (/not logged in|please run \/login|codex login|unauthori[sz]ed|\b401\b|authentication/i.test(value)) return 'not-logged-in';
  if (/usage limit|rate.?limit|quota|\b429\b|too many requests|credit balance/i.test(value)) return 'quota';
  if (/model.{0,80}(not (found|supported|available|exist)|does not exist|unknown|unavailable|not included)|model_not_found|invalid model/i.test(value)) return 'model-unavailable';
  return null;
}

function errorTail(text) {
  return String(text ?? '').split('\n').map((line) => line.trim()).filter(Boolean).slice(-3).join(' | ').slice(0, 300);
}

function runCodex(entry, effort, prompt, root, settings, env) {
  const bin = binary('codex', env);
  const dir = mkdtempSync(path.join(tmpdir(), 'riff-review-'));
  const out = path.join(dir, 'last-message.json');
  try {
    const args = ['exec', '--ignore-user-config', '-m', entry.model, '-c', `model_reasoning_effort=${effort}`, '-s', 'read-only', '--ephemeral', '--skip-git-repo-check', '--output-schema', SCHEMA_FILE, '-o', out, '-C', root, '-'];
    const result = spawnSync(bin, args, { input: prompt, encoding: 'utf8', env, timeout: settings.timeoutSeconds * 1000, maxBuffer: 64 * 1024 * 1024 });
    const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (result.error?.code === 'ENOENT') return { unavailable: 'cli-missing' };
    if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') return { unavailable: 'timeout' };
    if (result.status !== 0) return { unavailable: unavailableReason(text) ?? `error: ${errorTail(text)}` };
    if (!existsSync(out)) return { invalid: 'no output message' };
    return { raw: readFileSync(out, 'utf8'), model: entry.model };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function runClaude(entry, effort, prompt, root, settings, env) {
  const bin = binary('claude', env);
  const schema = readFileSync(SCHEMA_FILE, 'utf8');
  const args = ['-p', '--model', entry.model, '--effort', effort, '--no-session-persistence', '--strict-mcp-config', '--tools', 'Read,Grep,Glob', '--permission-mode', 'dontAsk', '--output-format', 'json', '--json-schema', schema];
  const result = spawnSync(bin, args, { input: prompt, cwd: root, encoding: 'utf8', env, timeout: settings.timeoutSeconds * 1000, maxBuffer: 64 * 1024 * 1024 });
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (result.error?.code === 'ENOENT') return { unavailable: 'cli-missing' };
  if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') return { unavailable: 'timeout' };
  let wrapper = null;
  try { wrapper = JSON.parse(result.stdout); } catch {}
  if (result.status !== 0 || wrapper?.is_error) return { unavailable: unavailableReason(wrapper?.result ?? text) ?? `error: ${errorTail(wrapper?.result ?? text)}` };
  if (!wrapper) return { invalid: 'output is not JSON' };
  const model = Object.keys(wrapper.modelUsage ?? {})[0] ?? entry.model;
  if (wrapper.structured_output) return { raw: JSON.stringify(wrapper.structured_output), model };
  return { raw: String(wrapper.result ?? ''), model };
}

export function parseVerdict(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { return { error: 'output is not JSON' }; }
  if (!value || !['pass', 'fail'].includes(value.status) || typeof value.summary !== 'string' || !Array.isArray(value.evidence) || !Array.isArray(value.findings)) return { error: 'output does not match the review schema' };
  const evidence = value.evidence.map(String).map((item) => item.trim()).filter(Boolean);
  if (!evidence.length) return { error: 'review lists no inspected evidence' };
  const findings = value.findings.map((finding) => ({ ...finding, severity: String(finding?.severity ?? '').toUpperCase() }));
  if (findings.some((finding) => !SEVERITIES.includes(finding.severity) || !String(finding.title ?? '').trim())) return { error: 'finding without valid severity or title' };
  // A blocking finding always fails, whatever status the model chose.
  const status = findings.some((finding) => BLOCKING.has(finding.severity)) ? 'fail' : value.status;
  return { verdict: { status, summary: value.summary.trim(), evidence, findings } };
}

export function runReviewChain({ type, prompt, root, config, env = process.env }) {
  const settings = reviewerConfig(config);
  const effort = settings.effort[type] ?? settings.effort.default;
  const family = builderFamily(settings, env);
  const skipped = [];
  const childEnvironment = childEnv(env);
  for (const entry of settings.chain) {
    if (!FAMILY[entry.via]) { skipped.push({ id: `${entry.via}:${entry.model}`, reason: 'unsupported-via' }); continue; }
    const id = `${entry.via}:${entry.model}@${effort}`;
    const runner = entry.via === 'codex' ? runCodex : runClaude;
    const attempt = () => {
      const outcome = runner(entry, effort, prompt, root, settings, childEnvironment);
      if (outcome.unavailable) return outcome;
      const parsed = outcome.invalid ? { error: outcome.invalid } : parseVerdict(outcome.raw);
      return parsed.error ? { invalid: parsed.error } : { ...outcome, verdict: parsed.verdict };
    };
    // One retry for malformed output, then the reviewer counts as unavailable.
    let outcome = attempt();
    if (outcome.invalid) outcome = attempt();
    if (outcome.invalid) outcome = { unavailable: `invalid-output: ${outcome.invalid}` };
    if (outcome.unavailable) { skipped.push({ id, reason: outcome.unavailable }); continue; }
    const reviewerFamily = FAMILY[entry.via];
    return {
      verdict: outcome.verdict,
      reviewer: {
        id: outcome.model && outcome.model !== entry.model ? `${entry.via}:${outcome.model}@${effort}` : id,
        independent: true,
        family: reviewerFamily,
        sameFamily: family ? family === reviewerFamily : null,
        cli: version(binary(entry.via, childEnvironment), childEnvironment),
        skipped,
      },
    };
  }
  const error = new Error(`no reviewer in the chain could run: ${skipped.map((item) => `${item.id} (${item.reason})`).join(', ')}`);
  error.skipped = skipped;
  throw error;
}

export function toArtifact({ candidate, type, verdict, reviewer, runAt }) {
  return { version: 1, candidate, type, status: verdict.status, summary: verdict.summary, reviewer, evidence: verdict.evidence, findings: verdict.findings, reviewedBy: 'riff review run', runAt };
}

// Cheap presence check for doctor: no model is called.
export function reviewerAvailability(config, env = process.env) {
  const settings = reviewerConfig(config);
  const vias = [...new Set(settings.chain.map((entry) => entry.via))];
  return vias.map((via) => {
    const bin = binary(via, env);
    const cli = FAMILY[via] ? version(bin, childEnv(env)) : null;
    const loggedIn = !cli || via !== 'codex' || spawnSync(bin, ['login', 'status'], { encoding: 'utf8', env: childEnv(env), timeout: 30000 }).status === 0;
    const models = settings.chain.filter((entry) => entry.via === via).map((entry) => entry.model).join(', ');
    return { via, ok: Boolean(cli) && loggedIn, detail: `${cli ?? 'CLI not found'}${loggedIn ? '' : ', not logged in'} (${models})` };
  });
}
