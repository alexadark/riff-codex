#!/usr/bin/env node
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  renameSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.1.0';
const SCRIPT = fileURLToPath(import.meta.url);
const PLUGIN_ROOT = path.resolve(path.dirname(SCRIPT), '..');
const PHASE_STATES = new Set(['ready', 'active', 'completed', 'parked', 'blocked', 'awaiting_human']);
const SENSITIVE_WORDS = /auth|authori[sz]|tenant|user data|secret|payment|migration|public api|callback|webhook/i;

function fail(message, code = 1) {
  process.stderr.write(`RIFF: ${message}\n`);
  process.exit(code);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
}

function gitRoot(candidate = process.cwd()) {
  try {
    return path.resolve(run('git', ['rev-parse', '--show-toplevel'], { cwd: candidate }));
  } catch {
    fail(`not inside a Git repository: ${candidate}`);
  }
}

function ensureDir(fileOrDir, isFile = false) {
  mkdirSync(isFile ? path.dirname(fileOrDir) : fileOrDir, { recursive: true });
}

function readJson(file, required = true) {
  if (!existsSync(file)) {
    if (required) throw new Error(`missing ${file}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`invalid JSON in ${file}: ${error.message}`);
  }
}

function writeJson(file, value) {
  ensureDir(file, true);
  const temporary = `${file}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, file);
}

function sha(value) {
  return createHash('sha256').update(value).digest('hex');
}

function now() {
  return new Date().toISOString();
}

function pathsFor(root) {
  return {
    root,
    framework: path.join(root, '.riff'),
    riff: path.join(root, '.riff-state'),
    config: path.join(root, '.riff-state', 'config.json'),
    state: path.join(root, '.riff-state', 'state.json'),
    events: path.join(root, '.riff-state', 'events.ndjson'),
    receipts: path.join(root, '.riff-state', 'receipts'),
    hooks: path.join(root, '.codex', 'hooks.json'),
    roadmap: path.join(root, 'ROADMAP.yaml'),
    project: path.join(root, 'PROJECT.md'),
  };
}

function baseState() {
  return {
    version: 1,
    project: { name: null, objective: null },
    roadmap: { source: 'ROADMAP.yaml', out_of_scope: [] },
    phases: [],
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

function event(root, type, data = {}) {
  const files = pathsFor(root);
  ensureDir(files.events, true);
  appendFileSync(files.events, `${JSON.stringify({ at: now(), type, ...data })}\n`);
}

function readState(root) {
  const state = readJson(pathsFor(root).state);
  validateState(state);
  return state;
}

function saveState(root, state) {
  state.updatedAt = now();
  writeJson(pathsFor(root).state, state);
}

function validateState(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.phases)) throw new Error('state must use RIFF schema version 1');
  const ids = new Set();
  for (const phase of state.phases) {
    if (!phase.id || ids.has(phase.id)) throw new Error(`invalid or duplicate phase id: ${phase.id ?? '<missing>'}`);
    if (!PHASE_STATES.has(phase.status)) throw new Error(`invalid state for ${phase.id}: ${phase.status}`);
    ids.add(phase.id);
  }
  for (const phase of state.phases) {
    for (const dependency of phase.depends_on ?? []) {
      if (!ids.has(dependency)) throw new Error(`${phase.id} depends on unknown phase ${dependency}`);
    }
  }
}

function quote(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function desiredHooks(script = SCRIPT) {
  const handler = (name, extra = {}) => ({
    type: 'command',
    command: `/usr/bin/env node ${quote(script)} hook ${name} --id riff-hook:${name}`,
    timeout: 10,
    ...extra,
  });
  return {
    SessionStart: [{ matcher: 'startup|resume|compact', hooks: [handler('session-start', { statusMessage: 'Loading RIFF project context', additionalContextLimit: 800 })] }],
    PreCompact: [{ matcher: 'manual|auto', hooks: [handler('pre-compact', { statusMessage: 'Saving RIFF checkpoint' })] }],
    PreToolUse: [{ matcher: 'Bash|apply_patch|Edit|Write|mcp__.*', hooks: [handler('pre-tool', { statusMessage: 'Checking RIFF safety boundary' })] }],
    PostToolUse: [{ matcher: 'Bash|apply_patch|Edit|Write|mcp__.*', hooks: [handler('post-tool', { statusMessage: 'Recording RIFF change signals', additionalContextLimit: 900 })] }],
    Stop: [{ hooks: [handler('stop', { statusMessage: 'Checking RIFF handoff' })] }],
    SessionEnd: [{ hooks: [handler('session-end', { timeout: 3 })] }],
  };
}

function mergeHooks(existing, script = SCRIPT) {
  const result = existing ?? { description: 'Project-local Codex hooks.' };
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('hooks.json root must be an object');
  if (result.hooks !== undefined && (typeof result.hooks !== 'object' || Array.isArray(result.hooks))) throw new Error('hooks.json hooks must be an object');
  result.hooks ??= {};
  for (const [eventName, groups] of Object.entries(result.hooks)) {
    if (!Array.isArray(groups)) throw new Error(`hooks.${eventName} must be an array`);
    result.hooks[eventName] = groups
      .map((group) => ({ ...group, hooks: (group.hooks ?? []).filter((hook) => !String(hook.command ?? '').includes('riff-hook:')) }))
      .filter((group) => group.hooks.length > 0);
  }
  for (const [eventName, groups] of Object.entries(desiredHooks(script))) {
    result.hooks[eventName] ??= [];
    result.hooks[eventName].push(...groups);
  }
  result.description ??= 'Project-local Codex hooks.';
  return result;
}

function hooksHash(hooks) {
  const managed = [];
  for (const [eventName, groups] of Object.entries(hooks.hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group.hooks ?? []) {
        if (String(hook.command ?? '').includes('riff-hook:')) managed.push([eventName, group.matcher ?? '', hook]);
      }
    }
  }
  return sha(JSON.stringify(managed));
}

function gitHooksDir(root) {
  let configured = '';
  try { configured = run('git', ['config', '--get', 'core.hooksPath'], { cwd: root }); } catch { /* default */ }
  if (!configured) return path.join(root, '.git', 'hooks');
  return path.resolve(root, configured);
}

function installGitHook(root, name) {
  const directory = gitHooksDir(root);
  ensureDir(directory);
  const target = path.join(directory, name);
  const backupDir = path.join(root, '.riff-state', 'git-hooks');
  ensureDir(backupDir);
  let prior = null;
  if (existsSync(target)) {
    const current = readFileSync(target, 'utf8');
    if (!current.includes('# RIFF managed wrapper')) {
      const digest = sha(current).slice(0, 12);
      prior = path.join(backupDir, `${name}.${digest}.previous`);
      if (!existsSync(prior)) copyFileSync(target, prior);
    } else {
      const match = current.match(/^RIFF_PREVIOUS=(.+)$/m);
      prior = match?.[1] ? JSON.parse(match[1]) : null;
    }
  }
  const previousLine = JSON.stringify(prior ?? '');
  const arg = name === 'commit-msg' ? ' "$@"' : '';
  const wrapper = `#!/bin/sh\n# RIFF managed wrapper\nRIFF_PREVIOUS=${previousLine}\nif [ -n "$RIFF_PREVIOUS" ] && [ -x "$RIFF_PREVIOUS" ]; then "$RIFF_PREVIOUS" "$@" || exit $?; fi\n/usr/bin/env node "$(git rev-parse --show-toplevel)/.riff/bin/riff.mjs" hook git-${name}${arg}\n`;
  writeFileSync(target, wrapper);
  chmodSync(target, 0o755);
}

function ensureFrameworkLink(root) {
  const target = path.join(root, '.riff');
  if (existsSync(target) || (() => { try { lstatSync(target); return true; } catch { return false; } })()) {
    const stat = lstatSync(target);
    if (!stat.isSymbolicLink()) throw new Error('.riff already exists and is not a symlink; preserving it');
    let resolved;
    try { resolved = path.resolve(path.dirname(target), readlinkSync(target)); } catch (error) { throw new Error(`cannot read .riff symlink: ${error.message}`); }
    if (resolved !== PLUGIN_ROOT) throw new Error(`.riff points to ${resolved}; expected permanent RIFF folder ${PLUGIN_ROOT}`);
    return false;
  }
  symlinkSync(path.relative(root, PLUGIN_ROOT), target);
  return true;
}

function exposeSkills(root) {
  const source = path.join(PLUGIN_ROOT, 'skills');
  const destination = path.join(root, '.agents', 'skills');
  ensureDir(destination);
  const preserved = [];
  for (const name of readFileNames(source)) {
    const target = path.join(destination, name);
    const desired = path.relative(destination, path.join(root, '.riff', 'skills', name));
    let existing = null;
    try { existing = lstatSync(target); } catch { /* missing */ }
    if (existing) {
      if (existing.isSymbolicLink() && readlinkSync(target) === desired) continue;
      preserved.push(path.relative(root, target));
      continue;
    }
    symlinkSync(desired, target);
  }
  return preserved;
}

function readFileNames(directory) {
  return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

function excludeLocalState(root) {
  const exclude = path.resolve(root, run('git', ['rev-parse', '--git-path', 'info/exclude'], { cwd: root }));
  ensureDir(exclude, true);
  const current = existsSync(exclude) ? readFileSync(exclude, 'utf8') : '';
  if (!/^\.riff-state\/$/m.test(current)) appendFileSync(exclude, `${current && !current.endsWith('\n') ? '\n' : ''}# RIFF worktree-local state\n.riff-state/\n`);
}

function syncManaged(root, options = {}) {
  const files = pathsFor(root);
  ensureFrameworkLink(root);
  excludeLocalState(root);
  ensureDir(files.riff);
  ensureDir(files.receipts);
  ensureDir(path.dirname(files.hooks));
  let config = readJson(files.config, false);
  if (!config) {
    config = {
      version: 1,
      language: options.language ?? 'en',
      preferences: { explanation: 'plain', autonomy: 'loop' },
      notifications: { channel: 'codex' },
      hooks: { approvedHash: null },
      managed: {},
    };
  }
  if (config.version !== 1) throw new Error('unsupported .riff/config.json version');
  const existingHooks = readJson(files.hooks, false);
  const projectCli = '$(git rev-parse --show-toplevel)/.riff/bin/riff.mjs';
  const merged = mergeHooks(existingHooks, projectCli);
  writeJson(files.hooks, merged);
  const currentHash = hooksHash(merged);
  const preservedSkills = exposeSkills(root);
  config.managed = { ...(config.managed ?? {}), version: VERSION, pluginRoot: PLUGIN_ROOT, cli: '.riff/bin/riff.mjs', hooksHash: currentHash, preservedSkills };
  config.hooks ??= { approvedHash: null };
  if (config.hooks.approvedHash !== currentHash) config.hooks.approvedHash = null;
  if (options.recordApproval) config.hooks.approvedHash = currentHash;
  if (options.language) config.language = options.language;
  writeJson(files.config, config);
  if (!existsSync(files.state)) writeJson(files.state, baseState());
  if (!existsSync(files.events)) writeFileSync(files.events, '');
  installGitHook(root, 'pre-commit');
  installGitHook(root, 'commit-msg');
  event(root, options.resync ? 'resync' : 'init', { version: VERSION, hooks_hash: currentHash });
  return { config, hooks: merged };
}

function parseOptions(tokens) {
  const options = { _: [] };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) { options._.push(token); continue; }
    const key = token.slice(2).replaceAll('-', '_');
    const value = tokens[index + 1];
    if (!value || value.startsWith('--')) options[key] = true;
    else { options[key] = value; index += 1; }
  }
  return options;
}

function cmdInit(tokens) {
  const options = parseOptions(tokens);
  const candidate = path.resolve(options.project_root ?? process.cwd());
  const root = gitRoot(candidate);
  if (root !== candidate) fail(`--project-root must be the Git root (${root})`);
  try {
    syncManaged(root, { language: options.language, recordApproval: options.record_hooks_approved });
  } catch (error) { fail(error.message); }
  process.stdout.write(`RIFF ${VERSION} initialized in ${root}\nFramework: .riff -> ${PLUGIN_ROOT}\nSkills: symlinked into .agents/skills; the native plugin supplies the $riff:* namespace.\nState: project-local in .riff-state/.\nHooks: installed in .codex/hooks.json and chained with existing Git hooks.\nRequired: open /hooks in Codex, review the local hooks, then run riff-codex doctor --record-hooks-approved.\nNo Claude files were created.\n`);
}

function cmdResync(tokens) {
  const options = parseOptions(tokens);
  const root = gitRoot(options.project_root ?? process.cwd());
  try { syncManaged(root, { resync: true, recordApproval: options.record_hooks_approved }); }
  catch (error) { fail(error.message); }
  process.stdout.write('RIFF managed files repaired. Foreign hook entries and chained Git hooks were preserved.\nRun /hooks if the managed hook hash changed.\n');
}

function readRoadmap(root) {
  const file = pathsFor(root).roadmap;
  const roadmap = readJson(file);
  if (roadmap.version !== 1 || !roadmap.project || !Array.isArray(roadmap.phases)) throw new Error('ROADMAP.yaml must be JSON-formatted YAML with version, project, and phases');
  const phases = roadmap.phases.map((phase) => ({
    id: String(phase.id ?? ''),
    title: String(phase.title ?? ''),
    outcome: String(phase.outcome ?? ''),
    demo: String(phase.demo ?? ''),
    depends_on: Array.isArray(phase.depends_on) ? phase.depends_on.map(String) : [],
    blocking_edges: Array.isArray(phase.blocking_edges) ? phase.blocking_edges.map(String) : [],
    risks: Array.isArray(phase.risks) ? phase.risks.map(String) : [],
    sensitive: Boolean(phase.sensitive || SENSITIVE_WORDS.test(`${phase.title} ${phase.outcome} ${(phase.risks ?? []).join(' ')}`)),
    status: phase.status ?? 'ready',
  }));
  validateState({ version: 1, phases });
  return { ...roadmap, phases };
}

function syncRoadmap(root) {
  const roadmap = readRoadmap(root);
  const state = readState(root);
  const old = new Map(state.phases.map((phase) => [phase.id, phase]));
  state.project = { name: roadmap.project.name ?? null, objective: roadmap.project.objective ?? null };
  state.roadmap = { source: 'ROADMAP.yaml', out_of_scope: roadmap.out_of_scope ?? [] };
  state.phases = roadmap.phases.map((phase) => {
    const prior = old.get(phase.id);
    return prior ? { ...phase, status: prior.status, commit: prior.commit ?? null, attempts: prior.attempts ?? 0, reason: prior.reason ?? null } : { ...phase, commit: null, attempts: 0, reason: null };
  });
  validateState(state);
  saveState(root, state);
  event(root, 'roadmap_synced', { phases: state.phases.length });
  return state;
}

function dependenciesComplete(state, phase) {
  const byId = new Map(state.phases.map((item) => [item.id, item]));
  return (phase.depends_on ?? []).every((id) => byId.get(id)?.status === 'completed');
}

function selectPhase(state, requested) {
  const active = state.phases.find((phase) => phase.status === 'active');
  if (active) {
    if (requested && requested !== active.id) throw new Error(`phase ${active.id} is active; resume or park it first`);
    return active;
  }
  if (requested) {
    const phase = state.phases.find((item) => item.id === requested);
    if (!phase) throw new Error(`unknown phase ${requested}`);
    if (phase.status !== 'ready' || !dependenciesComplete(state, phase)) throw new Error(`phase ${requested} is not ready`);
    return phase;
  }
  return state.phases.find((phase) => phase.status === 'ready' && dependenciesComplete(state, phase)) ?? null;
}

function candidateTree(root) {
  try { return run('git', ['write-tree'], { cwd: root }); }
  catch { throw new Error('stage the complete candidate before recording validation or review'); }
}

function optionRequired(options, name) {
  if (!options[name]) throw new Error(`--${name.replaceAll('_', '-')} is required`);
  return options[name];
}

function phaseById(state, id) {
  const phase = state.phases.find((item) => item.id === id);
  if (!phase) throw new Error(`unknown phase ${id}`);
  return phase;
}

function markPhase(root, state, phase, status, reason = null) {
  phase.status = status;
  phase.reason = reason;
  state.activeWave = status === 'active' ? { phase: phase.id, startedAt: state.activeWave?.startedAt ?? now(), checkpointAt: now() } : null;
  if (status === 'awaiting_human' || status === 'blocked' || status === 'parked') {
    state.humanAction = { phase: phase.id, status, reason: reason ?? 'Human attention is required.' };
  } else if (state.humanAction?.phase === phase.id) state.humanAction = null;
  saveState(root, state);
  event(root, `phase_${status}`, { phase: phase.id, reason });
}

function parseSeverity(value = 'INFO') {
  const severity = String(value).toUpperCase();
  if (!['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity)) throw new Error(`invalid severity ${value}`);
  return severity;
}

function recordReview(root, state, phase, options) {
  const type = optionRequired(options, 'type');
  if (!['functional', 'security'].includes(type)) throw new Error('--type must be functional or security');
  const status = optionRequired(options, 'status');
  if (!['pass', 'fail'].includes(status)) throw new Error('--status must be pass or fail');
  const severity = type === 'security' ? parseSeverity(options.severity) : null;
  const receipt = {
    version: 1,
    phase: phase.id,
    type,
    status,
    severity,
    candidate: options.candidate ?? candidateTree(root),
    summary: optionRequired(options, 'summary'),
    what_could_happen: options.what_could_happen ?? null,
    affected: options.affected ?? null,
    recommended_fix: options.recommended_fix ?? null,
    decision_reason: options.decision_reason ?? null,
    reviewedAt: now(),
    model: options.model ?? null,
    reasoning: options.reasoning ?? null,
  };
  if (type === 'security' && status === 'fail') {
    for (const field of ['what_could_happen', 'affected', 'recommended_fix', 'decision_reason']) {
      if (!receipt[field]) throw new Error(`security failures require --${field.replaceAll('_', '-')}`);
    }
  }
  writeJson(path.join(pathsFor(root).receipts, `${phase.id}-${type}.json`), receipt);
  state.reviews[type] = receipt;
  if (options.model) state.model = { name: options.model, reasoning: options.reasoning ?? null, fast_available: options.fast_available === 'true' };
  if (type === 'security' && status === 'fail') {
    state.securityFindings.push(receipt);
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      markPhase(root, state, phase, 'parked', receipt.decision_reason);
      return receipt;
    }
  }
  saveState(root, state);
  event(root, `${type}_review`, { phase: phase.id, status, severity, candidate: receipt.candidate, summary: receipt.summary });
  return receipt;
}

function receiptFor(root, phase, type) {
  return readJson(path.join(pathsFor(root).receipts, `${phase.id}-${type}.json`), false);
}

function cmdWave(tokens) {
  const root = gitRoot();
  const action = tokens[0] ?? 'select';
  const options = parseOptions(tokens.slice(1));
  let state;
  try { state = readState(root); } catch (error) { fail(`${error.message}; run riff-codex init`); }
  try {
    if (action === 'sync') {
      state = syncRoadmap(root);
      process.stdout.write(`${state.phases.length} roadmap phases synchronized.\n`);
      return;
    }
    if (action === 'select' || action === 'resume') {
      const requested = options._[0];
      const phase = selectPhase(state, requested);
      if (!phase) {
        const unfinished = state.phases.filter((item) => item.status !== 'completed');
        process.stdout.write(unfinished.length ? 'No phase is ready. Inspect parked, blocked, or dependency-waiting phases.\n' : 'Roadmap complete.\n');
        return;
      }
      process.stdout.write(`${JSON.stringify(phase, null, 2)}\n`);
      return;
    }
    const id = options._[0];
    if (!id) throw new Error(`riff-codex wave ${action} requires a phase id`);
    const phase = phaseById(state, id);
    if (action === 'activate') {
      const selected = selectPhase(state, id);
      markPhase(root, state, selected, 'active');
      process.stdout.write(`Activated ${id}.\n`);
    } else if (['park', 'block', 'await'].includes(action)) {
      const status = action === 'park' ? 'parked' : action === 'block' ? 'blocked' : 'awaiting_human';
      markPhase(root, state, phase, status, optionRequired(options, 'reason'));
      process.stdout.write(`${id} is ${status}.\n`);
    } else if (action === 'retry') {
      if ((phase.attempts ?? 0) >= 1) throw new Error('the single targeted correction has already been used; park the phase');
      phase.attempts = 1;
      saveState(root, state);
      event(root, 'targeted_retry', { phase: id, reason: optionRequired(options, 'reason') });
      process.stdout.write(`Recorded the one targeted correction for ${id}.\n`);
    } else if (action === 'validate') {
      const status = optionRequired(options, 'status');
      if (!['pass', 'fail'].includes(status)) throw new Error('--status must be pass or fail');
      state.lastValidation = { phase: id, status, command: optionRequired(options, 'command'), summary: optionRequired(options, 'summary'), candidate: options.candidate ?? null, at: now() };
      saveState(root, state);
      event(root, 'validation', state.lastValidation);
      process.stdout.write(`Validation ${status} recorded for ${id}.\n`);
    } else if (action === 'review') {
      const receipt = recordReview(root, state, phase, options);
      process.stdout.write(`${receipt.type} review ${receipt.status} recorded for ${id} at ${receipt.candidate}.\n`);
    } else if (action === 'complete') {
      const commit = optionRequired(options, 'commit');
      const commitTree = run('git', ['rev-parse', `${commit}^{tree}`], { cwd: root });
      const functional = receiptFor(root, phase, 'functional');
      const security = receiptFor(root, phase, 'security');
      if (!functional || functional.status !== 'pass' || functional.candidate !== commitTree) throw new Error('a passing functional receipt for the exact commit tree is required');
      if (phase.sensitive && (!security || security.status !== 'pass' || security.candidate !== commitTree)) throw new Error('a passing security receipt for the exact sensitive commit tree is required');
      phase.commit = run('git', ['rev-parse', commit], { cwd: root });
      phase.status = 'completed';
      phase.reason = null;
      state.lastCommit = phase.commit;
      state.activeWave = null;
      state.humanAction = null;
      state.validationNeeds = [];
      saveState(root, state);
      event(root, 'phase_completed', { phase: id, commit: phase.commit });
      const next = selectPhase(state);
      process.stdout.write(`${id} completed at ${phase.commit.slice(0, 12)}.\n${next ? `Next ready: ${next.id}\n` : 'No further phase is ready.\n'}`);
    } else throw new Error(`unknown wave action: ${action}`);
  } catch (error) { fail(error.message); }
}

function configDisablesHooks(file) {
  if (!existsSync(file)) return false;
  const text = readFileSync(file, 'utf8');
  const section = text.match(/\[features\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? '';
  return /^\s*(?:hooks|codex_hooks)\s*=\s*false\s*$/m.test(section);
}

function executable(name) {
  return spawnSync(name, ['--version'], { stdio: 'ignore' }).status === 0;
}

function doctor(root, recordApproval = false) {
  const files = pathsFor(root);
  const results = [];
  const add = (status, name, detail) => results.push({ status, name, detail });
  let config = null;
  let state = null;
  try { config = readJson(files.config); if (config.version !== 1) throw new Error('unsupported version'); add('ok', 'configuration', 'schema version 1'); }
  catch (error) { add('error', 'configuration', error.message); }
  try { state = readJson(files.state); validateState(state); add('ok', 'state', `${state.phases.length} phases`); }
  catch (error) { add('error', 'state', error.message); }
  if (existsSync(files.roadmap)) {
    try { const roadmap = readRoadmap(root); add('ok', 'roadmap', `${roadmap.phases.length} phases parse correctly`); }
    catch (error) { add('error', 'roadmap', error.message); }
  } else add('ok', 'roadmap', 'not created yet; run $riff:start');
  let hooks = null;
  try {
    hooks = readJson(files.hooks);
    const count = Object.values(hooks.hooks ?? {}).flat().flatMap((group) => group.hooks ?? []).filter((hook) => String(hook.command ?? '').includes('riff-hook:')).length;
    if (count < 6) throw new Error(`only ${count}/6 RIFF hook groups found`);
    add('ok', 'Codex hooks', `${count} managed groups installed`);
  } catch (error) { add('error', 'Codex hooks', error.message); }
  const codexHome = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(homedir(), '.codex');
  const disabledAt = [path.join(root, '.codex', 'config.toml'), path.join(codexHome, 'config.toml')].find(configDisablesHooks);
  if (disabledAt) add('error', 'hook feature', `disabled in ${disabledAt}`); else add('ok', 'hook feature', 'not disabled in project or user config');
  if (config && hooks) {
    const currentHash = hooksHash(hooks);
    if (recordApproval) { config.hooks ??= {}; config.hooks.approvedHash = currentHash; writeJson(files.config, config); }
    if (config.hooks?.approvedHash === currentHash) add('ok', 'hook approval', 'recorded for the current hook hash');
    else add('warn', 'hook approval', 'pending or changed; review with /hooks, then run riff-codex doctor --record-hooks-approved');
  }
  try {
    const framework = lstatSync(files.framework);
    const resolved = path.resolve(root, readlinkSync(files.framework));
    if (!framework.isSymbolicLink() || resolved !== PLUGIN_ROOT) throw new Error(`expected .riff -> ${PLUGIN_ROOT}`);
    add('ok', 'framework symlink', `.riff -> ${PLUGIN_ROOT}`);
  } catch (error) { add('error', 'framework symlink', error.message); }
  for (const name of readFileNames(path.join(PLUGIN_ROOT, 'skills'))) {
    const target = path.join(root, '.agents', 'skills', name);
    let valid = false;
    try { valid = lstatSync(target).isSymbolicLink() && path.resolve(path.dirname(target), readlinkSync(target)) === path.join(root, '.riff', 'skills', name); } catch { /* missing */ }
    if (!valid) add('warn', `skill ${name}`, 'project symlink missing or preserved because a foreign entry owns the path');
  }
  for (const name of ['git', 'node']) add(executable(name) ? 'ok' : 'error', `executable ${name}`, executable(name) ? 'available' : 'missing');
  for (const name of ['pre-commit', 'commit-msg']) {
    const target = path.join(gitHooksDir(root), name);
    const valid = existsSync(target) && readFileSync(target, 'utf8').includes('# RIFF managed wrapper');
    add(valid ? 'ok' : 'error', `Git ${name}`, valid ? 'installed and chained' : 'missing RIFF wrapper');
  }
  try { dashboardData(root); add('ok', 'dashboard state', 'readable'); }
  catch (error) { add('error', 'dashboard state', error.message); }
  const interrupted = state?.phases.find((phase) => phase.status === 'active');
  if (interrupted) add('warn', 'resumable wave', `${interrupted.id} is active and can be resumed`);
  else add('ok', 'resumable wave', 'none');
  return results;
}

function cmdDoctor(tokens) {
  const options = parseOptions(tokens);
  const root = gitRoot();
  const results = doctor(root, Boolean(options.record_hooks_approved));
  for (const result of results) process.stdout.write(`${result.status.toUpperCase().padEnd(5)} ${result.name}: ${result.detail}\n`);
  const errors = results.filter((item) => item.status === 'error').length;
  const warnings = results.filter((item) => item.status === 'warn').length;
  process.stdout.write(`\n${errors} error(s), ${warnings} warning(s).\n`);
  process.exitCode = errors ? 1 : 0;
}

function recentEvents(root, limit = 20) {
  const file = pathsFor(root).events;
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-limit).map((line) => {
    try { return JSON.parse(line); } catch { return { type: 'malformed_event', raw: line }; }
  }).reverse();
}

function receiptValidity(root, phase, receipt) {
  if (!receipt) return null;
  try {
    const expected = phase?.status === 'completed' && phase.commit
      ? run('git', ['rev-parse', `${phase.commit}^{tree}`], { cwd: root })
      : candidateTree(root);
    return receipt.candidate === expected;
  } catch { return false; }
}

function dashboardData(root) {
  const state = readState(root);
  let gitCommit = null;
  try { gitCommit = run('git', ['log', '-1', '--format=%H %s'], { cwd: root }); } catch { /* no commits */ }
  const ready = state.phases.filter((phase) => phase.status === 'ready' && dependenciesComplete(state, phase));
  const phases = Object.fromEntries([...PHASE_STATES].map((status) => [status, state.phases.filter((phase) => phase.status === status)]));
  const functional = state.reviews.functional;
  const security = state.reviews.security;
  return {
    version: VERSION,
    project: state.project,
    progress: { completed: phases.completed.length, total: state.phases.length },
    activeWave: state.activeWave,
    phases,
    nextReady: ready[0] ?? null,
    lastCommit: state.lastCommit ?? gitCommit,
    lastValidation: state.lastValidation,
    reviews: {
      functional: functional ? { ...functional, valid: receiptValidity(root, phaseById(state, functional.phase), functional) } : null,
      security: security ? { ...security, valid: receiptValidity(root, phaseById(state, security.phase), security) } : null,
    },
    securityFindings: state.securityFindings.slice(-10),
    humanAction: state.humanAction,
    events: recentEvents(root),
    model: state.model,
    validationNeeds: state.validationNeeds,
  };
}

function dashboardHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>RIFF dashboard</title><style>
:root{color-scheme:dark;--bg:#0a1012;--panel:#121b1e;--line:#26363b;--ink:#eef7f5;--muted:#91a7a5;--teal:#54d4c4;--amber:#f0c86a;--red:#ff7a7a}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#153034 0,#0a1012 44%);color:var(--ink);font:15px/1.5 ui-sans-serif,system-ui;padding:32px}main{max-width:1180px;margin:auto}h1{font-size:32px;margin:0}.eyebrow{color:var(--teal);letter-spacing:.16em;text-transform:uppercase;font-size:12px}.goal{color:var(--muted);font-size:18px;margin:6px 0 24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.card{background:color-mix(in srgb,var(--panel) 92%,transparent);border:1px solid var(--line);border-radius:14px;padding:18px}.wide{grid-column:1/-1}.metric{font-size:28px;font-weight:700}.bar{height:9px;background:#233034;border-radius:9px;overflow:hidden}.bar span{display:block;height:100%;background:var(--teal)}h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 12px}ul{padding-left:18px;margin:0}.pill{display:inline-block;padding:3px 9px;border:1px solid var(--line);border-radius:99px;margin:2px;color:var(--muted)}.warn{color:var(--amber)}.danger{color:var(--red)}pre{white-space:pre-wrap;color:var(--muted)}@media(max-width:600px){body{padding:18px}}
</style></head><body><main id="app">Loading RIFF…</main><script>
const esc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const list=a=>a?.length?'<ul>'+a.map(x=>'<li>'+esc(x.title??x.summary??x.type??x)+'</li>').join('')+'</ul>':'<span class="pill">None</span>';
const card=(title,body,wide=false)=>'<section class="card '+(wide?'wide':'')+'"><h2>'+title+'</h2>'+body+'</section>';
async function render(){const d=await fetch('/api/state',{cache:'no-store'}).then(r=>r.json());const pct=d.progress.total?Math.round(100*d.progress.completed/d.progress.total):0;const h=[];h.push('<div class="eyebrow">RIFF '+esc(d.version)+'</div><h1>'+esc(d.project.name||'Unshaped project')+'</h1><div class="goal">'+esc(d.project.objective||'Run $riff:start to define the product.')+'</div><div class="grid">');h.push(card('Roadmap','<div class="metric">'+d.progress.completed+'/'+d.progress.total+'</div><div class="bar"><span style="width:'+pct+'%"></span></div><p>'+pct+'% complete</p>'));h.push(card('Active wave','<div class="metric">'+esc(d.activeWave?.phase||'None')+'</div><p>Next ready: '+esc(d.nextReady?.id||'None')+'</p>'));h.push(card('Last evidence','<p>Commit: '+esc(d.lastCommit||'None')+'</p><p>Validation: '+esc(d.lastValidation?.status||'None')+' '+esc(d.lastValidation?.summary||'')+'</p><p>Functional review: '+esc(d.reviews.functional?.status||'None')+(d.reviews.functional&&!d.reviews.functional.valid?' <span class="danger">stale</span>':'')+'</p>'));h.push(card('Model routing','<p>'+esc(d.model?.name||'Not recorded')+'</p><p>'+esc(d.model?.reasoning||'')+(d.model?' · Fast '+(d.model.fast_available?'available':'unavailable'):'')+'</p>'));h.push(card('Completed',list(d.phases.completed)));h.push(card('Ready',list(d.phases.ready)));h.push(card('Parked and blocked',list([...(d.phases.parked||[]),...(d.phases.blocked||[])])));h.push(card('Human action','<p class="'+(d.humanAction?'warn':'')+'">'+esc(d.humanAction?.reason||'None')+'</p>'));const findings=d.securityFindings.length?d.securityFindings.map(f=>'<p class="'+(['HIGH','CRITICAL'].includes(f.severity)?'danger':'warn')+'"><strong>'+esc(f.severity)+'</strong> '+esc(f.summary)+'<br>Could happen: '+esc(f.what_could_happen)+'<br>Affected: '+esc(f.affected)+'<br>Fix: '+esc(f.recommended_fix)+'<br>Decision: '+esc(f.decision_reason)+'</p>').join(''):'<p>None</p>';h.push(card('Security findings',findings,true));h.push(card('Recent wave and hook events','<pre>'+esc(d.events.map(e=>(e.at||'')+' '+e.type+' '+(e.phase||e.tool||'')).join('\\n')||'None')+'</pre>',true));h.push('</div>');document.querySelector('#app').innerHTML=h.join('')}
render();setInterval(render,2500);
</script></body></html>`;
}

function cmdDashboard(tokens) {
  const options = parseOptions(tokens);
  const root = gitRoot();
  if (options.snapshot || options.check) {
    try {
      const data = dashboardData(root);
      if (options.check) process.stdout.write('Dashboard state is readable.\n');
      else process.stdout.write(`${data.project.name ?? 'Unshaped project'}\nProgress: ${data.progress.completed}/${data.progress.total}\nActive: ${data.activeWave?.phase ?? 'none'}\nNext ready: ${data.nextReady?.id ?? 'none'}\nHuman action: ${data.humanAction?.reason ?? 'none'}\n`);
    } catch (error) { fail(error.message); }
    return;
  }
  const port = Number(options.port ?? 7337);
  const server = createServer((request, response) => {
    try {
      if (request.url === '/api/state') {
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        response.end(JSON.stringify(dashboardData(root)));
      } else {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(dashboardHtml());
      }
    } catch (error) {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: error.message }));
    }
  });
  server.listen(port, '127.0.0.1', () => process.stdout.write(`RIFF dashboard: http://127.0.0.1:${port}\nRead-only; press Ctrl-C to stop.\n`));
}

function changedFiles(root, payload, staged = false) {
  const files = new Set();
  const command = String(payload?.tool_input?.command ?? '');
  for (const match of command.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) files.add(match[1].trim());
  try {
    const args = staged ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR'] : ['status', '--porcelain=v1'];
    const output = run('git', args, { cwd: root });
    for (const line of output.split('\n').filter(Boolean)) files.add(staged ? line : line.slice(3));
  } catch { /* hook remains advisory */ }
  return [...files].map((file) => path.resolve(root, file)).filter((file) => file.startsWith(`${root}${path.sep}`) && existsSync(file) && statSync(file).isFile());
}

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk|rk|pk)-(?:live|prod)-[A-Za-z0-9_-]{16,}\b/,
  /\bsk-proj-[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];

function scanFile(file) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { return []; }
  const relative = path.basename(file);
  const findings = [];
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) findings.push({ kind: 'secret', severity: 'HIGH', summary: `A likely production secret is present in ${relative}.` });
  if (/migrations?|\.sql$/i.test(file) && /\b(?:DROP\s+(?:TABLE|COLUMN|SCHEMA)|TRUNCATE|DELETE\s+FROM)\b/i.test(text)) findings.push({ kind: 'destructive_migration', severity: 'HIGH', summary: `A destructive database operation is present in ${relative}.` });
  const isRoute = /(?:route|api|handler|controller)/i.test(file) && /\.(?:[cm]?[jt]sx?|py|go|rs)$/.test(file);
  if (isRoute && /(?:GET|POST|PUT|PATCH|DELETE|handler|router)/.test(text) && !/(?:auth|session|currentUser|userId|public|anonymous)/i.test(text)) findings.push({ kind: 'route_auth', severity: 'MEDIUM', summary: `${relative} looks like a route without an explicit authentication decision.` });
  if (isRoute && /(?:params\.|searchParams|req\.query|request\.json|req\.body)/.test(text) && /(?:findUnique|findFirst|select|where)/.test(text) && !/(?:userId|ownerId|tenantId|session\.user|currentUser)/.test(text)) findings.push({ kind: 'idor', severity: 'MEDIUM', summary: `${relative} uses an external identifier without visible user or tenant scoping.` });
  if (isRoute && /(?:request\.json|formData|req\.body|JSON\.parse)/.test(text) && !/(?:safeParse|\.parse\(|validate\(|Joi\.|valibot|typebox)/.test(text)) findings.push({ kind: 'input_validation', severity: 'MEDIUM', summary: `${relative} reads user input without visible schema validation.` });
  if (/(?:\/\/|#|\/\*)\s*TODO\b/.test(text) && !/(?:TODO[^\n]*(?:#[0-9]+|[A-Z]+-[0-9]+|seed\(|\.md))/i.test(text)) findings.push({ kind: 'todo_without_reference', severity: 'LOW', summary: `${relative} contains a TODO without an issue or artifact reference.` });
  return findings;
}

function orphanFinding(root, file) {
  const relative = path.relative(root, file).replaceAll(path.sep, '/');
  const base = path.basename(file);
  if (!/\.(?:[cm]?[jt]sx?)$/.test(file)) return null;
  if (/(?:^|\/)(?:index|routes?|pages?|app|scripts?|migrations?|seeds?|fixtures?|__tests__)(?:\/|\.)|\.(?:test|spec|config|d)\./i.test(relative)) return null;
  let added = false;
  try { added = /^(?:\?\?|A | A)/.test(run('git', ['status', '--short', '--', relative], { cwd: root })); } catch { /* advisory */ }
  if (!added) return null;
  const moduleName = base.replace(/\.[^.]+$/, '');
  try {
    const references = run('git', ['grep', '-l', `from.*${moduleName}`, '--', '*.js', '*.jsx', '*.ts', '*.tsx'], { cwd: root })
      .split('\n').filter((entry) => entry && entry !== relative);
    if (references.length) return null;
  } catch { /* no references */ }
  return { kind: 'orphan_file', severity: 'LOW', summary: `${base} is newly added but is not visibly imported or routed.` };
}

function plainFinding(finding) {
  if (finding.kind === 'secret') return { ...finding, what_could_happen: 'Someone could use the exposed credential to access a service.', affected: 'The service account and any data it can reach.', recommended_fix: 'Remove and rotate the credential, then use an approved secret store.', decision_reason: 'RIFF stops because the credential pattern is high confidence.' };
  if (finding.kind === 'destructive_migration') return { ...finding, what_could_happen: 'The migration could permanently delete production data.', affected: 'Users whose records are stored in the changed tables.', recommended_fix: 'Use a reviewed expand-and-contract migration or obtain explicit destructive approval.', decision_reason: 'RIFF stops because the destructive SQL is explicit.' };
  if (finding.kind === 'orphan_file') return { ...finding, what_could_happen: 'The new code may never run because nothing connects it to the application.', affected: 'Users expecting the new behavior.', recommended_fix: 'Wire the file into an entry point or remove it if it is unnecessary.', decision_reason: 'RIFF continues because framework routing can make this heuristic incomplete.' };
  if (finding.kind === 'todo_without_reference') return { ...finding, what_could_happen: 'Required follow-up work may be forgotten.', affected: 'The feature or users relying on the unfinished path.', recommended_fix: 'Link the TODO to an issue or durable RIFF artifact.', decision_reason: 'RIFF continues because the TODO does not itself prove unsafe behavior.' };
  return { ...finding, what_could_happen: 'A user may reach data or behavior that was not intended for them.', affected: 'Users and data handled by this boundary.', recommended_fix: 'Review the changed boundary and add the missing explicit control if the warning is valid.', decision_reason: 'RIFF continues because this is a heuristic warning that needs fresh human-readable review.' };
}

function parkForFinding(root, finding) {
  let state;
  try { state = readState(root); } catch { return; }
  const active = state.phases.find((phase) => phase.status === 'active');
  state.securityFindings.push({ ...finding, phase: active?.id ?? null, candidate: null, reviewedAt: now() });
  if (active && ['HIGH', 'CRITICAL'].includes(finding.severity)) {
    active.status = 'parked';
    active.reason = finding.decision_reason;
    state.activeWave = null;
    state.humanAction = { phase: active.id, status: 'parked', reason: finding.decision_reason };
  }
  saveState(root, state);
}

function accumulateValidation(root, files) {
  let state;
  try { state = readState(root); } catch { return; }
  const needs = new Set(state.validationNeeds ?? []);
  if (files.some((file) => /\.(?:[cm]?[jt]sx?|py|go|rs)$/.test(file))) needs.add('targeted behavior check for changed source');
  if (files.some((file) => /(?:package\.json|tsconfig|pyproject|go\.mod|Cargo\.toml)$/.test(file))) needs.add('targeted configuration or type check');
  state.validationNeeds = [...needs];
  saveState(root, state);
}

function preTool(root, payload) {
  const serialized = JSON.stringify(payload.tool_input ?? {});
  const command = String(payload.tool_input?.command ?? serialized);
  const destructive = [
    /\brm\s+-[^\n]*r[^\n]*f[^\n]*(?:\s\/\s|\s~\/?\s|\$HOME|\.\.)/i,
    /\bgit\s+(?:reset\s+--hard|clean\s+-[^\n]*f)/i,
    /\b(?:drop\s+database|truncate\s+table)\b/i,
  ].find((pattern) => pattern.test(command));
  if (destructive) {
    event(root, 'hook_block', { hook: 'destructive_guard', tool: payload.tool_name });
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'RIFF blocked a high-confidence destructive command. It could erase repository or database data. Narrow the target or obtain explicit destructive approval.' } };
  }
  if (SECRET_PATTERNS.some((pattern) => pattern.test(serialized))) {
    event(root, 'hook_block', { hook: 'secret_guard', tool: payload.tool_name });
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'RIFF blocked a likely production credential before it reached the tool. Remove the secret and use an approved secret store.' } };
  }
  const oldRiff = '/Users/webstantly/DEV/frameworks/riff';
  const absolutePaths = [...serialized.matchAll(/\/(?:Users|home|opt|var|tmp)\/[A-Za-z0-9_./ -]+/g)].map((match) => match[0].replace(/["'}\],]+$/, ''));
  const outside = (serialized.includes(oldRiff) && root !== oldRiff) || absolutePaths.some((candidate) => !path.resolve(candidate).startsWith(`${root}${path.sep}`));
  if (outside) {
    event(root, 'hook_warning', { hook: 'boundary', tool: payload.tool_name });
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: serialized.includes(oldRiff) ? 'Boundary warning: this tool references the read-only legacy RIFF repository. Do not modify it, change its branch, or run processes there.' : 'Boundary warning: this tool references a path outside the current Git repository. Confirm that external path is within the user-authorized scope before writing.' } };
  }
  return {};
}

function postTool(root, payload) {
  const files = changedFiles(root, payload);
  accumulateValidation(root, files);
  const findings = [...files.flatMap(scanFile), ...files.map((file) => orphanFinding(root, file)).filter(Boolean)].map(plainFinding);
  for (const finding of findings) {
    event(root, 'hook_finding', { hook: finding.kind, severity: finding.severity, file: finding.summary });
    parkForFinding(root, finding);
  }
  const blocking = findings.find((finding) => ['HIGH', 'CRITICAL'].includes(finding.severity));
  if (blocking) return { decision: 'block', reason: `${blocking.summary} ${blocking.what_could_happen} Affected: ${blocking.affected} Fix: ${blocking.recommended_fix} ${blocking.decision_reason}` };
  if (findings.length) return { systemMessage: `RIFF recorded ${findings.length} focused warning(s). Review the changed boundary before issuing a candidate-bound receipt.`, hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: findings.map((finding) => finding.summary).join(' ') } };
  event(root, 'hook_post_tool', { tool: payload.tool_name, files: files.length });
  return {};
}

function preCommit(root) {
  const payload = { tool_input: { command: '' } };
  const files = changedFiles(root, payload, true);
  const findings = [...files.flatMap(scanFile), ...files.map((file) => orphanFinding(root, file)).filter(Boolean)].map(plainFinding);
  const blocking = findings.find((finding) => ['HIGH', 'CRITICAL'].includes(finding.severity));
  if (blocking) {
    process.stderr.write(`RIFF pre-commit blocked: ${blocking.summary}\nWhat could happen: ${blocking.what_could_happen}\nAffected: ${blocking.affected}\nRecommended fix: ${blocking.recommended_fix}\nWhy RIFF stops: ${blocking.decision_reason}\n`);
    return 1;
  }
  for (const finding of findings) {
    process.stderr.write(`RIFF pre-commit warning: ${finding.summary}\nRecommended check: ${finding.recommended_fix}\nWhy RIFF continues: ${finding.decision_reason}\n`);
    event(root, 'git_pre_commit_warning', { hook: finding.kind, severity: finding.severity, summary: finding.summary });
  }
  let state;
  try { state = readState(root); } catch { return 0; }
  const active = state.phases.find((phase) => phase.status === 'active');
  if (!active) return 0;
  const candidate = candidateTree(root);
  const functional = receiptFor(root, active, 'functional');
  const security = receiptFor(root, active, 'security');
  if (!functional || functional.status !== 'pass' || functional.candidate !== candidate) {
    process.stderr.write('RIFF pre-commit blocked: the active wave needs a fresh passing functional review receipt for this exact staged tree.\n');
    return 1;
  }
  if (active.sensitive && (!security || security.status !== 'pass' || security.candidate !== candidate)) {
    process.stderr.write('RIFF pre-commit blocked: this sensitive wave needs a fresh passing security receipt for this exact staged tree.\n');
    return 1;
  }
  event(root, 'git_pre_commit', { phase: active.id, candidate });
  return 0;
}

function cmdHook(tokens) {
  const name = tokens[0];
  const root = gitRoot();
  if (name === 'git-pre-commit') { process.exitCode = preCommit(root); return; }
  if (name === 'git-commit-msg') {
    const messageFile = tokens.find((token) => !token.startsWith('--') && token !== name);
    const summary = messageFile && existsSync(messageFile) ? readFileSync(messageFile, 'utf8').split('\n')[0].slice(0, 160) : null;
    event(root, 'git_commit_msg', { summary });
    return;
  }
  let payload = {};
  try { payload = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { fail('hook received malformed JSON payload'); }
  try {
    let output = {};
    if (name === 'session-start') {
      const config = readJson(pathsFor(root).config, false);
      const state = readJson(pathsFor(root).state, false);
      event(root, 'hook_session_start', { source: payload.source, model: payload.model });
      const active = state?.phases?.find((phase) => phase.status === 'active');
      const context = [`RIFF language: ${config?.language ?? 'en'}.`, `Preferences: explanation=${config?.preferences?.explanation ?? 'plain'}, autonomy=${config?.preferences?.autonomy ?? 'loop'}.`, 'Use PROJECT.md and ROADMAP.yaml as product sources; use .riff-state/state.json through the riff CLI only.'];
      if (active) context.push(`Resume interrupted phase ${active.id}. Load .riff/references/operating-contract.md before continuing.`);
      output = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context.join(' ') } };
    } else if (name === 'pre-compact') {
      const state = readJson(pathsFor(root).state, false);
      if (state?.activeWave) { state.activeWave.checkpointAt = now(); saveState(root, state); }
      event(root, 'hook_checkpoint', { trigger: payload.trigger, phase: state?.activeWave?.phase ?? null });
    } else if (name === 'pre-tool') output = preTool(root, payload);
    else if (name === 'post-tool') output = postTool(root, payload);
    else if (name === 'stop') {
      const state = readJson(pathsFor(root).state, false);
      event(root, 'hook_stop', { action_required: Boolean(state?.humanAction) });
      if (state?.humanAction) output = { systemMessage: `RIFF needs you: ${state.humanAction.reason}` };
    } else if (name === 'session-end') event(root, 'hook_session_end');
    else throw new Error(`unknown hook ${name}`);
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch (error) { fail(`hook ${name}: ${error.message}`); }
}

function cmdStatus() {
  const data = dashboardData(gitRoot());
  process.stdout.write(`${data.project.name ?? 'Unshaped project'}: ${data.project.objective ?? 'no objective yet'}\n${data.progress.completed}/${data.progress.total} phases completed. Active: ${data.activeWave?.phase ?? 'none'}. Next: ${data.nextReady?.id ?? 'none'}.\nHuman action: ${data.humanAction?.reason ?? 'none'}\n`);
}

function help() {
  process.stdout.write(`RIFF ${VERSION}\n\nUsage:\n  riff-codex init [--project-root PATH] [--language CODE]\n  riff-codex resync [--record-hooks-approved]\n  riff-codex doctor [--record-hooks-approved]\n  riff-codex dashboard [--port 7337|--snapshot|--check]\n  riff-codex status\n  riff-codex wave [select|resume|sync|activate|validate|review|retry|park|block|await|complete] ...\n\nWave state examples:\n  riff-codex wave sync\n  riff-codex wave activate phase-1\n  riff-codex wave validate phase-1 --status pass --command "npm test -- relevant" --summary "Affected behavior passes"\n  riff-codex wave review phase-1 --type functional --status pass --summary "Vertical outcome works"\n  riff-codex wave complete phase-1 --commit HEAD\n\nRIFF never provides a public next command. Selection belongs to wave.\n`);
}

const [command, ...tokens] = process.argv.slice(2);
if (!command || command === '--help' || command === '-h' || command === 'help') help();
else if (command === '--version' || command === '-v') process.stdout.write(`${VERSION}\n`);
else if (command === 'init') cmdInit(tokens);
else if (command === 'resync') cmdResync(tokens);
else if (command === 'doctor') cmdDoctor(tokens);
else if (command === 'dashboard') cmdDashboard(tokens);
else if (command === 'status') cmdStatus();
else if (command === 'wave') cmdWave(tokens);
else if (command === 'hook') cmdHook(tokens);
else if (command === 'next') fail('riff-codex next is intentionally deferred; use $riff:wave or riff-codex wave select');
else fail(`unknown command ${command}; run riff-codex --help`);
