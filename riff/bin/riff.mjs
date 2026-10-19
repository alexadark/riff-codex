#!/usr/bin/env node
import {
  appendFileSync,
  openSync,
  closeSync,
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { CODEX_STATE_DIR, STATE_DIR, inside, localPath, phaseId, stateDirFor, withLock, withFileLock } from '../lib/safety.mjs';
import { verificationEvidence, writeReport } from '../lib/report.mjs';
import { REVIEW_TYPES, buildPrompt, reviewerAvailability, reviewerConfig, runReviewChain, toArtifact } from '../lib/review-bridge.mjs';
import { managedHookPolicy } from '../lib/managed-hooks.mjs';
import { canRunBeside, ownsOverlap, selectParallelBatch, selectReadyPhase } from '../lib/phase-selection.mjs';
import { portAvailable, observationList, reviewObservation } from '../lib/dashboard.mjs';
import { DISCOVERY_MANIFEST, discoverySnapshot } from '../lib/delivery-contract.mjs';
import { loadCatalog, MODES, recommend } from '../lib/model-advice.mjs';
import { recommendPlan } from '../lib/model-advice-plan.mjs';
import { decideImprovement, ideasFile, parseProposals, readIdeas, recordImprovements } from '../lib/improvements.mjs';

const VERSION = '0.4.0';
const SCRIPT = fileURLToPath(import.meta.url);
const PLUGIN_ROOT = path.resolve(path.dirname(SCRIPT), '..');
const FRAMEWORK_DIR = '.riff-cli';
// Names used before the rename. Migrated projects keep them as compatibility links
// so the dashboard, Codex hooks and skill text keep working during the transition.
const CODEX_FRAMEWORK_DIR = '.riff-codex';
const LEGACY_FRAMEWORK_DIR = '.riff';
const LEGACY_STATE_DIR = '.riff-state';
const HOOK_ID = 'riff-codex-hook:';
const LEGACY_HOOK_ID = 'riff-hook:';
// Claude Code reads machine-local project settings; compaction stays above the 300K auto-handoff.
const CLAUDE_SETTINGS = path.join('.claude', 'settings.local.json');
const CLAUDE_COMPACT_WINDOW = 400000;
const CLAUDE_MARKETPLACE = 'riff';
const CLAUDE_PLUGINS = [`riff@${CLAUDE_MARKETPLACE}`, `riff-cockpit@${CLAUDE_MARKETPLACE}`];
// Plugins RIFF once enabled and no longer ships; resync removes them from project settings.
const RETIRED_CLAUDE_PLUGINS = [];
const GIT_HOOK_MARKER = '# RIFF Codex managed wrapper';
const LEGACY_GIT_HOOK_MARKER = '# RIFF managed wrapper';
const PHASE_STATES = new Set(['ready', 'active', 'completed', 'parked', 'blocked', 'awaiting_human', 'skipped']);
const TERMINAL_PHASE_STATES = new Set(['completed', 'skipped']);
const ROADMAP_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const AUTONOMY_MODES = new Set(['loop', 'guided']);
const LOOP_STOP_KINDS = new Set(['credentials-or-access', 'third-party-verification', 'destructive-target', 'validation-failure']);
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

function ensureGitRepository(candidate, allowNonEmpty) {
  if (existsSync(candidate)) {
    try { run('git', ['rev-parse', '--show-toplevel'], { cwd: candidate }); return; } catch {}
    const entries = readdirSync(candidate).filter((name) => name !== '.DS_Store');
    if (entries.length && !allowNonEmpty) fail(`not inside a Git repository: ${candidate}\nRun git init first, or riff init --git-init to create the repository in this folder.`);
  } else mkdirSync(candidate, { recursive: true });
  run('git', ['init', '-q'], { cwd: candidate });
  process.stdout.write(`Created a Git repository in ${candidate}.\n`);
}

function ensureDir(fileOrDir, isFile = false) {
  mkdirSync(isFile ? path.dirname(fileOrDir) : fileOrDir, { recursive: true });
}

function pathExists(target) {
  try { lstatSync(target); return true; } catch { return false; }
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

function frameworkDirFor(root) {
  return stateDirFor(root) === STATE_DIR ? FRAMEWORK_DIR : CODEX_FRAMEWORK_DIR;
}

function pathsFor(root) {
  const state = stateDirFor(root);
  return {
    root,
    framework: path.join(root, frameworkDirFor(root)),
    riff: path.join(root, state),
    config: path.join(root, state, 'config.json'),
    state: path.join(root, state, 'state.json'),
    events: path.join(root, state, 'events.ndjson'),
    receipts: path.join(root, state, 'receipts'),
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
    discovery: null,
    deliveryReview: null,
    updatedAt: null,
  };
}

function event(root, type, data = {}) {
  const files = pathsFor(root);
  localPath(root, files.events);
  ensureDir(files.events, true);
  appendFileSync(files.events, `${JSON.stringify({ at: now(), type, ...data })}\n`);
}

function readState(root) {
  localPath(root, `${stateDirFor(root)}/state.json`);
  const state = readJson(pathsFor(root).state);
  validateState(state);
  return state;
}

function saveState(root, state) {
  localPath(root, `${stateDirFor(root)}/state.json`);
  state.updatedAt = now();
  writeJson(pathsFor(root).state, state);
}

function validateState(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.phases)) throw new Error('state must use RIFF schema version 1');
  const ids = new Set();
  for (const phase of state.phases) {
    phaseId(phase.id);
    if (!phase.id || ids.has(phase.id)) throw new Error(`invalid or duplicate phase id: ${phase.id ?? '<missing>'}`);
    if (!PHASE_STATES.has(phase.status)) throw new Error(`invalid state for ${phase.id}: ${phase.status}`);
    ids.add(phase.id);
  }
  for (const phase of state.phases) {
    for (const dependency of phase.depends_on ?? []) {
      if (!ids.has(dependency)) throw new Error(`${phase.id} depends on unknown phase ${dependency}`);
    }
  }
  const byId = new Map(state.phases.map((phase) => [phase.id, phase]));
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) throw new Error(`dependency cycle detected at phase ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).depends_on ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
}

function quote(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function desiredHooks(script = SCRIPT, host = 'codex') {
  const handler = (name, extra = {}) => ({
    type: 'command',
    command: `/usr/bin/env node ${quote(script)} hook ${name} --id ${HOOK_ID}${name}`,
    timeout: 10,
    ...extra,
  });
  // additionalContextLimit is a Codex field; Claude Code edits through Edit, Write, MultiEdit and NotebookEdit.
  const limit = (size) => (host === 'codex' ? { additionalContextLimit: size } : {});
  const tools = host === 'codex' ? 'Bash|apply_patch|Edit|Write|mcp__.*' : 'Bash|Edit|Write|MultiEdit|NotebookEdit|mcp__.*';
  return {
    SessionStart: [{ matcher: 'startup|resume|clear|compact', hooks: [handler('session-start', { statusMessage: 'Loading RIFF project context', ...limit(800) })] }],
    PreCompact: [{ matcher: 'manual|auto', hooks: [handler('pre-compact', { statusMessage: 'Saving RIFF checkpoint' })] }],
    PreToolUse: [{ matcher: tools, hooks: [handler('pre-tool', { statusMessage: 'Checking RIFF safety boundary' })] }],
    PostToolUse: [{ matcher: tools, hooks: [handler('post-tool', { statusMessage: 'Recording RIFF change signals', ...limit(900) })] }],
    Stop: [{ hooks: [handler('stop', { statusMessage: 'Checking RIFF handoff' })] }],
    SessionEnd: [{ hooks: [handler('session-end', { timeout: 3 })] }],
  };
}

function isLegacyCodexHook(command) {
  return command.includes(LEGACY_HOOK_ID) && command.includes(`/${LEGACY_FRAMEWORK_DIR}/bin/riff.mjs`);
}

function mergeHooks(existing, script = SCRIPT, removeLegacyCodexHooks = false, machineManaged = false, host = 'codex') {
  const result = existing ?? (host === 'codex' ? { description: 'Project-local Codex hooks.' } : {});
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('hooks.json root must be an object');
  if (result.hooks !== undefined && (typeof result.hooks !== 'object' || Array.isArray(result.hooks))) throw new Error('hooks.json hooks must be an object');
  result.hooks ??= {};
  for (const [eventName, groups] of Object.entries(result.hooks)) {
    if (!Array.isArray(groups)) throw new Error(`hooks.${eventName} must be an array`);
    result.hooks[eventName] = groups
      .map((group) => ({
        ...group,
        hooks: (group.hooks ?? []).filter((hook) => {
          const command = String(hook.command ?? '');
          return !command.includes(HOOK_ID) && !(removeLegacyCodexHooks && isLegacyCodexHook(command));
        }),
      }))
      .filter((group) => group.hooks.length > 0);
  }
  for (const [eventName, groups] of Object.entries(machineManaged ? {} : desiredHooks(script, host))) {
    result.hooks[eventName] ??= [];
    result.hooks[eventName].push(...groups);
  }
  if (host === 'codex') result.description ??= 'Project-local Codex hooks.';
  return result;
}

function mergeClaudeSettings(existing, script = SCRIPT) {
  const settings = existing ?? {};
  if (typeof settings !== 'object' || Array.isArray(settings)) throw new Error(`${CLAUDE_SETTINGS} root must be an object`);
  settings.hooks = mergeHooks({ hooks: settings.hooks }, script, false, false, 'claude').hooks;
  settings.autoCompactWindow ??= CLAUDE_COMPACT_WINDOW;
  if (settings.enabledPlugins !== undefined && (typeof settings.enabledPlugins !== 'object' || Array.isArray(settings.enabledPlugins))) throw new Error(`${CLAUDE_SETTINGS} enabledPlugins must be an object`);
  settings.enabledPlugins ??= {};
  for (const plugin of CLAUDE_PLUGINS) settings.enabledPlugins[plugin] ??= true;
  for (const plugin of RETIRED_CLAUDE_PLUGINS) delete settings.enabledPlugins[plugin];
  return settings;
}

function hooksHash(hooks) {
  const managed = [];
  for (const [eventName, groups] of Object.entries(hooks.hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group.hooks ?? []) {
        if (String(hook.command ?? '').includes(HOOK_ID)) managed.push([eventName, group.matcher ?? '', hook]);
      }
    }
  }
  return sha(JSON.stringify(managed));
}

function gitHooksDir(root) {
  const directory = path.resolve(run('git', ['rev-parse', '--path-format=absolute', '--git-path', 'hooks'], { cwd: root }));
  const common = realpathSync(run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root }));
  if (!inside(root, directory) && !inside(common, directory)) throw new Error('Git hooks directory is outside the project and Git common directory');
  localPath(inside(root, directory) ? root : common, directory);
  return directory;
}

// After migration .riff-codex-state links to this checkout's .riff-data; a link elsewhere would split state.
function refuseForeignStateLink(root) {
  const link = path.join(root, CODEX_STATE_DIR);
  if (pathExists(path.join(root, STATE_DIR)) || !pathExists(link) || !lstatSync(link).isSymbolicLink()) return;
  const target = path.resolve(root, readlinkSync(link));
  if (target === path.join(root, STATE_DIR)) return;
  throw new Error(`${CODEX_STATE_DIR} links to ${target}; state shared with another checkout is not supported. Copy that state into this checkout as ${STATE_DIR} or remove the link, then run resync again`);
}

function installationPreflight(root) {
  refuseForeignStateLink(root);
  const directory = gitHooksDir(root);
  for (const name of [stateDirFor(root), '.codex', '.claude', '.agents', '.agents/skills']) {
    const target = localPath(root, name);
    if (existsSync(target) && !statSync(target).isDirectory()) throw new Error(`${name} must be a directory`);
  }
  for (const name of ['pre-commit', 'commit-msg']) {
    const target = path.join(directory, name);
    if (pathExists(target) && (!existsSync(target) || !statSync(target).isFile())) throw new Error(`existing Git hook must resolve to a regular file: ${name}`);
  }
  const common = realpathSync(run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root }));
  const exclude = path.resolve(root, run('git', ['rev-parse', '--git-path', 'info/exclude'], { cwd: root }));
  localPath(inside(root, exclude) ? root : common, exclude);
  for (const name of [stateDirFor(root), '.codex/hooks.json', CLAUDE_SETTINGS, '.agents/skills']) localPath(root, name);
}

function installGitHook(root, name, migration) {
  const directory = gitHooksDir(root);
  ensureDir(directory);
  const target = path.join(directory, name);
  const backupDir = path.join(root, stateDirFor(root), 'git-hooks');
  ensureDir(backupDir);
  let prior = null;
  if (pathExists(target)) {
    const current = readFileSync(target, 'utf8');
    const linked = lstatSync(target).isSymbolicLink();
    const currentIsCodex = !linked && current.includes(GIT_HOOK_MARKER);
    const currentIsLegacyCodex = !linked && (migration.legacyFrameworkOwned || migration.migratedState)
      && current.includes(LEGACY_GIT_HOOK_MARKER)
      && current.includes(`/${LEGACY_FRAMEWORK_DIR}/bin/riff.mjs`);
    if (!currentIsCodex && !currentIsLegacyCodex) {
      const digest = sha(current).slice(0, 12);
      prior = path.join(backupDir, `${name}.${digest}.previous`);
      localPath(root, prior);
      if (!existsSync(prior)) { copyFileSync(target, prior); chmodSync(prior, lstatSync(target).isSymbolicLink() ? statSync(target).mode & 0o777 : lstatSync(target).mode & 0o777); }
    } else {
      const match = current.match(/^# RIFF_CODEX_PREVIOUS_JSON=(.+)$/m) ?? current.match(/^(?:RIFF_CODEX_PREVIOUS|RIFF_PREVIOUS)=(.+)$/m);
      prior = match?.[1] ? JSON.parse(match[1]) : null;
      for (const [migrated, previous] of [[migration.migratedState, LEGACY_STATE_DIR], [migration.migratedCodexState, CODEX_STATE_DIR]]) {
        const legacyPrefix = `${path.join(root, previous)}${path.sep}`;
        if (migrated && typeof prior === 'string' && prior.startsWith(legacyPrefix)) {
          const migratedPrior = path.join(root, STATE_DIR, path.relative(path.join(root, previous), prior));
          if (pathExists(migratedPrior)) prior = migratedPrior;
        }
      }
    }
  }
  const previousLine = `'${String(prior ?? '').replaceAll("'", "'\"'\"'")}'`;
  const arg = name === 'commit-msg' ? ' "$@"' : '';
  const wrapper = `#!/bin/sh\n${GIT_HOOK_MARKER}\n# RIFF_CODEX_PREVIOUS_JSON=${JSON.stringify(prior ?? '')}\nRIFF_CODEX_PREVIOUS=${previousLine}\nif [ -n "$RIFF_CODEX_PREVIOUS" ] && [ -x "$RIFF_CODEX_PREVIOUS" ]; then "$RIFF_CODEX_PREVIOUS" "$@" || exit $?; fi\n/usr/bin/env node "$(git rev-parse --show-toplevel)/${frameworkDirFor(root)}/bin/riff.mjs" hook git-${name}${arg}\n`;
  const temporary = `${target}.riff-${process.pid}`;
  writeFileSync(temporary, wrapper, { flag: 'wx', mode: 0o755 });
  renameSync(temporary, target);
}

function symlinkResolvesTo(link, expected) {
  try {
    return lstatSync(link).isSymbolicLink() && path.resolve(path.dirname(link), readlinkSync(link)) === expected;
  } catch {
    return false;
  }
}

function legacyStateOwnership(root) {
  let config;
  try { config = readJson(path.join(root, LEGACY_STATE_DIR, 'config.json'), false); }
  catch { return { owned: false, preserveHookApproval: false }; }
  const cli = String(config?.managed?.cli ?? '');
  const pluginRoot = config?.managed?.pluginRoot ? path.resolve(String(config.managed.pluginRoot)) : null;
  const owned = cli === `${LEGACY_FRAMEWORK_DIR}/bin/riff.mjs` && pluginRoot === PLUGIN_ROOT;
  const preserveHookApproval = owned
    && typeof config?.hooks?.approvedHash === 'string'
    && config.hooks.approvedHash.length > 0
    && config.hooks.approvedHash === config?.managed?.hooksHash;
  return { owned, preserveHookApproval };
}

function migrateLegacyInstall(root) {
  const legacyFramework = path.join(root, LEGACY_FRAMEWORK_DIR);
  const framework = path.join(root, FRAMEWORK_DIR);
  const legacyState = path.join(root, LEGACY_STATE_DIR);
  const state = path.join(root, STATE_DIR);
  const changes = [];
  const legacyFrameworkOwned = symlinkResolvesTo(legacyFramework, PLUGIN_ROOT);
  const ownership = legacyStateOwnership(root);
  let migratedState = false;

  if (!pathExists(framework) && legacyFrameworkOwned) {
    renameSync(legacyFramework, framework);
    changes.push(`${LEGACY_FRAMEWORK_DIR} -> ${FRAMEWORK_DIR}`);
  } else if (symlinkResolvesTo(framework, PLUGIN_ROOT) && legacyFrameworkOwned) {
    unlinkSync(legacyFramework);
    changes.push(`removed obsolete ${LEGACY_FRAMEWORK_DIR} Codex link`);
  }

  if (!pathExists(state) && !pathExists(path.join(root, CODEX_STATE_DIR)) && pathExists(legacyState) && ownership.owned) {
    if (lstatSync(legacyState).isSymbolicLink()) throw new Error('owned legacy state must be a real directory before migration');
    renameSync(legacyState, state);
    migratedState = true;
    changes.push(`${LEGACY_STATE_DIR} -> ${STATE_DIR}`);
  }
  return {
    changes,
    legacyFrameworkOwned,
    migratedState,
    preserveHookApproval: migratedState && ownership.preserveHookApproval,
  };
}

// Move .riff-codex-state to .riff-data once no phase is running, after a full backup.
// The old name stays as a link to the new directory until every reader uses the new names.
function migrateCodexNames(root, migration) {
  const previous = path.join(root, CODEX_STATE_DIR);
  if (stateDirFor(root) !== CODEX_STATE_DIR) return migration;
  const defer = (reason) => ({ ...migration, deferred: reason });
  const state = readJson(path.join(previous, 'state.json'), false);
  const active = state?.phases?.find((phase) => phase.status === 'active');
  if (active || state?.activeWave) return defer(`phase ${active?.id ?? state.activeWave.phase ?? 'wave'} is active; run resync again after it finishes`);
  if (pathExists(path.join(previous, 'write.lock'))) return defer('another RIFF command holds the state lock');
  if (pathExists(path.join(root, STATE_DIR))) throw new Error(`${STATE_DIR} already exists and is not a directory; preserving it`);
  const config = readJson(path.join(previous, 'config.json'), false);
  const backup = path.join(previous, 'backups', `riff-codex-state-${now().replace(/[:.]/g, '-')}`);
  ensureDir(backup);
  for (const entry of readdirSync(previous)) {
    if (entry !== 'backups') cpSync(path.join(previous, entry), path.join(backup, entry), { recursive: true, verbatimSymlinks: true });
  }
  const hooks = path.join(root, '.codex', 'hooks.json');
  if (existsSync(hooks)) copyFileSync(hooks, path.join(backup, 'codex-hooks.json'));
  renameSync(previous, path.join(root, STATE_DIR));
  symlinkSync(STATE_DIR, previous);
  const approved = config?.hooks?.approvedHash;
  return {
    ...migration,
    changes: [...migration.changes, `${CODEX_STATE_DIR} -> ${STATE_DIR} (backup in ${path.join(STATE_DIR, path.relative(previous, backup))})`],
    migratedCodexState: true,
    preserveHookApproval: migration.preserveHookApproval || (typeof approved === 'string' && approved.length > 0 && approved === config?.managed?.hooksHash),
  };
}

function ensureFrameworkLink(root, name = frameworkDirFor(root)) {
  const target = path.join(root, name);
  if (pathExists(target)) {
    const stat = lstatSync(target);
    if (!stat.isSymbolicLink()) throw new Error(`${name} already exists and is not a symlink; preserving it`);
    let resolved;
    try { resolved = path.resolve(path.dirname(target), readlinkSync(target)); } catch (error) { throw new Error(`cannot read ${name} symlink: ${error.message}`); }
    if (resolved !== PLUGIN_ROOT) throw new Error(`${name} points to ${resolved}; expected permanent RIFF folder ${PLUGIN_ROOT}`);
    return false;
  }
  symlinkSync(path.relative(root, PLUGIN_ROOT), target);
  return true;
}

function ensureCompatibilityLinks(root) {
  // Skills name .riff-cli, so projects that still keep pre-rename state get the link too.
  if (!pathExists(path.join(root, FRAMEWORK_DIR))) ensureFrameworkLink(root, FRAMEWORK_DIR);
  if (stateDirFor(root) !== STATE_DIR) return;
  if (!pathExists(path.join(root, CODEX_FRAMEWORK_DIR))) ensureFrameworkLink(root, CODEX_FRAMEWORK_DIR);
  if (!pathExists(path.join(root, CODEX_STATE_DIR))) symlinkSync(STATE_DIR, path.join(root, CODEX_STATE_DIR));
}

function exposeSkills(root, migration) {
  const source = path.join(PLUGIN_ROOT, 'skills');
  const destination = path.join(root, '.agents', 'skills');
  ensureDir(destination);
  const preserved = [];
  for (const name of readFileNames(source)) {
    const target = path.join(destination, `riff-codex-${name}`);
    const desiredTarget = path.join(root, frameworkDirFor(root), 'skills', name);
    const desired = path.relative(destination, desiredTarget);
    const legacyTarget = path.join(destination, name);
    const legacyDesired = path.relative(destination, path.join(root, LEGACY_FRAMEWORK_DIR, 'skills', name));
    try {
      if (
        lstatSync(legacyTarget).isSymbolicLink()
        && (
          (migration.legacyFrameworkOwned && readlinkSync(legacyTarget) === legacyDesired)
          || path.resolve(path.dirname(legacyTarget), readlinkSync(legacyTarget)) === path.join(PLUGIN_ROOT, 'skills', name)
        )
      ) unlinkSync(legacyTarget);
    } catch { /* missing or foreign legacy skill */ }
    let existing = null;
    try { existing = lstatSync(target); } catch { /* missing */ }
    if (existing) {
      // A link through the pre-rename .riff-codex name still reaches this skill; leave tracked links alone.
      if (existing.isSymbolicLink() && pointsTo(target, path.join(PLUGIN_ROOT, 'skills', name))) continue;
      preserved.push(path.relative(root, target));
      continue;
    }
    symlinkSync(desired, target);
  }
  removeRetiredSkillLinks(destination, new Set(readFileNames(source)));
  return preserved;
}

// Skills merged into others leave links RIFF created; foreign entries are never touched.
function removeRetiredSkillLinks(destination, current) {
  for (const entry of readdirSync(destination)) {
    if (!entry.startsWith('riff-codex-') || current.has(entry.slice('riff-codex-'.length))) continue;
    const link = path.join(destination, entry);
    try {
      if (lstatSync(link).isSymbolicLink() && /(?:^|\/)\.riff-(?:cli|codex)\/skills\/[^/]+$/.test(readlinkSync(link))) unlinkSync(link);
    } catch { /* vanished entry */ }
  }
}

function pointsTo(link, expected) {
  try { return realpathSync(link) === realpathSync(expected); } catch { return false; }
}

function readFileNames(directory) {
  return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

function excludeLocalState(root) {
  const exclude = path.resolve(root, run('git', ['rev-parse', '--git-path', 'info/exclude'], { cwd: root }));
  ensureDir(exclude, true);
  const current = existsSync(exclude) ? readFileSync(exclude, 'utf8') : '';
  const lines = new Set(current.split('\n'));
  // Links are files to Git, so they need bare patterns. Exclusion never hides a tracked link.
  const entries = stateDirFor(root) === STATE_DIR ? [`${STATE_DIR}/`, FRAMEWORK_DIR, CODEX_STATE_DIR, CODEX_FRAMEWORK_DIR] : [`${CODEX_STATE_DIR}/`, FRAMEWORK_DIR];
  // Codex hooks and skill links are machine-local too: they point into this machine's RIFF install.
  const missing = [...entries, '.uxtest/runs/', CLAUDE_SETTINGS, '.codex/hooks.json', '.agents/skills/riff-codex-*'].filter((line) => !lines.has(line));
  if (missing.length) appendFileSync(exclude, `${current && !current.endsWith('\n') ? '\n' : ''}# RIFF worktree-local state\n${missing.join('\n')}\n`);
}

function dashboardRegistryFile() {
  return path.join(homedir(), '.config', 'riff-dashboard', 'registry.json');
}

function registerDashboardProject(root) {
  const file = dashboardRegistryFile();
  return withFileLock(localPath(homedir(), `${file}.lock`), () => {
  const current = readJson(file, false) ?? { version: 1, projects: [], hidden: [] };
  const projects = Array.isArray(current.projects) ? current.projects.filter((item) => typeof item === 'string') : [];
  const hidden = Array.isArray(current.hidden) ? current.hidden.filter((item) => typeof item === 'string' && item !== root) : [];
  if (!projects.includes(root)) projects.push(root);
  writeJson(file, { version: 1, projects, hidden });
  });
}

function syncManaged(root, options = {}) {
  installationPreflight(root);
  const installLock = path.resolve(run('git', ['rev-parse', '--path-format=absolute', '--git-path', 'riff-codex-install.lock'], { cwd: root }));
  const common = realpathSync(run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root }));
  localPath(inside(root, installLock) ? root : common, installLock);
  return withFileLock(installLock, () => {
    const migration = migrateCodexNames(root, migrateLegacyInstall(root));
    return withLock(root, () => syncManagedUnlocked(root, { ...options, migration }));
  });
}

function syncManagedUnlocked(root, options) {
  const migration = options.migration ?? migrateLegacyInstall(root);
  const files = pathsFor(root);
  ensureFrameworkLink(root);
  ensureCompatibilityLinks(root);
  excludeLocalState(root);
  ensureDir(files.riff);
  ensureDir(files.receipts);
  ensureDir(path.dirname(files.hooks));
  let config = readJson(files.config, false);
  if (!config) {
    config = {
      version: 1,
      language: options.language ?? 'en',
      artifactLanguage: options.artifactLanguage ?? 'en',
      project: { scope: options.scope ?? 'production' },
      preferences: { explanation: options.explanation ?? 'simple', autonomy: options.autonomy ?? 'loop' },
      notifications: { channel: 'codex' },
      hooks: { approvedHash: null },
      onboarding: { completedAt: options.configured ? now() : null },
      managed: {},
    };
  }
  if (config.version !== 1) throw new Error(`unsupported ${stateDirFor(root)}/config.json version`);
  config.preferences ??= {};
  if (options.autonomy) config.preferences = { ...config.preferences, autonomy: options.autonomy };
  config.preferences.autonomy ??= 'loop';
  if (!AUTONOMY_MODES.has(config.preferences.autonomy)) throw new Error('autonomy must be loop or guided');
  const existingHooks = readJson(files.hooks, false);
  const projectCli = `$(git rev-parse --show-toplevel)/${frameworkDirFor(root)}/bin/riff.mjs`;
  const systemPolicy = managedHookPolicy(root, PLUGIN_ROOT);
  const merged = mergeHooks(existingHooks, projectCli, migration.legacyFrameworkOwned || migration.migratedState, Boolean(systemPolicy));
  writeJson(files.hooks, merged);
  const currentHash = hooksHash(merged);
  const claudeFile = localPath(root, CLAUDE_SETTINGS);
  ensureDir(claudeFile, true);
  const claudeSettings = mergeClaudeSettings(readJson(claudeFile, false), projectCli);
  writeJson(claudeFile, claudeSettings);
  const preservedSkills = exposeSkills(root, migration);
  config.managed = { ...(config.managed ?? {}), version: VERSION, pluginRoot: PLUGIN_ROOT, cli: `${frameworkDirFor(root)}/bin/riff.mjs`, hooksHash: currentHash, claudeHooksHash: hooksHash(claudeSettings), preservedSkills };
  config.hooks ??= { approvedHash: null };
  config.hooks.source = systemPolicy ? 'system' : 'project';
  if (options.recordApproval || migration.preserveHookApproval) config.hooks.approvedHash = currentHash;
  else if (config.hooks.approvedHash !== currentHash) config.hooks.approvedHash = null;
  if (options.language) config.language = options.language;
  if (options.artifactLanguage) config.artifactLanguage = options.artifactLanguage;
  if (options.scope) config.project = { ...(config.project ?? {}), scope: options.scope };
  if (options.explanation) config.preferences = { ...(config.preferences ?? {}), explanation: options.explanation };
  if (options.configured) config.onboarding = { completedAt: now() };
  writeJson(files.config, config);
  if (!existsSync(files.state)) writeJson(files.state, baseState());
  if (!existsSync(files.events)) writeFileSync(files.events, '');
  installGitHook(root, 'pre-commit', migration);
  installGitHook(root, 'commit-msg', migration);
  registerDashboardProject(root);
  event(root, options.resync ? 'resync' : 'init', { version: VERSION, hooks_hash: currentHash });
  return { config, hooks: merged, migration };
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

async function choose(terminal, prompt, choices, defaultValue) {
  const effectiveDefault = choices.some((choice) => choice.value === defaultValue) ? defaultValue : choices[0].value;
  process.stdout.write(`\n${prompt}\n`);
  choices.forEach((choice, index) => process.stdout.write(`  ${index + 1}. ${choice.label}${choice.value === effectiveDefault ? ' (recommended)' : ''}\n`));
  while (true) {
    const defaultIndex = choices.findIndex((choice) => choice.value === effectiveDefault) + 1;
    const answer = (await terminal.question(`Choice [${defaultIndex}]: `)).trim();
    if (!answer) return effectiveDefault;
    const numeric = Number(answer);
    if (Number.isInteger(numeric) && choices[numeric - 1]) return choices[numeric - 1].value;
    const named = choices.find((choice) => choice.value === answer.toLowerCase());
    if (named) return named.value;
    process.stdout.write('Please enter a listed number or value.\n');
  }
}

async function configureInteractively(existing = {}) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const language = await choose(terminal, 'Conversation language / Langue de conversation', [
      { value: 'fr', label: 'fr, français' },
      { value: 'en', label: 'en, English' },
      { value: 'mix', label: 'mix, follow the user language' },
    ], existing.language ?? 'fr');
    const french = language === 'fr';
    const scope = await choose(terminal, french ? 'Portée du projet' : 'Project scope', [
      { value: 'production', label: french ? 'production, application réelle avec les protections complètes' : 'production, real application with full protections' },
      { value: 'scratch', label: french ? 'scratch, expérimentation locale sans données sensibles' : 'scratch, local experiment without sensitive data' },
    ], existing.project?.scope ?? 'production');
    const artifactLanguage = await choose(terminal, french ? 'Langue du code, des commits et des documents partagés' : 'Language for code, commits, and shared documents', [
      { value: 'en', label: 'en, English' },
      { value: 'fr', label: 'fr, français' },
    ], existing.artifactLanguage ?? 'en');
    const explanation = await choose(terminal, french ? "Niveau d'explication" : 'Explanation level', [
      { value: 'simple', label: french ? 'simple, langage courant' : 'simple, plain language' },
      { value: 'technical', label: french ? 'technical, détails de code et jargon' : 'technical, code details and jargon' },
      { value: 'eli5', label: french ? 'eli5, très accessible et très court' : 'eli5, very accessible and brief' },
    ], existing.preferences?.explanation ?? 'simple');
    const autonomy = await choose(terminal, french ? "Mode d'autonomie" : 'Autonomy mode', [
      { value: 'loop', label: french ? "loop, RIFF continue jusqu'à un vrai blocage" : 'loop, RIFF continues until a real blocker' },
      { value: 'guided', label: french ? 'guided, RIFF demande confirmation entre les phases' : 'guided, RIFF asks between phases' },
    ], existing.preferences?.autonomy ?? 'loop');
    return { language, scope, artifactLanguage, explanation, autonomy, configured: true };
  } finally {
    terminal.close();
  }
}

async function cmdInit(tokens) {
  const options = parseOptions(tokens);
  if (options.autonomy && !AUTONOMY_MODES.has(options.autonomy)) fail('--autonomy must be loop or guided');
  const candidate = path.resolve(options.project_root ?? process.cwd());
  ensureGitRepository(candidate, options.git_init);
  const root = gitRoot(candidate);
  if (root !== candidate) fail(`--project-root must be the Git root (${root})`);
  try { installationPreflight(root); } catch (error) { fail(error.message); }
  const existing = readJson(pathsFor(root).config, false) ?? (legacyStateOwnership(root).owned ? readJson(path.join(root, LEGACY_STATE_DIR, 'config.json'), false) : null) ?? {};
  const needsConfiguration = !existing.onboarding?.completedAt;
  if (options.scope && !['scratch', 'production'].includes(options.scope)) fail('--scope must be scratch or production');
  let configuration = { language: options.language, autonomy: options.autonomy, scope: options.scope };
  if (!options.non_interactive && process.stdin.isTTY && process.stdout.isTTY && (options.configure || needsConfiguration)) {
    process.stdout.write('RIFF project configuration\nPress Enter to accept each recommended choice.\n');
    configuration = await configureInteractively({
      ...existing,
      language: options.language ?? existing.language,
      preferences: { ...(existing.preferences ?? {}), autonomy: options.autonomy ?? existing.preferences?.autonomy },
    });
  }
  try {
    if (existing.project?.scope === 'scratch' && configuration.scope === 'production') throw new Error('use promote for a reviewed scratch-to-production transition');
    const result = syncManaged(root, { ...configuration, recordApproval: options.record_hooks_approved });
    reportMigration(result.migration);
  } catch (error) { fail(error.message); }
  const config = readJson(pathsFor(root).config);
  process.stdout.write(`RIFF ${VERSION} initialized in ${root}\nConfiguration: conversation=${config.language}, artifacts=${config.artifactLanguage ?? 'en'}, scope=${config.project?.scope ?? 'production'}, explanation=${config.preferences?.explanation ?? 'simple'}, autonomy=${config.preferences?.autonomy ?? 'loop'}.\nFramework: ${frameworkDirFor(root)} -> ${PLUGIN_ROOT}\nState: project-local in ${stateDirFor(root)}/.\nProduct artifacts: shared PROJECT.md and ROADMAP.yaml are preserved.\nGit hooks: pre-commit and commit-msg chained with existing hooks.\nClaude Code: hooks, compaction at ${CLAUDE_COMPACT_WINDOW} tokens and the riff plugin in ${CLAUDE_SETTINGS}; skills run as /riff:wave, /riff:start. If riff doctor reports the marketplace missing, run once per machine: claude plugin marketplace add ${PLUGIN_ROOT}\nCodex: hooks in .codex/hooks.json, skills under .agents/skills/riff-codex-* and the $riff:* plugin namespace. ${config.hooks?.source === 'system' ? 'Hooks use the installed system policy; no per-hook approval is required after configuration reload.' : 'Open /hooks in Codex, review the local hooks, then run riff doctor --record-hooks-approved.'}\nPaths and state of the original RIFF framework (.riff, .riff-state) were not created or replaced.\n`);
}

function reportMigration(migration) {
  if (migration.changes.length) process.stdout.write(`Migrated existing RIFF installation: ${migration.changes.join(', ')}.\n`);
  if (migration.deferred) process.stdout.write(`Kept ${CODEX_STATE_DIR}/ for now: ${migration.deferred}.\n`);
}

function cmdResync(tokens) {
  const options = parseOptions(tokens);
  const root = gitRoot(options.project_root ?? process.cwd());
  let result;
  try { result = syncManaged(root, { resync: true, recordApproval: options.record_hooks_approved }); }
  catch (error) { fail(error.message); }
  reportMigration(result.migration);
  process.stdout.write(`RIFF managed files repaired. Foreign hook entries and chained Git hooks were preserved.\n${result.config.hooks?.source === 'system' ? 'System policy selected; no duplicate project hooks or manual approval marker.' : 'Run /hooks if the managed hook hash changed.'}\n`);
}

const PRIORITY_ALIASES = {
  p0: 'P0', critical: 'P0', urgent: 'P0',
  p1: 'P1', high: 'P1',
  p2: 'P2', medium: 'P2', normal: 'P2',
  p3: 'P3', low: 'P3',
};

const STATUS_ALIASES = {
  ready: 'ready', todo: 'ready', pending: 'ready', planned: 'ready',
  active: 'active', 'in-progress': 'active', in_progress: 'active', inprogress: 'active', wip: 'active',
  completed: 'completed', complete: 'completed', done: 'completed', shipped: 'completed',
  skipped: 'skipped', rejected: 'skipped', cancelled: 'skipped', canceled: 'skipped',
  parked: 'parked', blocked: 'blocked', awaiting_human: 'awaiting_human',
};

function normalizeRoadmapPriority(value, required, id) {
  const priority = PRIORITY_ALIASES[String(value ?? '').trim().toLowerCase()] ?? null;
  if (required && !ROADMAP_PRIORITIES.has(priority)) throw new Error(`ROADMAP.yaml phase ${id} requires priority P0, P1, P2, or P3`);
  return priority;
}

function normalizeRoadmapStatus(value, id) {
  const status = STATUS_ALIASES[String(value ?? 'ready').trim().toLowerCase()];
  if (!status) throw new Error(`ROADMAP.yaml phase ${id} has unsupported status ${value}`);
  return status;
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function normalizePhase(id, phase, canonical) {
  const title = String(phase.title ?? phase.name ?? '').trim();
  const outcome = String(phase.outcome ?? phase.description ?? phase.rationale ?? phase.goal ?? '').trim();
  const risks = normalizeStringArray(phase.risks);
  return {
    id,
    title,
    outcome,
    demo: String(phase.demo ?? '').trim(),
    priority: normalizeRoadmapPriority(phase.priority, canonical, id),
    depends_on: normalizeStringArray(phase.depends_on),
    blocking_edges: normalizeStringArray(phase.blocking_edges),
    risks,
    sensitive: Boolean(phase.sensitive || SENSITIVE_WORDS.test(`${title} ${outcome} ${risks.join(' ')}`)),
    verificationRequired: Boolean(phase.smoke_test === true || phase.verification_required || phase.verification?.required || (Array.isArray(phase.mode) ? phase.mode : [phase.mode]).includes('HITL')),
    status: normalizeRoadmapStatus(phase.status, id),
    done_when: normalizeStringArray(phase.done_when),
    verify: normalizeStringArray(phase.verify),
    owns: normalizeStringArray(phase.owns),
  };
}

const NORMALIZED_PLAN_FIELDS = [
  'title',
  'outcome',
  'demo',
  'priority',
  'depends_on',
  'blocking_edges',
  'risks',
  'sensitive',
  'verificationRequired',
];

function normalizedPlan(phase, knownIds) {
  const normalized = normalizePhase(phase.id, phase, false);
  if (Object.hasOwn(phase, 'verificationRequired')) normalized.verificationRequired = Boolean(phase.verificationRequired);
  normalized.depends_on = normalizeStringArray(normalized.depends_on).map((dependency) => {
    if (knownIds.has(dependency)) return dependency;
    const unprefixed = dependency.replace(/^phase-/i, '');
    if (knownIds.has(unprefixed)) return unprefixed;
    const prefixed = `phase-${dependency}`;
    return knownIds.has(prefixed) ? prefixed : dependency;
  });
  return normalized;
}

function normalizeStoredPlanField(field, normalized) {
  if (field === 'depends_on') {
    return normalizeStringArray(normalized[field]);
  }
  if (field === 'blocking_edges' || field === 'risks') return normalizeStringArray(normalized[field]);
  if (field === 'sensitive' || field === 'verificationRequired') return Boolean(normalized[field]);
  return normalized[field];
}

function changedPlanFields(prior, incoming, knownIds) {
  const priorPlan = normalizedPlan(prior, knownIds);
  const incomingPlan = normalizedPlan(incoming, knownIds);
  return NORMALIZED_PLAN_FIELDS.filter((field) => {
    const priorValue = normalizeStoredPlanField(field, priorPlan);
    const incomingValue = normalizeStoredPlanField(field, incomingPlan);
    return JSON.stringify(priorValue) !== JSON.stringify(incomingValue);
  });
}

function phaseIsReferenced(state, id) {
  const records = [
    state.activeWave,
    state.humanAction,
    state.lastValidation,
    state.reviews?.functional,
    state.reviews?.security,
    ...(Array.isArray(state.securityFindings) ? state.securityFindings : []),
  ];
  return records.some((record) => record?.phase === id);
}

function phaseHasReceipt(root, id) {
  return ['functional', 'security'].some((type) => existsSync(localPath(root, path.join(pathsFor(root).receipts, `${phaseId(id)}-${type}.json`))));
}

function phaseHasExecutionHistory(root, state, phase) {
  return phase.status !== 'ready'
    || Number(phase.attempts ?? 0) > 0
    || Boolean(phase.commit || phase.baseCommit || phase.checkpoint || phase.validation || phase.retryCandidate)
    || phaseIsReferenced(state, phase.id)
    || phaseHasReceipt(root, phase.id);
}

function readRoadmap(root) {
  const file = pathsFor(root).roadmap;
  let roadmap;
  try { roadmap = YAML.parse(readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`ROADMAP.yaml cannot be parsed: ${error.message}`); }
  if (!roadmap || typeof roadmap !== 'object' || Array.isArray(roadmap)) throw new Error('ROADMAP.yaml must contain a mapping');

  const canonical = roadmap.version === 1 && roadmap.project && Array.isArray(roadmap.phases);
  const claudeArray = !canonical && Array.isArray(roadmap.phases);
  const legacyEntries = Object.entries(roadmap).filter(([key, value]) => /^phase-[A-Za-z0-9._-]+$/i.test(key) && value && typeof value === 'object' && !Array.isArray(value));
  if (!canonical && !claudeArray && legacyEntries.length === 0) throw new Error('ROADMAP.yaml must contain either version/project/phases or Claude phase-* entries');

  const phases = canonical || claudeArray
    ? roadmap.phases.map((phase, index) => normalizePhase(String(phase.id ?? index + 1), phase, canonical))
    : legacyEntries.map(([key, phase]) => normalizePhase(key.replace(/^phase-/i, ''), phase, false));
  const ids = new Set(phases.map((phase) => phase.id));
  phases.forEach((phase) => {
    phase.depends_on = phase.depends_on.map((dependency) => {
      if (ids.has(dependency)) return dependency;
      const unprefixed = dependency.replace(/^phase-/i, '');
      if (ids.has(unprefixed)) return unprefixed;
      const prefixed = `phase-${dependency}`;
      return ids.has(prefixed) ? prefixed : dependency;
    });
  });
  validateState({ version: 1, phases });
  const project = canonical
    ? roadmap.project
    : {
        name: typeof roadmap.name === 'string' ? roadmap.name : path.basename(root),
        objective: typeof roadmap.description === 'string' ? roadmap.description : null,
      };
  return { ...roadmap, format: canonical ? 'codex' : 'claude', project, phases, out_of_scope: normalizeStringArray(roadmap.out_of_scope) };
}

function syncRoadmap(root, { preserveLegacyVerification = false } = {}) {
  const roadmap = readRoadmap(root);
  const state = readState(root);
  const old = new Map(state.phases.map((phase) => [phase.id, phase]));
  const incoming = new Set(roadmap.phases.map((phase) => phase.id));
  for (const prior of state.phases) {
    if (!incoming.has(prior.id) && phaseHasExecutionHistory(root, state, prior)) throw new Error(`cannot remove referenced phase ${prior.id}; preserve its history in the roadmap`);
  }
  const knownIds = new Set(roadmap.phases.map((phase) => phase.id));
  for (const phase of roadmap.phases) {
    const prior = old.get(phase.id);
    if (prior && ['active', ...TERMINAL_PHASE_STATES].includes(prior.status)) {
      // Older terminal records predate verificationRequired. An explicit compatibility
      // sync preserves that unknown historical contract; it never backfills evidence.
      const legacyVerification = preserveLegacyVerification
        && TERMINAL_PHASE_STATES.has(prior.status)
        && !Object.hasOwn(prior, 'verificationRequired');
      const changed = changedPlanFields(prior, phase, knownIds)
        .filter((field) => !(legacyVerification && field === 'verificationRequired'));
      if (changed.length) throw new Error(`cannot change normalized plan fields for ${prior.status} phase ${prior.id}: ${changed.join(', ')}`);
    }
  }
  const notes = [];
  const phases = roadmap.phases.map((phase) => {
    const prior = old.get(phase.id);
    if (!prior) return { ...phase, commit: null, attempts: 0, reason: null, blockerKind: null };
    const protectedPlan = ['active', ...TERMINAL_PHASE_STATES].includes(prior.status);
    const merged = protectedPlan ? { ...prior } : { ...prior, ...phase };
    if (protectedPlan) {
      // done_when and verify are frozen at activation. A phase that never had them gets them once,
      // since no contract existed to protect; a change to existing ones needs a recorded decision.
      for (const field of ['done_when', 'verify']) {
        const frozen = normalizeStringArray(prior[field]);
        if (!frozen.length && phase[field].length) { merged[field] = phase[field]; notes.push(`${prior.id}: added ${field} from ROADMAP.yaml (the phase had none)`); }
        else if (prior.status === 'active' && frozen.length && JSON.stringify(frozen) !== JSON.stringify(phase[field])) notes.push(`${prior.id}: ROADMAP.yaml ${field} differs from the contract frozen at activation; reviewers keep judging the frozen one. Record the reason for the change with riff wave decision ${prior.id} --type contract --note "..."`);
      }
    }
    return { ...merged, status: prior.status, commit: prior.commit ?? null, attempts: prior.attempts ?? 0, reason: prior.reason ?? null, blockerKind: prior.blockerKind ?? null };
  });
  const nextState = {
    ...state,
    project: { name: roadmap.project.name ?? null, objective: roadmap.project.objective ?? null },
    roadmap: { source: 'ROADMAP.yaml', format: roadmap.format, out_of_scope: roadmap.out_of_scope ?? [] },
    phases,
  };
  validateState(nextState);
  saveState(root, nextState);
  event(root, 'roadmap_synced', { phases: nextState.phases.length, preserveLegacyVerification, notes: notes.length ? notes : undefined });
  return { state: nextState, notes };
}

function dependenciesComplete(state, phase) {
  const byId = new Map(state.phases.map((item) => [item.id, item]));
  return (phase.depends_on ?? []).every((id) => TERMINAL_PHASE_STATES.has(byId.get(id)?.status));
}

function activePhases(state) {
  return state.phases.filter((phase) => phase.status === 'active');
}

// The lead stays the phase the wave started with; batch lists every active phase when several run together.
function setActiveWave(state, lead) {
  const ids = activePhases(state).map((phase) => phase.id);
  if (!ids.length) { state.activeWave = null; return; }
  const phase = ids.includes(lead) ? lead : ids.includes(state.activeWave?.phase) ? state.activeWave.phase : ids[0];
  const { batch: _previous, ...wave } = state.activeWave ?? {};
  state.activeWave = { ...wave, phase, startedAt: wave.startedAt ?? now(), checkpointAt: now(), ...(ids.length > 1 ? { batch: ids } : {}) };
}

function activeLabel(wave) {
  return wave?.batch?.join(', ') ?? wave?.phase ?? 'none';
}

function inActiveWave(state, id) {
  return state.activeWave?.phase === id || Boolean(state.activeWave?.batch?.includes(id));
}

function selectPhase(state, requested) {
  const active = activePhases(state);
  if (active.length) {
    const lead = active.find((phase) => phase.id === state.activeWave?.phase) ?? active[0];
    if (!requested) return lead;
    const hit = active.find((phase) => phase.id === requested);
    if (hit) return hit;
    const phase = state.phases.find((item) => item.id === requested);
    if (phase?.status === 'ready' && dependenciesComplete(state, phase) && canRunBeside(phase, active)) return phase;
    throw new Error(`phase ${lead.id} is active; resume or park it first (phases run side by side only when each declares owns paths that don't overlap)`);
  }
  if (requested) {
    const phase = state.phases.find((item) => item.id === requested);
    if (!phase) throw new Error(`unknown phase ${requested}`);
    if (phase.status !== 'ready' || !dependenciesComplete(state, phase)) throw new Error(`phase ${requested} is not ready`);
    return phase;
  }
  return selectReadyPhase(state.phases);
}

function candidateTree(root) {
  try { return run('git', ['write-tree'], { cwd: root }); }
  catch { throw new Error('stage the complete candidate before recording validation or review'); }
}

function baseline(root) {
  try { return run('git', ['rev-parse', 'HEAD'], { cwd: root }); }
  catch { return run('git', ['hash-object', '-w', '-t', 'tree', '--stdin'], { cwd: root, input: '', stdio: ['pipe', 'pipe', 'pipe'] }); }
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

function markPhase(root, state, phase, status, reason = null, blockerKind = null) {
  phase.status = status;
  phase.reason = reason;
  phase.blockerKind = ['awaiting_human', 'blocked', 'parked'].includes(status) ? blockerKind : null;
  if (!activePhases(state).some((item) => item.id !== phase.id)) state.activeWave = null;
  setActiveWave(state, state.activeWave?.phase ?? phase.id);
  if (status === 'awaiting_human' || status === 'blocked' || status === 'parked') {
    state.humanAction = { phase: phase.id, status, kind: blockerKind, reason: reason ?? 'Human attention is required.' };
  } else if (state.humanAction?.phase === phase.id) state.humanAction = null;
  saveState(root, state);
  event(root, `phase_${status}`, { phase: phase.id, kind: blockerKind, reason });
}

function activePhase(state, phase) {
  if (phase.status !== 'active' || !inActiveWave(state, phase.id) || !dependenciesComplete(state, phase)) throw new Error(`phase ${phase.id} must be active with completed dependencies`);
}

function reviewArtifact(root, file, candidate, type, status) {
  const bytes = readFileSync(localPath(root, file));
  const artifact = JSON.parse(bytes);
  if (artifact.version !== 1 || artifact.candidate !== candidate || artifact.type !== type || artifact.status !== status || typeof artifact.reviewer?.id !== 'string' || !artifact.reviewer.id.trim() || artifact.reviewer.independent !== true || !Array.isArray(artifact.evidence) || !artifact.evidence.length || artifact.evidence.some((item) => typeof item !== 'string' || !item.trim()) || !Array.isArray(artifact.findings)) throw new Error('review artifact needs current candidate, matching type/status, independent reviewer identity, evidence and findings');
  if (status === 'pass' && artifact.findings.some((finding) => ['HIGH', 'CRITICAL'].includes(String(finding.severity).toUpperCase()))) throw new Error('passing review cannot contain blocking findings');
  // Bridge types must come from `riff review run`, or declare the native-subagent fallback and why the bridge could not run.
  if (REVIEW_TYPES.includes(type)) {
    const fromBridge = artifact.reviewedBy === 'riff review run' && inside(localPath(root, `${stateDirFor(root)}/reviews`), localPath(root, file));
    const fallback = artifact.reviewedBy === 'native-subagent' && typeof artifact.fallbackReason === 'string' && artifact.fallbackReason.trim();
    if (!fromBridge && !fallback) throw new Error(`${type} review artifact must be the file riff review run wrote under ${stateDirFor(root)}/reviews/, or a native fallback with "reviewedBy": "native-subagent" and a "fallbackReason"`);
  }
  return { artifact, bytes, hash: sha(bytes) };
}

function storeEvidence(root, kind, bytes) {
  const digest = sha(bytes);
  const file = localPath(root, `${stateDirFor(root)}/evidence/${kind}-${digest}.json`);
  ensureDir(file, true);
  if (!existsSync(file)) writeFileSync(file, bytes, { flag: 'wx' });
  if (sha(readFileSync(file)) !== digest) throw new Error('stored evidence hash mismatch');
  return { path: path.relative(root, file), hash: digest };
}

function evidenceValid(root, evidence) {
  try { return Boolean(evidence?.path && evidence.hash && sha(readFileSync(localPath(root, evidence.path))) === evidence.hash); }
  catch { return false; }
}

function discoveryEnrolled(root, state) {
  if (state.discovery) return true;
  try { return existsSync(localPath(root, DISCOVERY_MANIFEST)); }
  catch { return true; }
}

function storedReviewValid(root, receipt, type, candidate) {
  if (!receipt || receipt.candidate !== candidate || receipt.status !== 'pass' || receipt.type !== type || !evidenceValid(root, receipt.evidence)) return false;
  try {
    const artifact = JSON.parse(readFileSync(localPath(root, receipt.evidence.path), 'utf8'));
    return artifact.version === 1 && artifact.candidate === candidate && artifact.type === type && artifact.status === 'pass'
      && typeof artifact.reviewer?.id === 'string' && artifact.reviewer.id.trim() && artifact.reviewer.independent === true
      && Array.isArray(artifact.evidence) && artifact.evidence.length > 0 && artifact.evidence.every((item) => typeof item === 'string' && item.trim())
      && Array.isArray(artifact.findings) && !artifact.findings.some((finding) => ['HIGH', 'CRITICAL'].includes(String(finding.severity).toUpperCase()));
  } catch { return false; }
}

function discoveryGate(root, state) {
  if (!discoveryEnrolled(root, state)) return null;
  let snapshot;
  try { snapshot = discoverySnapshot(root); }
  catch (error) { throw new Error(`enrolled project discovery is invalid: ${error.message}`); }
  if (!state.discovery) throw new Error('enrolled project requires discovery snapshot and independent review before activation');
  if (state.discovery.manifest !== DISCOVERY_MANIFEST || state.discovery.digest !== snapshot.digest) throw new Error('discovery snapshot is stale; run discovery snapshot and obtain a fresh review');
  if (!storedReviewValid(root, state.discovery.review, 'discovery', snapshot.digest)) throw new Error('enrolled project requires an intact passing discovery review');
  return snapshot;
}

function currentDiscovery(root, state) {
  if (!discoveryEnrolled(root, state)) return null;
  const snapshot = discoverySnapshot(root);
  return { snapshot, stale: !state.discovery || state.discovery.digest !== snapshot.digest || !storedReviewValid(root, state.discovery?.review, 'discovery', snapshot.digest) };
}

function requireValidation(root, phase, candidate) {
  const validation = phase.validation;
  if (!validation || validation.status !== 'pass' || !validation.executed || validation.candidate !== candidate || !evidenceValid(root, validation.evidence)) throw new Error('a successful executed validation for this exact candidate is required');
  if (!evidenceValid(root, validation.verification)) throw new Error('verification report is missing or changed');
  if (phase.verificationRequired && (!validation.verification || validation.verification.verdict !== 'PASS')) throw new Error('this phase requires passing verification evidence');
  return validation;
}

function pendingObservationError(state) {
  const observations = observationList(state).filter((finding) => finding.status === 'pending');
  // Only HIGH and CRITICAL observations block completion; lower ones stay listed in the dashboard.
  for (const finding of observations) {
    const severity = String(finding.severity ?? 'INFO').toUpperCase();
    if (['HIGH', 'CRITICAL'].includes(severity)) return `pending ${severity} observation ${finding.id} blocks completion`;
  }
  return null;
}

function requireEnrolledCompletionGates(root, state, phase) {
  if (!discoveryEnrolled(root, state)) return;
  discoveryGate(root, state);
  const observationError = pendingObservationError(state);
  if (observationError) throw new Error(observationError);
}

function checkpointPhase(root, state, phase, options) {
  activePhase(state, phase);
  const summary = optionRequired(options, 'summary').trim();
  const next = optionRequired(options, 'next').trim();
  const candidate = candidateTree(root);
  const head = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8' });
  let references = ['PROJECT.md', 'ROADMAP.yaml', 'taste.md'];
  if (state.discovery?.files?.length) references = [...new Set([...references, ...state.discovery.files])];
  phase.checkpoint = {
    version: 1,
    phase: phase.id,
    head: head.status === 0 ? head.stdout.trim() : null,
    candidate,
    summary,
    next,
    references,
    validation: phase.validation ? { candidate: phase.validation.candidate, status: phase.validation.status, evidence: phase.validation.evidence ?? null } : null,
    reviews: Object.fromEntries(['functional', 'security'].map((type) => [type, receiptFor(root, phase, type) ? { candidate: receiptFor(root, phase, type).candidate, status: receiptFor(root, phase, type).status, evidence: receiptFor(root, phase, type).evidence ?? null } : null])),
    at: now(),
  };
  setActiveWave(state, phase.id);
  saveState(root, state);
  event(root, 'phase_checkpoint', { phase: phase.id, candidate, references });
  process.stdout.write(`Checkpoint saved for ${phase.id} at ${candidate}.\n`);
}

function validateCandidate(root, state, phase, options) {
  // --rerun repeats the last executed validation of the phase: same command, paths and manifest, restaged.
  if (options.rerun === true) {
    const last = phase.validation;
    if (!last?.executed || !Array.isArray(last.command) || !Array.isArray(last.allowedPaths)) throw new Error(`no executed validation to rerun for ${phase.id}; run wave validate with --run --command --paths once`);
    options = { ...options, run: true, command: JSON.stringify(last.command), paths: options.paths ?? JSON.stringify(last.allowedPaths), verification: options.verification ?? last.verificationManifest?.path };
    run('git', ['add', '-A', '--', ...JSON.parse(options.paths)], { cwd: root });
  }
  const command = optionRequired(options, 'command');
  const candidate = candidateTree(root);
  if (discoveryEnrolled(root, state) && phase.validation?.status === 'fail') {
    if (phase.validation.candidate === candidate) {
      throw new Error('failed validation on the unchanged candidate; a different command or declaration is not a correction');
    }
    if (options.run !== true || phase.retryCandidate !== phase.validation.candidate) {
      throw new Error('failed validation requires wave retry and an executed check of the corrected candidate; the formal failure is preserved');
    }
  }
  if (discoveryEnrolled(root, state) && phase.retryCandidate && phase.retryCandidate === candidate) {
    throw new Error('targeted correction did not change the candidate; validation remains unchanged');
  }
  if (options.run !== true) {
    if (!['pass', 'fail'].includes(options.status)) throw new Error('--status must be pass or fail');
    state.lastValidation = { phase: phase.id, status: optionRequired(options, 'status'), command, summary: optionRequired(options, 'summary'), candidate, executed: false, at: now() };
    phase.validation = state.lastValidation;
    saveState(root, state);
    return state.lastValidation;
  }
  const argv = JSON.parse(command);
  if (!Array.isArray(argv) || !argv.length || argv.some((arg) => typeof arg !== 'string' || !arg || arg.includes('\0'))) throw new Error('--command must be a JSON argv array');
  const paths = options.paths ? JSON.parse(options.paths) : phase.allowedPaths;
  if (!Array.isArray(paths) || !paths.length || paths.some((entry) => typeof entry !== 'string' || !entry || entry === '.' || path.isAbsolute(entry) || entry.split(/[\\/]/).includes('..'))) throw new Error('validation requires explicit project-relative --paths JSON array');
  paths.forEach((entry) => localPath(root, entry));
  const base = phase.baseCommit;
  if (!base) throw new Error('resume this legacy phase with --reason to establish its baseline before validation');
  const changed = execFileSync('git', ['diff', '--name-only', '-z', base, candidate], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const outside = changed.filter((file) => !paths.some((entry) => inside(path.resolve(root, entry), path.resolve(root, file))));
  if (outside.length) throw new Error(`candidate exceeds declared scope: ${outside.join(', ')}`);
  // Unstaged edits (often a formatter run on a whole folder) would make the check differ from the candidate.
  const unstaged = run('git', ['diff', '--name-only'], { cwd: root }).split('\n').filter(Boolean);
  if (unstaged.length) throw new Error(`unstaged changes to tracked files: ${unstaged.slice(0, 20).join(', ')}${unstaged.length > 20 ? ` (+${unstaged.length - 20} more)` : ''}. Stage the ones that belong to the phase and restore the others (git restore <file>)`);
  const visual = options.verification ? verificationEvidence(root, options.verification, candidate) : undefined;
  phase.validation = null;
  state.lastValidation = null;
  saveState(root, state);
  const observed = spawnSync(argv[0], argv.slice(1), { cwd: root, encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
  const output = `${observed.stdout ?? ''}${observed.stderr ?? ''}`.replace(/\b(?:sk-proj-|(?:sk|rk)_live_|gh[pousr]_)[A-Za-z0-9_-]+\b/g, '[REDACTED]');
  let unchanged = candidateTree(root) === candidate;
  try { run('git', ['diff', '--exit-code'], { cwd: root }); } catch { unchanged = false; }
  const status = observed.status === 0 && !observed.error && unchanged ? 'pass' : 'fail';
  const summary = !unchanged ? 'Validation changed the candidate; stage and validate the corrected tree.' : observed.error?.message ?? `Command exited ${observed.status ?? observed.signal}`;
  const validation = { phase: phase.id, status, command: argv, summary, candidate, executed: true, output, at: now(), allowedPaths: paths, changedPaths: changed, exitCode: observed.status };
  if (visual) validation.verificationManifest = { path: String(options.verification), hash: visual.hash };
  if (phase.verificationRequired && (!visual || visual.manifest.steps.some((step) => step.status !== 'pass'))) validation.status = 'fail';
  validation.verification = writeReport(root, { title: phase.title, phase: phase.id, candidate, validation, evidence: visual, steps: phase.verificationRequired && !visual ? [{ name: 'Required verification', status: 'unverified', observed: 'No verification manifest was supplied.' }] : [] });
  validation.evidence = storeEvidence(root, 'validation', Buffer.from(JSON.stringify(validation)));
  phase.allowedPaths = paths;
  phase.validation = validation;
  if (discoveryEnrolled(root, state)) phase.retryCandidate = null;
  state.lastValidation = validation;
  saveState(root, state);
  event(root, 'validation', { phase: phase.id, status: validation.status, candidate, report: validation.verification.path });
  return validation;
}

function autonomyMode(root) {
  const autonomy = readJson(pathsFor(root).config, false)?.preferences?.autonomy ?? 'loop';
  if (!AUTONOMY_MODES.has(autonomy)) throw new Error(`unsupported autonomy mode ${autonomy}`);
  return autonomy;
}

function phaseFailedValidation(state, phase) {
  // The phase's own record wins: another phase validating later replaces only state.lastValidation.
  if ((phase.validation?.phase ?? phase.id) === phase.id && phase.validation?.status === 'fail') return phase.validation;
  if (state.lastValidation?.phase === phase.id && state.lastValidation?.status === 'fail') return state.lastValidation;
  return null;
}

function loopStopKind(root, state, phase, options) {
  const kind = String(options.kind ?? '');
  if (!LOOP_STOP_KINDS.has(kind)) {
    throw new Error(`loop mode may stop only with --kind ${[...LOOP_STOP_KINDS].join(', ')}`);
  }
  if (kind === 'validation-failure') {
    const validationFailed = Boolean(phaseFailedValidation(state, phase));
    const reviewFailed = ['functional', 'security'].some((type) => receiptFor(root, phase, type)?.status === 'fail' || failedRounds(phase, type) > 0);
    if (!validationFailed && !reviewFailed) throw new Error('validation-failure requires a recorded failed validation or review for this phase');
  }
  return kind;
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
  const candidate = candidateTree(root);
  if (options.candidate && options.candidate !== candidate) throw new Error('review candidate differs from the current staged tree');
  const previous = receiptFor(root, phase, type);
  if (discoveryEnrolled(root, state) && previous?.status === 'fail' && previous.candidate === candidate) {
    throw new Error(`repeated ${type} review after a failure on the unchanged candidate; record one targeted correction before retrying`);
  }
  if (status === 'pass') requireValidation(root, phase, candidate);
  const proof = reviewArtifact(root, optionRequired(options, 'evidence'), candidate, type, status);
  const receipt = {
    version: 1,
    phase: phase.id,
    type,
    status,
    severity,
    candidate,
    evidence: storeEvidence(root, `${phase.id}-${type}`, proof.bytes),
    reviewer: proof.artifact.reviewer,
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
  writeJson(localPath(root, path.join(pathsFor(root).receipts, `${phase.id}-${type}.json`)), receipt);
  noteReviewRound(phase, type, { candidate, status, summary: proof.artifact.summary ?? receipt.summary, findings: proof.artifact.findings, at: proof.artifact.runAt ?? receipt.reviewedAt });
  state.reviews[type] = receipt;
  if (options.model) state.model = { name: options.model, reasoning: options.reasoning ?? null, fast_available: options.fast_available === 'true' };
  // A failed security review never parks the phase: the agent corrects and reviews a new candidate.
  // The finding stays an observation until it is resolved or deferred to a security expert.
  if (type === 'security' && status === 'fail') state.securityFindings.push(receipt);
  saveState(root, state);
  event(root, `${type}_review`, { phase: phase.id, status, severity, candidate: receipt.candidate, summary: receipt.summary });
  return receipt;
}

function receiptFor(root, phase, type) {
  return readJson(localPath(root, path.join(pathsFor(root).receipts, `${phaseId(phase.id)}-${type}.json`)), false);
}

function completePhase(root, state, phase, commit) {
  const id = phase.id;
  activePhase(state, phase);
  const commitTree = run('git', ['rev-parse', `${commit}^{tree}`], { cwd: root });
  if (run('git', ['rev-parse', commit], { cwd: root }) !== run('git', ['rev-parse', 'HEAD'], { cwd: root })) throw new Error('completion must refer to current HEAD');
  requireValidation(root, phase, commitTree);
  const functional = receiptFor(root, phase, 'functional');
  const security = receiptFor(root, phase, 'security');
  if (!functional || functional.status !== 'pass' || functional.candidate !== commitTree || !evidenceValid(root, functional.evidence)) throw new Error('a passing functional receipt with intact evidence for the exact commit tree is required');
  if (phase.sensitive && (!security || security.status !== 'pass' || security.candidate !== commitTree || !evidenceValid(root, security.evidence))) throw new Error('a passing security receipt with intact evidence for the exact sensitive commit tree is required');
  requireEnrolledCompletionGates(root, state, phase);
  markCompleted(root, state, phase, commit);
}

function markCompleted(root, state, phase, commit, note = '') {
  phase.commit = run('git', ['rev-parse', commit], { cwd: root });
  phase.status = 'completed';
  phase.reason = null;
  phase.blockerKind = null;
  state.lastCommit = phase.commit;
  setActiveWave(state, state.activeWave?.phase);
  state.humanAction = null;
  state.validationNeeds = [];
  saveState(root, state);
  event(root, 'phase_completed', { phase: phase.id, commit: phase.commit, ...(phase.acceptance ? { acceptedWithRisks: true } : {}) });
  const next = selectPhase(state);
  process.stdout.write(`${phase.id} completed${note} at ${phase.commit.slice(0, 12)}.\n${next ? `Next ready: ${next.id}\n` : 'No further phase is ready.\n'}`);
}

const reviewTypesFor = (phase) => (phase.sensitive ? ['functional', 'security'] : ['functional']);
const findingKey = (text) => clip(text, 160).toLowerCase();

function phaseResidualRisks(state, phase) {
  return state.securityFindings.filter((finding) => finding.kind === 'residual_risk' && finding.phase === phase.id);
}

// The owner may stop review rounds on a phase that hit the round limit and accept what is left as
// known residual risks. Validation stays mandatory; only the failing review types are waived, and
// only when every blocking finding of their last failed round is recorded as a residual risk.
function acceptPhase(root, state, phase, commit, options) {
  const reason = String(optionRequired(options, 'reason')).trim();
  if (reason.length < 10) throw new Error('--reason must state the owner decision (at least 10 characters)');
  if (!['active', 'parked'].includes(phase.status)) throw new Error(`phase ${phase.id} must be active or parked at the review round limit to complete with accepted risks`);
  const others = activePhases(state).filter((item) => item.id !== phase.id);
  if (others.length && !(phase.status === 'active' && inActiveWave(state, phase.id))) throw new Error(`phase ${others[0].id} is active; finish or park it first`);
  if (!dependenciesComplete(state, phase)) throw new Error(`phase ${phase.id} has unfinished dependencies`);
  const commitTree = run('git', ['rev-parse', `${commit}^{tree}`], { cwd: root });
  if (run('git', ['rev-parse', commit], { cwd: root }) !== run('git', ['rev-parse', 'HEAD'], { cwd: root })) throw new Error('completion must refer to current HEAD');
  requireValidation(root, phase, commitTree);
  const limits = reviewLimits(root);
  const risks = phaseResidualRisks(state, phase);
  const recorded = new Set(risks.flatMap((risk) => [risk.finding, risk.summary].filter(Boolean).map(findingKey)));
  const waived = [];
  for (const type of reviewTypesFor(phase)) {
    const receipt = receiptFor(root, phase, type);
    if (receipt?.status === 'pass' && receipt.candidate === commitTree && evidenceValid(root, receipt.evidence)) continue;
    if (failedRounds(phase, type) < limits.maxFailedRounds) throw new Error(`${type} review has ${failedRounds(phase, type)} failed round(s) out of ${limits.maxFailedRounds}; owner completion applies only at the round limit. Otherwise record a passing ${type} review for the commit tree`);
    const last = (phase.reviewRounds?.[type]?.log ?? []).at(-1);
    const open = (last?.findings ?? []).filter((finding) => ['HIGH', 'CRITICAL'].includes(finding.severity) && !recorded.has(findingKey(finding.title)));
    if (open.length) {
      throw new Error(`record each remaining blocking ${type} finding of round ${last.round} as a residual risk first:\n${open.map((finding) => `  riff wave risk ${phase.id} --kind crash-window|runtime-unverified|edge-case --severity ${finding.severity} --summary ${JSON.stringify(finding.title)} --note "why the owner accepts it"`).join('\n')}`);
    }
    waived.push({ type, round: last?.round ?? null, failedRounds: failedRounds(phase, type) });
  }
  if (!waived.length) throw new Error('every required review passed for this commit tree; use riff wave complete without --accept-risks');
  requireEnrolledCompletionGates(root, state, phase);
  const at = now();
  addDecision(phase, { note: `Owner stopped review rounds and accepted the residual risks: ${reason}`, type: 'contract', source: 'owner', at });
  phase.acceptance = { source: 'owner', reason: clip(reason, 600), at, commit: run('git', ['rev-parse', commit], { cwd: root }), waived, risks: risks.map((risk) => ({ kind: risk.residual, severity: risk.severity, summary: clip(risk.summary, 200) })) };
  event(root, 'phase_accepted', { phase: phase.id, source: 'owner', reason: clip(reason, 200), waived: waived.map((entry) => entry.type), risks: risks.length });
  markCompleted(root, state, phase, commit, ` with ${risks.length} accepted residual risk(s) by owner decision`);
}

function acceptedPhasesText(state) {
  const accepted = state.phases.filter((phase) => phase.status === 'completed' && phase.acceptance);
  if (!accepted.length) return '';
  return `Phases accepted by the owner with residual risks (${accepted.length}; review rounds stopped at the limit, validation passed):\n${accepted.map((phase) => `- ${phase.id} ${phase.title ?? ''}: waived ${phase.acceptance.waived.map((entry) => `${entry.type} after ${entry.failedRounds} failed rounds`).join(', ')}. Owner decision: ${phase.acceptance.reason}\n${phase.acceptance.risks.map((risk) => `  - ${risk.severity} ${risk.kind}: ${risk.summary}`).join('\n')}`).join('\n')}\n`;
}

const RESIDUAL_RISK_KINDS = new Set(['crash-window', 'runtime-unverified', 'edge-case']);

// A finding not worth another round (a crash window between two writes, runtime behavior a read-only
// reviewer cannot observe, a rare edge case outside the criteria) goes to the human as a known residual
// risk. It can be recorded from the first round.
function recordResidualRisk(root, state, phase, options) {
  if (!['active', 'parked'].includes(phase.status)) throw new Error(`phase ${phase.id} must be active or parked to record a residual risk`);
  const kind = optionRequired(options, 'kind');
  if (!RESIDUAL_RISK_KINDS.has(kind)) throw new Error(`--kind must be ${[...RESIDUAL_RISK_KINDS].join(' or ')}`);
  const severity = parseSeverity(options.severity ?? 'MEDIUM');
  const summary = String(optionRequired(options, 'summary')).trim();
  const note = String(optionRequired(options, 'note')).trim();
  const finding = { kind: 'residual_risk', residual: kind, severity, summary, finding: options.finding ? String(options.finding).trim() : null, what_could_happen: options.what_could_happen ?? null, affected: options.affected ?? null, phase: phase.id, candidate: candidateTree(root), reviewedAt: now() };
  state.securityFindings.push(finding);
  const observation = observationList(state).find((entry) => entry.kind === 'residual_risk' && entry.summary === summary && entry.phase === phase.id);
  reviewObservation(state, { id: observation.id, revision: observation.revision, status: 'expert_review', note: `Known residual risk (${kind}) for a human decision: ${note}` });
  saveState(root, state);
  event(root, 'residual_risk', { phase: phase.id, kind, severity, summary: clip(summary, 200) });
  process.stdout.write(`Residual risk recorded for ${phase.id} and listed for the human; later reviews will not report it again unless the candidate makes it worse.\n`);
}

function cmdDiscovery(tokens) {
  const root = gitRoot();
  const action = tokens[0] ?? 'check';
  const options = parseOptions(tokens.slice(1));
  const state = readState(root);
  if (!['snapshot', 'check', 'review'].includes(action)) throw new Error('use discovery snapshot, discovery check, or discovery review --evidence FILE');
  if (action === 'snapshot') {
    const snapshot = discoverySnapshot(root);
    const prior = state.discovery;
    const same = prior?.digest === snapshot.digest;
    state.discovery = {
      ...snapshot,
      snapshotAt: same ? prior.snapshotAt : now(),
      review: same ? prior.review ?? null : null,
      ...(same && prior.lastReviewAttempt ? { lastReviewAttempt: prior.lastReviewAttempt } : {}),
      ...(prior?.failedRounds ? { failedRounds: prior.failedRounds } : {}),
      ...(prior?.lastPassCommit ? { lastPassCommit: prior.lastPassCommit, lastPassAt: prior.lastPassAt } : {}),
    };
    saveState(root, state);
    event(root, 'discovery_snapshot', snapshot);
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }
  const snapshot = discoverySnapshot(root);
  if (!state.discovery || state.discovery.manifest !== DISCOVERY_MANIFEST) throw new Error('discovery snapshot is required before checking or reviewing the dossier');
  if (state.discovery.digest !== snapshot.digest) throw new Error('discovery snapshot is stale; run discovery snapshot before checking or reviewing');
  if (action === 'check') {
    if (!storedReviewValid(root, state.discovery.review, 'discovery', snapshot.digest)) throw new Error('discovery dossier lacks an intact passing independent review');
    process.stdout.write(`${JSON.stringify({ ...snapshot, reviewed: true }, null, 2)}\n`);
    return;
  }
  const evidence = optionRequired(options, 'evidence');
  const supplied = readJson(localPath(root, evidence));
  const status = supplied?.status;
  if (!['pass', 'fail'].includes(status)) throw new Error('discovery review status must be pass or fail');
  if (state.discovery.review?.status === 'fail' && state.discovery.review.candidate === snapshot.digest) {
    throw new Error('repeated discovery review after a failure on the unchanged candidate; revise the dossier before retrying');
  }
  const proof = reviewArtifact(root, evidence, snapshot.digest, 'discovery', status);
  state.discovery.review = {
    version: 1,
    type: 'discovery',
    status,
    candidate: snapshot.digest,
    reviewer: proof.artifact.reviewer,
    evidence: storeEvidence(root, 'discovery', proof.bytes),
    reviewedAt: now(),
  };
  // Failed rounds accumulate across revised snapshots until a review passes; the review bridge caps them.
  state.discovery.failedRounds = status === 'pass' ? 0 : (state.discovery.failedRounds ?? 0) + 1;
  // The next evolution is reviewed as a diff from the dossier accepted here.
  if (status === 'pass') {
    // A dossier reviewed before the first commit has no commit to diff from yet.
    try { state.discovery.lastPassCommit = run('git', ['rev-parse', 'HEAD'], { cwd: root }); } catch { delete state.discovery.lastPassCommit; }
    state.discovery.lastPassAt = state.discovery.review.reviewedAt;
  }
  saveState(root, state);
  event(root, 'discovery_review', { candidate: snapshot.digest, status, evidence: state.discovery.review.evidence });
  process.stdout.write(`Discovery review ${status} recorded at ${snapshot.digest}.\n`);
}

const REVIEW_DIFF_LIMIT = 60000;
const DISCOVERY_ROUND_LIMIT = 2;
const SEVERITY_ORDER = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// New dossier files not yet committed are invisible to git diff; name them so the reviewer reads them.
function untrackedDossier(root, files) {
  const untracked = run('git', ['ls-files', '--others', '--exclude-standard', '--', ...files], { cwd: root });
  return untracked ? `\n\nNew dossier files not in the diff (read them in full):\n${untracked.split('\n').map((file) => `- ${file}`).join('\n')}` : '';
}

// Failed dossier rounds since the last pass: the reviewer sees what was already raised, so later rounds
// confirm fixes and catch real contradictions instead of finding one more edge case each time.
function discoveryRoundsContext(root, state, digest, since) {
  const dir = localPath(root, `${stateDirFor(root)}/reviews`);
  if (!existsSync(dir)) return '';
  // Only rounds of this evolution: after the last pass, or after the commit the scoped review starts from.
  const sinceAt = since ? new Date(run('git', ['log', '-1', '--format=%cI', since], { cwd: root })).toISOString() : '';
  const after = [state.discovery.lastPassAt ?? '', sinceAt].sort().at(-1);
  if (!after) return '';
  const rounds = readdirSync(dir).filter((name) => name.startsWith('discovery-') && name.endsWith('.json'))
    .map((name) => readJson(path.join(dir, name), false)).filter((artifact) => artifact?.status === 'fail' && artifact.candidate !== digest && String(artifact.runAt ?? '') > after)
    .sort((left, right) => String(left.runAt).localeCompare(String(right.runAt)))
    .slice(-5);
  if (!rounds.length) return '';
  const list = rounds.map((artifact, index) => `Round ${index + 1} (${artifact.runAt}):\n${artifact.findings.map((finding) => `- ${finding.severity}: ${finding.title}`).join('\n')}`).join('\n\n');
  return `\n\nEarlier failed rounds on this evolution (the dossier was revised after each):\n\n${list}\n\nConvergence rules for this round:\n- Don't report again a finding above that the dossier now addresses; check the fix instead.\n- HIGH only for a contradiction between documents or a missing decision that forces an implementer to guess on the main path, data loss or a security exposure, including one a fix above introduced.\n- A further rare case of the same kind as above (a narrower race, a multi-step failure sequence, an operator mistake) is MEDIUM at most; recommend recording it as an operating instruction for the team.`;
}

function reviewDiff(root, args, pathspec = []) {
  const limit = pathspec.length ? ['--', ...pathspec] : [];
  const stat = run('git', [...args, '--stat', ...limit], { cwd: root });
  const patch = run('git', [...args, ...limit], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
  const truncated = patch.length > REVIEW_DIFF_LIMIT;
  return `Changed files:\n${stat || '(none)'}\n\nDiff${truncated ? ` (truncated to ${REVIEW_DIFF_LIMIT} characters; read the files for the rest)` : ''}:\n\`\`\`diff\n${patch.slice(0, REVIEW_DIFF_LIMIT)}\n\`\`\``;
}

function reviewPhaseContext(phase) {
  const list = (items) => items?.length ? items.map((item) => `- ${item}`).join('\n') : '- (none stated; infer from the outcome and flag the gap)';
  return [`Phase ${phase.id}: ${phase.title}`, `Outcome: ${phase.outcome || '(none stated)'}`, phase.demo ? `Demo: ${phase.demo}` : null,
    `done_when:\n${list(phase.done_when)}`, `verify:\n${list(phase.verify)}`, phase.risks?.length ? `Risks:\n${list(phase.risks)}` : null].filter(Boolean).join('\n');
}

const ROUND_LOG_LIMIT = 12;
const DECISION_LIMIT = 20;
const clip = (text, size) => { const value = String(text ?? '').replace(/\s+/g, ' ').trim(); return value.length > size ? `${value.slice(0, size - 1)}…` : value; };

function reviewLimits(root) {
  return reviewerConfig(readJson(pathsFor(root).config, false) ?? {});
}

function failedRounds(phase, type) {
  return Number(phase.reviewRounds?.[type]?.failed ?? 0);
}

// Counts one failed review round per phase, type and candidate. Recording the same failed candidate
// again (review run, then wave review) never counts twice. Passing reviews leave the count alone.
// `failed` restarts after a human resume; `total` and the log keep the whole history.
function noteReviewRound(phase, type, { candidate, status, summary, findings, at }) {
  if (!['functional', 'security'].includes(type) || status !== 'fail') return false;
  phase.reviewRounds ??= {};
  const record = phase.reviewRounds[type] ??= { failed: 0, total: 0, log: [] };
  record.failed = Number(record.failed ?? 0);
  record.total = Number(record.total ?? record.failed);
  record.log ??= [];
  if (record.log.some((entry) => entry.candidate === candidate && entry.round > Number(record.resetAtRound ?? 0))) return false;
  record.failed += 1;
  record.total += 1;
  record.log.push({
    round: record.total,
    candidate,
    at,
    summary: clip(summary, 300),
    findings: (findings ?? []).slice(0, 10).map((finding) => ({ severity: String(finding.severity ?? 'INFO').toUpperCase(), title: clip(finding.title, 160), ...(finding.location ? { location: clip(finding.location, 120) } : {}) })),
  });
  record.log = record.log.slice(-ROUND_LOG_LIMIT);
  return true;
}

function addDecision(phase, { note, type = null, source = 'agent', at = now() }) {
  phase.decisions = [...(phase.decisions ?? []), { at, type, source, note: clip(note, 600) }].slice(-DECISION_LIMIT);
}

function changedBetween(root, from, to) {
  try {
    const files = run('git', ['diff', '--name-only', from, to], { cwd: root }).split('\n').filter(Boolean);
    return files.length ? `${files.slice(0, 8).join(', ')}${files.length > 8 ? ` (+${files.length - 8} more)` : ''}` : 'no file change';
  } catch { return 'unknown (tree no longer available)'; }
}

function decisionsContext(phase) {
  if (!phase.decisions?.length) return '';
  return `\n\nDecisions recorded during this phase (they explain intentional tradeoffs and criterion interpretations; judge whether each is justified instead of reversing it silently):\n${phase.decisions.map((decision) => `- ${String(decision.at).slice(0, 10)}${decision.type ? ` [${decision.type}]` : ''}${decision.source !== 'agent' ? ` (${decision.source})` : ''}: ${decision.note}`).join('\n')}`;
}

// Compact history of every failed round of the phase, all review types together, so a reviewer
// sees which fixes earlier rounds asked for and can detect oscillation between contracts.
function roundLog(root, phase, candidate) {
  const entries = ['functional', 'security'].flatMap((type) => (phase.reviewRounds?.[type]?.log ?? []).map((entry) => ({ ...entry, type })))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return entries.map((entry, index) => {
    const next = entries[index + 1]?.candidate ?? candidate;
    const findings = (entry.findings ?? []).map((finding) => `\n  - ${finding.severity}: ${finding.title}${finding.location ? ` (${finding.location})` : ''}`).join('');
    return `- ${entry.type} round ${entry.round} on ${String(entry.candidate).slice(0, 12)} (${String(entry.at).slice(0, 16)}): ${entry.summary}${findings}\n  Changed after this round: ${next === entry.candidate ? 'nothing yet' : changedBetween(root, entry.candidate, next)}`;
  }).join('\n');
}

const stripAnsi = (text) => String(text ?? '').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');

function readJsonQuietly(root, relative) {
  try { return JSON.parse(readFileSync(localPath(root, relative), 'utf8')); } catch { return null; }
}

// Verification steps observed for this candidate: the manifest attached at validation, the steps of the
// report RIFF wrote at that validation, or a manifest at the conventional or `verify`-declared path.
function verificationSteps(root, phase, validation) {
  const attached = validation.verificationManifest?.path;
  const reportRun = validation.verification?.path ? path.join(path.dirname(validation.verification.path), 'run.json') : null;
  const candidates = [
    attached && { file: attached, attested: true },
    reportRun && { file: reportRun, attested: true, report: true },
    { file: `${stateDirFor(root)}/verification/${phase.id}/manifest.json`, attested: false },
    ...(phase.verify ?? []).flatMap((item) => [...String(item).matchAll(/[\w./-]+\.json\b/g)].map((match) => ({ file: match[0], attested: false }))),
  ].filter(Boolean);
  for (const source of candidates) {
    const data = readJsonQuietly(root, source.file);
    const steps = (data?.steps ?? []).filter((step) => step && step.name && step.name !== 'Automated checks');
    if (!steps.length) continue;
    const matches = data.candidate === validation.candidate;
    return { ...source, steps, matches, candidate: data.candidate ?? null };
  }
  return null;
}

function validationContext(root, phase, validation) {
  if (!validation) return '';
  const command = Array.isArray(validation.command) ? validation.command.map((arg) => (/^[\w./:=@%+-]+$/.test(arg) ? arg : JSON.stringify(arg))).join(' ') : String(validation.command);
  const output = stripAnsi(validation.output).trim();
  const excerpt = output.length > 2500 ? `…${output.slice(-2500)}` : output;
  const lines = [
    '\n\nValidation receipt for this exact candidate, recorded by `riff wave validate --run`. RIFF executed the command itself and bound the result to the candidate tree, so execution is attested: do not report these checks as not run, or runtime behavior as unverified, only because you cannot execute anything read-only. Judge instead whether the checks and observations below actually cover each criterion; a criterion they do not cover is still a gap.',
    `- Command: ${command}`,
    `- Exit code: ${validation.exitCode ?? 'not recorded'}; status: ${validation.status}; candidate tree: ${validation.candidate}; run at: ${validation.at}`,
    validation.verification?.path ? `- Report: ${validation.verification.path} (verdict ${validation.verification.verdict ?? 'unknown'})` : null,
    excerpt ? `- Output excerpt:\n\`\`\`\n${excerpt}\n\`\`\`` : '- Output: (empty)',
  ];
  const verification = verificationSteps(root, phase, validation);
  if (verification) {
    const origin = verification.attested
      ? `${verification.report ? 'report written at this validation' : 'manifest attached to this validation'}: ${verification.file}`
      : `${verification.file}${verification.matches ? '' : `, recorded for candidate ${verification.candidate ?? 'unknown'}, not this one: treat it as earlier evidence`}`;
    lines.push(`\nVerification steps observed (${origin}):`);
    for (const step of verification.steps.slice(0, 40)) {
      const details = [step.expected && `expected: ${clip(step.expected, 200)}`, `observed: ${clip(step.observed, 300)}`, step.url && `url: ${step.url}`, step.viewport && `viewport: ${step.viewport}`, step.screenshot && `screenshot: ${step.screenshot}`].filter(Boolean).join('; ');
      lines.push(`- ${String(step.status ?? 'unknown').toUpperCase()}: ${clip(step.name, 160)}. ${details}`);
    }
    if (verification.steps.length > 40) lines.push(`- (${verification.steps.length - 40} more steps in ${verification.file})`);
  } else lines.push('\nNo verification manifest was recorded for this candidate; judge criteria that need a browser or database observation from the code and tests above.');
  return lines.filter(Boolean).join('\n');
}

// From the second round the reviewer re-checks: earlier findings and the change made since the last
// failed round, not a fresh review from scratch that would surface a new set of edge cases each time.
function convergenceContext(root, phase, type, candidate, limits) {
  const failed = failedRounds(phase, type);
  if (failed + 1 < limits.convergenceFromRound) return '';
  const last = (phase.reviewRounds?.[type]?.log ?? []).at(-1);
  const sinceLast = last && last.candidate !== candidate ? `\n\nChange since the last failed ${type} round (${String(last.candidate).slice(0, 12)}):\n\n${reviewDiff(root, ['diff', last.candidate, candidate])}` : '';
  return `\n\nRe-review: this is ${type} review round ${failed + 1} for this phase; after ${limits.maxFailedRounds} failed rounds the phase goes to a human. Earlier failed rounds, oldest first, with the files changed in response:\n${roundLog(root, phase, candidate)}${sinceLast}\n\nRules for this round:\n- Check that each earlier HIGH or CRITICAL finding is fixed. Report one again only if it is still there.\n- Read the change since the last round. A new HIGH or CRITICAL finding is allowed only when that change introduced it, or when a done_when criterion is plainly not met in normal use.\n- Any other new problem is MEDIUM at most, even if you would have rated it higher in a first review.\n- If a finding reverses a fix made for an earlier finding, or conflicts with a done_when criterion, a security requirement or a recorded decision, start its title with "CONFLICT:", name both contracts and the earlier round, and rate it MEDIUM so the human can choose.`;
}

function roundCapMessage(root, phase, type, limits) {
  return `${failedRounds(phase, type)} ${type} review rounds failed for phase ${phase.id} (limit ${limits.maxFailedRounds}); another round is refused. Hand the conflict to the human instead of looping:\n`
    + `1. Record each remaining finding that is not worth another round as a known residual risk: riff wave risk ${phase.id} --kind crash-window|runtime-unverified|edge-case --severity LOW|MEDIUM|HIGH --summary "..." --note "why it stays open".\n`
    + `2. Park with a conflict summary naming the competing contracts: riff wave park ${phase.id} --kind validation-failure --reason "<which contracts conflict and the options>".\n`
    + `3. Only the owner resumes it: riff wave resume ${phase.id} --reason "<decision>" records the decision and allows one more round.\n`
    + `Failed rounds so far:\n${roundLog(root, phase, candidateTree(root))}`;
}

// Resolve what the reviewer judges, refusing a run the existing record commands would reject anyway.
function reviewTarget(root, state, type, options) {
  if (type === 'discovery') {
    const snapshot = discoverySnapshot(root);
    if (!state.discovery || state.discovery.digest !== snapshot.digest) throw new Error('run discovery snapshot before requesting a dossier review');
    if (state.discovery.review?.status === 'fail' && state.discovery.review.candidate === snapshot.digest) throw new Error('the last dossier review failed on this unchanged dossier; revise it and snapshot again');
    if ((state.discovery.failedRounds ?? 0) >= DISCOVERY_ROUND_LIMIT) throw new Error(`${DISCOVERY_ROUND_LIMIT} dossier review rounds failed; record the unresolved findings as a blocker instead of another round`);
    // An evolution is judged as a change: the diff since the last accepted dossier, not the whole dossier again.
    const since = options.since ?? state.discovery.lastPassCommit ?? null;
    const scope = since
      ? `Scoped review of an evolution. Judge the change below and its effect on the existing behavior it touches. Read unchanged dossier files only to check consistency with this change; don't re-review parts the change doesn't touch.\n\nDossier change since ${since}:\n\n${reviewDiff(root, ['diff', since, '--', ...snapshot.files])}${untrackedDossier(root, snapshot.files)}\n\nOther dossier files (for consistency checks):\n${snapshot.files.map((file) => `- ${file}`).join('\n')}`
      : `Dossier files (read all of them):\n${snapshot.files.map((file) => `- ${file}`).join('\n')}`;
    return { candidate: snapshot.digest, context: `${scope}${discoveryRoundsContext(root, state, snapshot.digest, since)}` };
  }
  const candidate = candidateTree(root);
  if (type === 'delivery') {
    checkTerminalPhaseEvidence(root, state);
    if (candidate !== run('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root })) throw new Error('final delivery review must bind the committed HEAD candidate');
    if (run('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root })) throw new Error('final delivery review requires a clean tracked candidate');
    if (state.deliveryReview?.status === 'fail' && state.deliveryReview.candidate === candidate) throw new Error('the last delivery review failed on this unchanged candidate; correct it first');
    const base = state.phases.map((phase) => phase.baseCommit).find(Boolean);
    const phases = state.phases.map((phase) => `## ${phase.status}${phase.acceptance ? ` (accepted by the owner with residual risks, review rounds stopped at the limit: ${phase.acceptance.reason})` : ''}\n${reviewPhaseContext(phase)}`).join('\n\n');
    return { candidate, context: `Roadmap phases:\n\n${phases}${base ? `\n\nWhole version since ${base}:\n${run('git', ['diff', base, 'HEAD', '--stat'], { cwd: root }) || '(no change)'}` : ''}` };
  }
  if (!options.phase && state.activeWave?.batch?.length) throw new Error(`several phases are active (${state.activeWave.batch.join(', ')}); pass --phase ID or --phase ${state.activeWave.batch.join(',')}`);
  const requested = options.phase ?? state.activeWave?.phase ?? null;
  if (!requested && !options.quick) throw new Error('no active phase; pass --phase ID, or --quick for an advisory review of a quick change');
  if (!requested) return { candidate, advisory: true, context: `Quick change outside any phase. Staged candidate against HEAD.\n\n${reviewDiff(root, ['diff', '--cached', baseline(root)])}` };
  const phase = phaseById(state, requested);
  activePhase(state, phase);
  const previous = receiptFor(root, phase, type);
  if (previous?.status === 'fail' && previous.candidate === candidate) throw new Error(`the last ${type} review failed on this unchanged candidate; correct it first`);
  const limits = reviewLimits(root);
  if (failedRounds(phase, type) >= limits.maxFailedRounds) throw new Error(roundCapMessage(root, phase, type, limits));
  const validation = requireValidation(root, phase, candidate);
  // Deferred findings and accepted residual risks wait for a human at delivery; re-reporting them would block every round.
  const deferred = observationList(state).filter((finding) => finding.status === 'expert_review' && finding.phase === phase.id);
  const deferredText = deferred.length ? `\n\nAlready deferred to a human expert or accepted as known residual risks before delivery (don't report these again unless this candidate makes them worse):\n${deferred.map((finding) => `- ${finding.severity}: ${finding.summary}${finding.what_could_happen ? `. ${finding.what_could_happen}` : ''}`).join('\n')}` : '';
  // In a batch the candidate also holds the other phases' changes; show this phase's owned paths and say so.
  const siblings = (state.activeWave?.batch ?? []).filter((id) => id !== phase.id);
  const scoped = siblings.length > 0 && phase.owns?.length > 0;
  const batchText = scoped ? `\n\nThis phase is built in one candidate together with ${siblings.join(', ')}, which are reviewed separately. The diff below is limited to this phase's owned paths (${phase.owns.join(', ')}); read other files when needed and report only breakage this phase causes or suffers.` : '';
  const pathspec = scoped ? phase.owns : [];
  return { candidate, phase: phase.id, context: `${reviewPhaseContext(phase)}\nThese done_when and verify items are the contract frozen when the phase was activated. Judge against them; if ROADMAP.yaml words a criterion differently, only a recorded decision below justifies the change.${decisionsContext(phase)}${deferredText}${validationContext(root, phase, validation)}${convergenceContext(root, phase, type, candidate, limits)}${batchText}\n\nStaged candidate against the phase start (${phase.baseCommit ?? 'baseline'}).\n\n${reviewDiff(root, ['diff', '--cached', phase.baseCommit ?? baseline(root)], pathspec)}` };
}

function reviewRecordCommand(type, target, artifact, file) {
  if (target.advisory) return null;
  const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
  if (type === 'discovery') return `riff discovery review --evidence ${file}`;
  if (type === 'delivery') return `riff finish --review ${file}`;
  const [via, rest] = artifact.reviewer.id.split(':');
  const parts = ['riff wave review', target.phase, '--type', type, '--status', artifact.status, '--summary', quote(artifact.summary), '--evidence', file, '--model', quote(`${via}:${rest.split('@')[0]}`), '--reasoning', rest.split('@')[1]];
  if (type === 'security') {
    parts.push('--severity', artifact.findings.map((finding) => finding.severity).sort((a, b) => SEVERITY_ORDER.indexOf(b) - SEVERITY_ORDER.indexOf(a))[0] ?? 'INFO');
    if (artifact.status === 'fail') parts.push('--what-could-happen', quote('<from findings>'), '--affected', quote('<from findings>'), '--recommended-fix', quote('<from findings>'), '--decision-reason', quote('<why it blocks>'));
  }
  return parts.join(' ');
}

// Concurrent reviews (and other sessions) finish at random moments; a short state write waits its turn.
function withLockRetry(root, action, attempts = 120) {
  for (let attempt = 1; ; attempt += 1) {
    try { return withLock(root, action); }
    catch (error) {
      if (attempt >= attempts || !/RIFF is busy/.test(error.message)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
}

const REVIEW_READY = 'RIFF_REVIEW_TARGET_READY';

function reviewTypes(value) {
  const types = [...new Set(String(value).split(',').map((item) => item.trim()).filter(Boolean))];
  if (!types.length || types.some((type) => !REVIEW_TYPES.includes(type))) throw new Error(`--type must be one or more of ${REVIEW_TYPES.join(', ')}, comma-separated`);
  if (types.length > 1 && types.some((type) => !['functional', 'security'].includes(type))) throw new Error('only functional and security reviews can run together (--type functional,security)');
  return types;
}

// One review type, run by the child process that `riff review run` starts for it.
function runSingleReview(root, type, options) {
  const state = readState(root);
  const config = readJson(pathsFor(root).config, false) ?? {};
  const target = reviewTarget(root, state, type, options);
  const language = ({ en: 'English', fr: 'French' })[config.artifactLanguage ?? 'en'] ?? config.artifactLanguage;
  const prompt = buildPrompt(type, `${target.context}\n\nProduct sources: PROJECT.md, ROADMAP.yaml and taste.md at the repository root, when present.\n\nWrite the summary, evidence and findings in ${language}, whatever language other instructions use.`);
  // The parent starts the next review only after this one has finished its Git reads (concurrent git write-tree races on the index lock).
  if (process.env.RIFF_REVIEW_CHILD === '1') process.stderr.write(`${REVIEW_READY}\n`);
  const runAt = now();
  const deadline = Number(process.env.RIFF_REVIEW_DEADLINE_MS) > 0 ? Number(process.env.RIFF_REVIEW_DEADLINE_MS) : null;
  // No lock while the reviewer runs: it can take many minutes and only reads the project.
  let result;
  try { result = runReviewChain({ type, prompt, root, config, deadline }); }
  catch (error) {
    withLockRetry(root, () => event(root, 'review_unavailable', { reviewType: type, phase: target.phase ?? null, candidate: target.candidate, skipped: error.skipped ?? [] }));
    throw error;
  }
  const artifact = toArtifact({ candidate: target.candidate, type, verdict: result.verdict, reviewer: result.reviewer, runAt });
  const file = `${stateDirFor(root)}/reviews/${type}-${target.candidate.slice(0, 12)}-${runAt.replace(/[:.]/g, '-')}.json`;
  writeJson(localPath(root, file), artifact);
  let round = null;
  withLockRetry(root, () => {
    if (target.phase) {
      const current = readState(root);
      const phase = phaseById(current, target.phase);
      if (noteReviewRound(phase, type, { candidate: target.candidate, status: artifact.status, summary: artifact.summary, findings: artifact.findings, at: runAt })) saveState(root, current);
      round = phase.reviewRounds?.[type] ? { failed: phase.reviewRounds[type].failed, limit: reviewLimits(root).maxFailedRounds } : null;
    }
    event(root, 'review_run', { reviewType: type, phase: target.phase ?? null, candidate: target.candidate, status: artifact.status, reviewer: result.reviewer.id, sameFamily: result.reviewer.sameFamily, skipped: result.reviewer.skipped, artifact: file, failedRounds: round?.failed ?? null });
  });
  const conflicts = artifact.findings.filter((finding) => /^CONFLICT:/i.test(String(finding.title ?? '')));
  const note = conflicts.length
    ? 'The reviewer reports conflicting contracts. Choose one and record why with riff wave decision, or park the phase for the human; do not flip the earlier fix back.'
    : round && round.failed >= round.limit ? `This was failed ${type} round ${round.failed} of ${round.limit}; record it, then park the phase for the human (riff review run explains how).` : undefined;
  process.stdout.write(`${JSON.stringify({ type, ...(target.phase ? { phase: target.phase } : {}), artifact: file, status: artifact.status, summary: artifact.summary, reviewer: result.reviewer, findings: artifact.findings, advisory: Boolean(target.advisory), record: reviewRecordCommand(type, target, artifact, file), ...(round ? { failedRounds: round.failed, maxFailedRounds: round.limit } : {}), ...(note ? { note } : {}) }, null, 2)}\n`);
}

const REVIEW_KILL_GRACE_MS = 30_000;

// Runs one child CLI per review (type and phase) in its own process group, bounded by the shared deadline.
// `started` resolves once the child has resolved its target, so the next child can start.
function spawnReview(root, { type, phase }, options, deadline, children) {
  const args = [SCRIPT, 'review', 'run', '--type', type, ...(phase ? ['--phase', phase] : []), ...(options.quick ? ['--quick'] : []), ...(options.since ? ['--since', String(options.since)] : [])];
  let ready;
  const started = new Promise((resolve) => { ready = resolve; });
  const finished = new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, RIFF_REVIEW_CHILD: '1', RIFF_REVIEW_DEADLINE_MS: String(deadline) } });
    children.add(child);
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.includes(REVIEW_READY)) ready();
    });
    const kill = (signal) => { try { process.kill(-child.pid, signal); } catch { /* already gone */ } };
    const timer = setTimeout(() => { timedOut = true; kill('SIGTERM'); setTimeout(() => kill('SIGKILL'), 10_000).unref(); }, Math.max(0, deadline - Date.now()) + REVIEW_KILL_GRACE_MS);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      // The child is gone; a reviewer CLI that ignored SIGTERM must not outlive it.
      if (timedOut) kill('SIGKILL');
      children.delete(child);
      ready();
      resolve({ type, phase, code, signal, stdout, stderr: stderr.replace(`${REVIEW_READY}\n`, ''), timedOut });
    });
  });
  return { started, finished };
}

async function cmdReview(tokens) {
  const root = gitRoot();
  if (tokens[0] !== 'run') throw new Error('use riff review run --type discovery|functional|security|delivery|functional,security [--phase ID[,ID...]|--quick] [--since REF] [--timeout-minutes N]');
  const options = parseOptions(tokens.slice(1));
  const types = reviewTypes(optionRequired(options, 'type'));
  if (process.env.RIFF_REVIEW_CHILD === '1') {
    if (types.length !== 1) throw new Error('a review child runs exactly one type');
    runSingleReview(root, types[0], options);
    return;
  }
  const config = readJson(pathsFor(root).config, false) ?? {};
  const minutes = options.timeout_minutes === undefined ? reviewerConfig(config).runTimeoutMinutes : Number(options.timeout_minutes);
  if (!(minutes > 0)) throw new Error('--timeout-minutes must be a positive number');
  const deadline = Date.now() + minutes * 60_000;
  const children = new Set();
  const stopChildren = (signal) => {
    for (const child of children) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ } }
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', stopChildren);
  process.once('SIGTERM', stopChildren);
  // --phase a,b reviews every phase of a batch on the same candidate.
  const phases = options.phase ? [...new Set(String(options.phase).split(',').map((item) => item.trim()).filter(Boolean))] : [null];
  const runs = [];
  for (const job of phases.flatMap((phase) => types.map((type) => ({ type, phase })))) {
    const child = spawnReview(root, job, options, deadline, children);
    runs.push(child.finished);
    await child.started;
  }
  const results = await Promise.all(runs);
  const outcomes = results.map((result) => {
    if (result.timedOut) {
      withLockRetry(root, () => event(root, 'review_timeout', { reviewType: result.type, phase: result.phase, minutes }));
      return { type: result.type, phase: result.phase, status: 'timeout', error: `the ${result.type} review exceeded ${minutes} minutes and was stopped; nothing was recorded. Retry later or raise --timeout-minutes.` };
    }
    if (result.code !== 0) return { type: result.type, phase: result.phase, status: 'error', error: result.stderr.replace(/^RIFF: /, '').trim() || `review process exited ${result.code ?? result.signal}` };
    try { return JSON.parse(result.stdout); }
    catch { return { type: result.type, phase: result.phase, status: 'error', error: 'review process printed no JSON result' }; }
  });
  const failed = outcomes.filter((outcome) => ['timeout', 'error'].includes(outcome.status));
  if (results.length === 1) {
    // One review keeps the historical single-object output and error text.
    if (failed.length) fail(failed[0].error);
    process.stdout.write(`${JSON.stringify(outcomes[0], null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify({ reviews: outcomes, record: outcomes.map((outcome) => outcome.record).filter(Boolean) }, null, 2)}\n`);
  if (failed.length) process.exitCode = 1;
}

function cmdContext(tokens) {
  const root = gitRoot();
  const state = readState(root);
  // Output is always JSON; --json is accepted so hosts can ask for it explicitly.
  const requested = parseOptions(tokens)._[0];
  const phase = requested ? phaseById(state, requested) : state.phases.find((item) => item.status === 'active') ?? selectReadyPhase(state.phases);
  const candidate = candidateTree(root);
  const generated = /^(?:\.riff-(?:cli|codex)$|\.riff-(?:data|codex-state)(?:\/|$)|\.agents(?:\/|$)|\.codex(?:\/|$)|\.uxtest(?:\/|$))/;
  const dirty = run('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root })
    .split('\n').filter(Boolean).some((line) => {
      const relative = line.slice(3).replace(/^\"|\"$/g, '');
      return !generated.test(relative) && (line.startsWith('??') || line[1] !== ' ');
    });
  const checkpoint = phase?.checkpoint ?? null;
  const discovery = currentDiscovery(root, state);
  process.stdout.write(`${JSON.stringify({
    schema: 'riff.wave-context/1',
    phase: phase ? { id: phase.id, title: phase.title, status: phase.status, outcome: phase.outcome, done_when: phase.done_when ?? [], verify: phase.verify ?? [], verificationRequired: phase.verificationRequired ?? null, improvementPassRecorded: Boolean(phase.improvementPass),
      reviewRounds: Object.fromEntries(['functional', 'security'].map((type) => [type, failedRounds(phase, type)])), maxFailedRounds: reviewLimits(root).maxFailedRounds, decisions: phase.decisions ?? [] } : null,
    checkpoint,
    modelAdvice: phase && state.modelAdvice?.phase === phase.id ? state.modelAdvice : null,
    modelAdvicePlan: phase && state.modelAdvicePlan?.phase === phase.id ? state.modelAdvicePlan : null,
    candidate,
    checkpointStale: Boolean(checkpoint && (checkpoint.candidate !== candidate || dirty)),
    discovery: discovery ? { digest: discovery.snapshot.digest, stale: discovery.stale, files: discovery.snapshot.files } : null,
    references: checkpoint?.references ?? discovery?.snapshot.files ?? [],
  }, null, 2)}\n`);
}

function cmdWave(tokens) {
  const root = gitRoot();
  const action = tokens[0] ?? 'select';
  const options = parseOptions(tokens.slice(1));
  let state;
  try { state = readState(root); } catch (error) { fail(`${error.message}; run riff init`); }
  try {
    const autonomy = autonomyMode(root);
    if (action === 'sync') {
      const synced = syncRoadmap(root, { preserveLegacyVerification: options.preserve_legacy_verification === true });
      process.stdout.write(`${synced.state.phases.length} roadmap phases synchronized.\n${synced.notes.map((note) => `- ${note}\n`).join('')}`);
      return;
    }
    if (action === 'select' && options.parallel === true) {
      process.stdout.write(`${JSON.stringify(selectParallelBatch(state.phases), null, 2)}\n`);
      return;
    }
    if (action === 'select' || action === 'resume') {
      const requested = options._[0];
      if (action === 'resume') discoveryGate(root, state);
      if (action === 'resume' && requested) {
        const resumable = phaseById(state, requested);
        if (['parked', 'blocked', 'awaiting_human'].includes(resumable.status)) {
          const active = activePhases(state).filter((item) => item.id !== resumable.id);
          if (active.length && !canRunBeside(resumable, active)) throw new Error(`phase ${active[0].id} is active; resume or park it first`);
          const reason = optionRequired(options, 'reason');
          discoveryGate(root, state);
          resumable.attempts = 0;
          // A resume records the owner's decision and allows one more round per review type, never a fresh
          // count: repeated resumes cannot turn the round cap into an endless loop.
          const maxFailed = reviewLimits(root).maxFailedRounds;
          for (const record of Object.values(resumable.reviewRounds ?? {})) {
            if (record?.failed >= maxFailed) { record.resetAtRound = Number(record.total ?? record.failed); record.failed = maxFailed - 1; }
          }
          if (resumable.reviewRounds) addDecision(resumable, { note: reason, source: `resume from ${resumable.status}` });
          resumable.baseCommit ??= baseline(root);
          markPhase(root, state, resumable, 'active', reason);
          process.stdout.write(`Resumed ${requested}.\n`);
          return;
        }
      }
      const phase = selectPhase(state, requested);
      if (action === 'resume' && phase?.status === 'active' && !phase.baseCommit) {
        phase.baseCommit = baseline(root);
        saveState(root, state);
      }
      if (!phase) {
        const unfinished = state.phases.filter((item) => !TERMINAL_PHASE_STATES.has(item.status));
        process.stdout.write(unfinished.length ? 'No phase is ready. RIFF will follow dependencies automatically; inspect only recorded hard blockers.\n' : 'Roadmap complete.\n');
        return;
      }
      if (action === 'resume' && phase.status === 'active') {
        const headResult = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8' });
        const head = headResult.status === 0 ? headResult.stdout.trim() : null;
        const tree = head ? run('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root }) : null;
        const clean = !run('git', ['status', '--porcelain'], { cwd: root });
        if (head && head !== phase.baseCommit && clean && phase.validation?.candidate === tree) {
          // Complete only through the same validation/review gates as normal delivery.
          try { completePhase(root, state, phase, 'HEAD'); return; }
          catch (error) { process.stdout.write(`Recovery needs attention: ${error.message}\n`); }
        }
        const candidate = candidateTree(root);
        const evidenceCurrent = phase.validation?.status === 'pass' && phase.validation.executed && phase.validation.candidate === candidate && evidenceValid(root, phase.validation?.evidence) && evidenceValid(root, phase.validation?.verification);
        process.stdout.write(`Recovery: preserved working tree and index; ${evidenceCurrent ? 'validation evidence matches the staged candidate' : 'validate the candidate before delivery'}.\n`);
      }
      process.stdout.write(`${JSON.stringify(phase, null, 2)}\n`);
      return;
    }
    const id = options._[0];
    if (!id) throw new Error(`riff wave ${action} requires a phase id`);
    const phase = phaseById(state, id);
    if (action === 'activate') {
      const selected = selectPhase(state, id);
      discoveryGate(root, state);
      selected.baseCommit ??= baseline(root);
      markPhase(root, state, selected, 'active');
      process.stdout.write(`Activated ${id}.\n`);
    } else if (['park', 'block', 'await'].includes(action)) {
      activePhase(state, phase);
      const status = action === 'park' ? 'parked' : action === 'block' ? 'blocked' : 'awaiting_human';
      const blockerKind = autonomy === 'loop' ? loopStopKind(root, state, phase, options) : options.kind ?? null;
      markPhase(root, state, phase, status, optionRequired(options, 'reason'), blockerKind);
      process.stdout.write(`${id} is ${status}.\n`);
    } else if (action === 'retry') {
      activePhase(state, phase);
      const reason = optionRequired(options, 'reason');
      if (state.lastValidation?.phase !== id || state.lastValidation?.status !== 'fail') {
        throw new Error('wave retry requires a recorded failed validation for this phase');
      }
      if ((phase.attempts ?? 0) >= 1) throw new Error('the single targeted correction has already been used; park the phase');
      phase.attempts = 1;
      if (discoveryEnrolled(root, state)) phase.retryCandidate = state.lastValidation.candidate;
      saveState(root, state);
      event(root, 'targeted_retry', { phase: id, reason });
      process.stdout.write(`Recorded the one targeted correction for ${id}.\n`);
    } else if (action === 'decision') {
      activePhase(state, phase);
      const note = String(optionRequired(options, 'note')).trim();
      if (note.length < 10) throw new Error('--note must explain the decision and why (at least 10 characters)');
      const type = options.type ?? null;
      if (type !== null && !['functional', 'security', 'contract'].includes(type)) throw new Error('--type must be functional, security or contract');
      addDecision(phase, { note, type });
      saveState(root, state);
      event(root, 'phase_decision', { phase: id, type, note: clip(note, 200) });
      process.stdout.write(`Decision recorded for ${id}; every later review of this phase receives it.\n`);
    } else if (action === 'risk') {
      recordResidualRisk(root, state, phase, options);
    } else if (action === 'checkpoint') {
      checkpointPhase(root, state, phase, options);
    } else if (action === 'validate') {
      activePhase(state, phase);
      const validation = validateCandidate(root, state, phase, options);
      process.stdout.write(`Validation ${validation.status} recorded for ${id}.\n${validation.verification ? `Report: ${path.join(root, validation.verification.path)}\n` : 'Declaration only; use --run for completion evidence.\n'}`);
      if (validation.status === 'fail') process.exitCode = 1;
    } else if (action === 'review') {
      activePhase(state, phase);
      const receipt = recordReview(root, state, phase, options);
      process.stdout.write(`${receipt.type} review ${receipt.status} recorded for ${id} at ${receipt.candidate}.\n`);
    } else if (action === 'complete') {
      const commit = optionRequired(options, 'commit');
      if (phase.status === 'completed' && phase.commit === run('git', ['rev-parse', commit], { cwd: root })) { process.stdout.write(`${id} already completed.\n`); return; }
      if (options.accept_risks === true) acceptPhase(root, state, phase, commit, options);
      else completePhase(root, state, phase, commit);
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

function claudeWindow(root) {
  const fromEnv = process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
  if (fromEnv) return { value: Number(fromEnv), source: 'CLAUDE_CODE_AUTO_COMPACT_WINDOW' };
  for (const file of [path.join(root, CLAUDE_SETTINGS), path.join(root, '.claude', 'settings.json'), path.join(homedir(), '.claude', 'settings.json')]) {
    let value;
    try { value = readJson(file, false)?.autoCompactWindow; } catch { continue; }
    if (value !== undefined) return { value: Number(value), source: file };
  }
  return null;
}

function claudeDoctor(root) {
  const results = [];
  try {
    const settings = readJson(path.join(root, CLAUDE_SETTINGS));
    const count = Object.values(settings.hooks ?? {}).flat().flatMap((group) => group.hooks ?? []).filter((hook) => String(hook.command ?? '').includes(HOOK_ID)).length;
    if (count < 6) throw new Error(`only ${count}/6 RIFF hook groups found; run riff resync`);
    results.push(['ok', 'Claude Code hooks', `${count} managed groups in ${CLAUDE_SETTINGS}`]);
  } catch (error) { results.push(['error', 'Claude Code hooks', error.message]); }
  const window = claudeWindow(root);
  if (!window || !Number.isFinite(window.value)) results.push(['warn', 'Claude Code compaction', `no autoCompactWindow: Claude Code compacts near 967K; run riff resync to set ${CLAUDE_COMPACT_WINDOW}`]);
  else if (window.value > CLAUDE_COMPACT_WINDOW) results.push(['warn', 'Claude Code compaction', `${window.value} from ${window.source} is above ${CLAUDE_COMPACT_WINDOW}`]);
  else results.push(['ok', 'Claude Code compaction', `${window.value} from ${window.source}`]);
  let known = {};
  try { known = readJson(path.join(homedir(), '.claude', 'plugins', 'known_marketplaces.json'), false) ?? {}; } catch { /* unreadable registry */ }
  const location = known[CLAUDE_MARKETPLACE]?.installLocation ?? known[CLAUDE_MARKETPLACE]?.source?.path;
  if (location && path.resolve(location) === PLUGIN_ROOT) results.push(['ok', 'Claude Code plugin', `marketplace ${CLAUDE_MARKETPLACE} -> ${PLUGIN_ROOT}`]);
  else results.push(['warn', 'Claude Code plugin', `${location ? `marketplace ${CLAUDE_MARKETPLACE} points to ${location}` : `marketplace ${CLAUDE_MARKETPLACE} not registered`}; once per machine run: claude plugin marketplace add ${PLUGIN_ROOT}`]);
  results.push(executable('claude') ? ['ok', 'executable claude', 'available'] : ['warn', 'executable claude', 'missing; Claude Code host unavailable on this machine']);
  return results;
}

function doctor(root, recordApproval = false) {
  const files = pathsFor(root);
  const results = [];
  const add = (status, name, detail) => results.push({ status, name, detail });
  let config = null;
  let state = null;
  try {
    config = readJson(files.config);
    if (config.version !== 1) throw new Error('unsupported version');
    const autonomy = config.preferences?.autonomy ?? 'loop';
    if (!AUTONOMY_MODES.has(autonomy)) throw new Error(`unsupported autonomy mode ${autonomy}`);
    add('ok', 'configuration', `schema version 1, autonomy=${autonomy}`);
  }
  catch (error) { add('error', 'configuration', error.message); }
  try { state = readJson(files.state); validateState(state); add('ok', 'state', `${state.phases.length} phases`); }
  catch (error) { add('error', 'state', error.message); }
  const unspecified = (state?.phases ?? []).filter((phase) => !TERMINAL_PHASE_STATES.has(phase.status) && (!phase.done_when?.length || !phase.verify?.length)).map((phase) => phase.id);
  if (unspecified.length) add('warn', 'phase contracts', `${unspecified.join(', ')} lack done_when or verify in ROADMAP.yaml; the agent will infer them from outcome and demo`);
  if (existsSync(files.roadmap)) {
    try { const roadmap = readRoadmap(root); add('ok', 'roadmap', `${roadmap.phases.length} phases parse correctly`); }
    catch (error) { add('error', 'roadmap', error.message); }
  } else add('ok', 'roadmap', 'not created yet; run the start skill');
  let hooks = null;
  try {
    hooks = readJson(files.hooks);
    const count = Object.values(hooks.hooks ?? {}).flat().flatMap((group) => group.hooks ?? []).filter((hook) => String(hook.command ?? '').includes(HOOK_ID)).length;
    const systemPolicy = managedHookPolicy(root, PLUGIN_ROOT);
    if (!systemPolicy && count < 6) throw new Error(`only ${count}/6 RIFF hook groups found`);
    if (systemPolicy && count) add('warn', 'Codex hooks', 'system policy and duplicate project hooks; run resync');
    else add('ok', 'Codex hooks', systemPolicy ? '6 hooks configured by system policy; project duplicates removed' : `${count} managed groups installed`);
  } catch (error) { add('error', 'Codex hooks', error.message); }
  for (const result of claudeDoctor(root)) add(...result);
  const codexHome = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(homedir(), '.codex');
  const disabledAt = [path.join(root, '.codex', 'config.toml'), path.join(codexHome, 'config.toml')].find(configDisablesHooks);
  if (disabledAt && !managedHookPolicy(root, PLUGIN_ROOT)) add('error', 'hook feature', `disabled in ${disabledAt}`); else add('ok', 'hook feature', managedHookPolicy(root, PLUGIN_ROOT) ? 'enabled by system requirements' : 'not disabled in project or user config');
  if (config && hooks && managedHookPolicy(root, PLUGIN_ROOT)) {
    add('ok', 'hook approval', 'trusted by system policy on next configuration load; no user approval marker needed');
  } else if (config && hooks) {
    const currentHash = hooksHash(hooks);
    if (recordApproval) { config.hooks ??= {}; config.hooks.approvedHash = currentHash; writeJson(files.config, config); }
    if (config.hooks?.approvedHash === currentHash) add('ok', 'hook approval', 'recorded for the current hook hash');
    else add('warn', 'hook approval', 'pending or changed; review with /hooks, then run riff doctor --record-hooks-approved');
  }
  try {
    const framework = lstatSync(files.framework);
    const resolved = path.resolve(root, readlinkSync(files.framework));
    if (!framework.isSymbolicLink() || resolved !== PLUGIN_ROOT) throw new Error(`expected ${frameworkDirFor(root)} -> ${PLUGIN_ROOT}`);
    add('ok', 'framework symlink', `${frameworkDirFor(root)} -> ${PLUGIN_ROOT}`);
    if (stateDirFor(root) === CODEX_STATE_DIR) add('warn', 'layout', `pre-rename ${CODEX_STATE_DIR}/; run riff resync when no phase is active to move it to ${STATE_DIR}/ with a backup`);
  } catch (error) { add('error', 'framework symlink', error.message); }
  for (const name of readFileNames(path.join(PLUGIN_ROOT, 'skills'))) {
    const target = path.join(root, '.agents', 'skills', `riff-codex-${name}`);
    let valid = false;
    try { valid = lstatSync(target).isSymbolicLink() && pointsTo(target, path.join(PLUGIN_ROOT, 'skills', name)); } catch { /* missing */ }
    if (!valid) add('warn', `skill ${name}`, 'project symlink missing or preserved because a foreign entry owns the path');
  }
  for (const name of ['git', 'node', 'bun']) add(executable(name) ? 'ok' : 'error', `executable ${name}`, executable(name) ? 'available' : 'missing');
  for (const name of ['pre-commit', 'commit-msg']) {
    try {
      const target = path.join(gitHooksDir(root), name);
      const valid = existsSync(target) && !lstatSync(target).isSymbolicLink() && readFileSync(target, 'utf8').includes(GIT_HOOK_MARKER);
      add(valid ? 'ok' : 'error', `Git ${name}`, valid ? 'installed and chained' : 'missing RIFF wrapper');
    } catch (error) { add('error', `Git ${name}`, error.message); }
  }
  try { dashboardData(root); add('ok', 'dashboard state', 'readable'); }
  catch (error) { add('error', 'dashboard state', error.message); }
  for (const reviewer of reviewerAvailability(config)) add(reviewer.ok ? 'ok' : 'warn', `reviewer ${reviewer.via}`, reviewer.ok ? reviewer.detail : `${reviewer.detail}; riff review run will skip it`);
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
    nextReady: selectReadyPhase(state.phases),
    lastCommit: state.lastCommit ?? gitCommit,
    lastValidation: state.lastValidation,
    reviews: {
      functional: functional ? { ...functional, valid: receiptValidity(root, phaseById(state, functional.phase), functional) } : null,
      security: security ? { ...security, valid: receiptValidity(root, phaseById(state, security.phase), security) } : null,
    },
    securityFindings: observationList(state),
    humanAction: state.humanAction,
    events: recentEvents(root),
    model: state.model,
    validationNeeds: state.validationNeeds,
  };
}

async function dashboardIdentity(url) {
  let response;
  try {
    response = await fetch(`${url}/api/instance`, { signal: AbortSignal.timeout(1_000) });
  } catch {
    return { reachable: false, frameworkRoot: null, instance: null };
  }
  if (!response.ok) return { reachable: true, frameworkRoot: null, instance: null };
  try {
    const data = await response.json();
    return {
      reachable: true,
      frameworkRoot: typeof data.framework_root === 'string' ? path.resolve(data.framework_root) : null,
      instance: typeof data.dashboard_instance === 'string' ? data.dashboard_instance : null,
      pid: Number.isInteger(data.pid) ? data.pid : null,
    };
  } catch {
    return { reachable: true, frameworkRoot: null, instance: null };
  }
}

function dashboardFingerprint(dashboardRoot) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'bun.lock') continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  };
  visit(dashboardRoot);
  visit(path.join(PLUGIN_ROOT, 'lib'));
  files.sort();
  return sha(files.map((file) => `${path.relative(dashboardRoot, file)}:${sha(readFileSync(file))}`).join('\n'));
}

async function dashboardTarget(startPort, explicitPort, dashboardInstance) {
  for (let offset = 0; offset < 20; offset += 1) {
    const port = startPort + offset;
    const url = `http://127.0.0.1:${port}`;
    const identity = await dashboardIdentity(url);
    if (!identity.reachable && await portAvailable(port)) return { port, url, reuse: false };
    if (identity.frameworkRoot === PLUGIN_ROOT && identity.instance === dashboardInstance) return { port, url, reuse: true };
    if (explicitPort) throw new Error(`dashboard port ${port} is already served by another process`);
  }
  throw new Error(`no available dashboard port from ${startPort} to ${startPort + 19}`);
}

async function waitForDashboard(url, dashboardInstance) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const identity = await dashboardIdentity(url);
    if (identity.frameworkRoot === PLUGIN_ROOT && identity.instance === dashboardInstance) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

async function cmdDashboard(tokens) {
  const options = parseOptions(tokens);
  const root = gitRoot();
  if (options.snapshot || options.check) {
    try {
      const data = dashboardData(root);
      if (options.check) process.stdout.write('Dashboard state is readable.\n');
      else process.stdout.write(`${data.project.name ?? 'Unshaped project'}\nProgress: ${data.progress.completed}/${data.progress.total}\nActive: ${activeLabel(data.activeWave)}\nNext ready: ${data.nextReady?.id ?? 'none'}\nHuman action: ${data.humanAction?.reason ?? 'none'}\n`);
    } catch (error) { fail(error.message); }
    return;
  }
  registerDashboardProject(root);
  if (!executable('bun')) fail('Bun is required to run the shared dashboard');

  const dashboardRoot = path.join(PLUGIN_ROOT, 'dashboard');
  if (!existsSync(path.join(dashboardRoot, 'node_modules'))) {
    process.stdout.write('Installing dashboard dependencies once...\n');
    const installed = spawnSync('bun', ['install', '--production'], { cwd: dashboardRoot, stdio: 'inherit' });
    if (installed.status !== 0) fail('dashboard dependency installation failed');
  }

  const processFile = path.join(homedir(), '.config', 'riff-dashboard', 'server.json');
  const prior = readJson(processFile, false);
  const dashboardInstance = dashboardFingerprint(dashboardRoot);
  const requestedPort = Number(options.port ?? prior?.port ?? 4000);
  if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65_535) fail('--port must be a valid TCP port');
  const priorUrl = typeof prior?.url === 'string' ? prior.url : `http://127.0.0.1:${requestedPort}`;
  const priorIdentity = await dashboardIdentity(priorUrl);
  if (
    priorIdentity.reachable &&
    priorIdentity.frameworkRoot === PLUGIN_ROOT &&
    priorIdentity.instance === prior?.dashboardInstance &&
    priorIdentity.pid === prior?.pid &&
    prior?.dashboardInstance !== dashboardInstance &&
    Number.isInteger(prior?.pid)
  ) {
    try { process.kill(prior.pid, 'SIGTERM'); } catch { /* stale process record */ }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (!(await dashboardIdentity(priorUrl)).reachable) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  let target;
  try { target = await dashboardTarget(requestedPort, options.port !== undefined, dashboardInstance); }
  catch (error) { fail(error.message); }
  const { port, url, reuse } = target;
  if (!reuse) {
    const logFile = path.join(path.dirname(processFile), 'server.log');
    const log = openSync(logFile, 'a', 0o600);
    const child = spawn('bun', ['run', 'server.ts'], {
      cwd: dashboardRoot,
      detached: true,
      stdio: ['ignore', log, log],
      env: { ...process.env, PORT: String(port), RIFF_DASHBOARD_INSTANCE: dashboardInstance },
    });
    closeSync(log);
    child.unref();
    if (!(await waitForDashboard(url, dashboardInstance))) fail(`dashboard failed to start at ${url}; inspect ${logFile}`);
    writeJson(processFile, { version: 1, pid: child.pid, port, url, dashboardRoot, frameworkRoot: PLUGIN_ROOT, dashboardInstance, startedAt: now() });
  } else if (prior?.url !== url || prior?.frameworkRoot !== PLUGIN_ROOT || prior?.dashboardInstance !== dashboardInstance) {
    writeJson(processFile, { version: 1, pid: prior?.pid ?? null, port, url, dashboardRoot, frameworkRoot: PLUGIN_ROOT, dashboardInstance, startedAt: prior?.startedAt ?? now() });
  }
  if (!options.no_open && process.platform === 'darwin') spawnSync('open', [url], { stdio: 'ignore' });
  process.stdout.write(`RIFF dashboard: ${url}\nShared dashboard with observation triage, independent from Codex or Claude.\n`);
}

// Only the files this tool call named. Bash calls name none; the pre-commit hook scans what they staged.
function changedFiles(root, payload) {
  const files = new Set();
  const input = payload?.tool_input ?? {};
  for (const key of ['file_path', 'notebook_path', 'path']) if (typeof input[key] === 'string' && input[key].trim()) files.add(input[key].trim());
  const patch = [input.command, input.input, input.patch].filter((value) => typeof value === 'string').join('\n');
  for (const match of patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm)) files.add((match[1] ?? match[2]).trim());
  return [...files].map((file) => path.resolve(root, file)).filter((file) => file.startsWith(`${root}${path.sep}`) && existsSync(file) && statSync(file).isFile());
}

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk|rk|pk)-(?:live|prod)-[A-Za-z0-9_-]{16,}\b/,
  /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/,
  /\bsk-proj-[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];

function scanFile(file, text) {
  if (text === undefined) {
    try { text = readFileSync(file, 'utf8'); } catch { return []; }
  }
  const relative = path.basename(file);
  const findings = [];
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) findings.push({ kind: 'secret', severity: 'HIGH', summary: `A likely production secret is present in ${relative}.` });
  if (/migrations?|\.sql$/i.test(file) && /\b(?:DROP\s+(?:TABLE|COLUMN|SCHEMA)|TRUNCATE|DELETE\s+FROM)\b/i.test(text)) findings.push({ kind: 'destructive_migration', severity: 'HIGH', summary: `A destructive database operation is present in ${relative}.` });
  const isTest = /\.(?:test|spec)\.[^.]+$|(?:^|[\\/])__tests__[\\/]/i.test(file);
  const isRoute = !isTest && /(?:route|api|handler|controller)/i.test(file) && /\.(?:[cm]?[jt]sx?|py|go|rs)$/.test(file);
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
  // Phase evidence and diagnostic scripts are run directly, not application modules.
  if (/^(?:\.planning|\.riff-data|\.riff-codex-state|\.uxtest)\//.test(relative)) return null;
  if (/(?:^|\/)(?:index|routes?|pages?|app|scripts?|migrations?|seeds?|fixtures?|__tests__)(?:\/|\.)|\.(?:test|spec|config|d)\./i.test(relative)) return null;
  let added = false;
  try { added = /^(?:\?\?|A | A)/.test(run('git', ['status', '--short', '--', relative], { cwd: root })); } catch { /* advisory */ }
  if (!added) return null;
  const moduleName = base.replace(/\.[^.]+$/, '');
  try {
    const references = run('git', ['grep', '-l', '-F', moduleName, '--', '*.js', '*.jsx', '*.ts', '*.tsx', '*.mjs', '*.cjs', '*.mts', '*.cts'], { cwd: root })
      .split('\n').filter((entry) => entry && entry !== relative);
    if (references.length) return null;
  } catch { /* no references */ }
  return { kind: 'orphan_file', severity: 'LOW', summary: `${base} is newly added but is not visibly imported or routed.` };
}

function plainFinding(finding) {
  if (finding.kind === 'environment_file') return { ...finding, what_could_happen: 'Private environment configuration could be committed even when its credentials are not recognized.', affected: 'The services configured by this file.', recommended_fix: 'Unstage the environment file and commit only a sanitized .env.example template.', decision_reason: 'RIFF stops because private environment files must stay out of Git.' };
  if (finding.kind === 'secret') return { ...finding, what_could_happen: 'Someone could use the exposed credential to access a service.', affected: 'The service account and any data it can reach.', recommended_fix: 'Remove and rotate the credential, then use an approved secret store.', decision_reason: 'RIFF stops because the credential pattern is high confidence.' };
  if (finding.kind === 'destructive_migration') return { ...finding, what_could_happen: 'The migration could permanently delete production data.', affected: 'Users whose records are stored in the changed tables.', recommended_fix: 'Use a reviewed expand-and-contract migration or obtain explicit destructive approval.', decision_reason: 'RIFF stops because the destructive SQL is explicit.' };
  if (finding.kind === 'orphan_file') return { ...finding, what_could_happen: 'The new code may never run because nothing connects it to the application.', affected: 'Users expecting the new behavior.', recommended_fix: 'Wire the file into an entry point or remove it if it is unnecessary.', decision_reason: 'RIFF continues because framework routing can make this heuristic incomplete.' };
  if (finding.kind === 'todo_without_reference') return { ...finding, what_could_happen: 'Required follow-up work may be forgotten.', affected: 'The feature or users relying on the unfinished path.', recommended_fix: 'Link the TODO to an issue or durable RIFF artifact.', decision_reason: 'RIFF continues because the TODO does not itself prove unsafe behavior.' };
  return { ...finding, what_could_happen: 'A user may reach data or behavior that was not intended for them.', affected: 'Users and data handled by this boundary.', recommended_fix: 'Review the changed boundary and add the missing explicit control if the warning is valid.', decision_reason: 'RIFF continues because this is a heuristic warning that needs fresh human-readable review.' };
}

// Returns false when the finding is already a recorded, unresolved observation.
function parkForFinding(root, finding) {
  let state;
  try { state = readState(root); } catch { return true; }
  // In a batch the finding belongs to the active phase that owns the file, else to the lead phase.
  const actives = activePhases(state);
  const active = actives.find((phase) => finding.file && phase.owns?.length && ownsOverlap(phase.owns, [finding.file])) ?? actives.find((phase) => phase.id === state.activeWave?.phase) ?? actives[0];
  const entry = { ...finding, phase: active?.id ?? null, candidate: null, reviewedAt: now() };
  // The same rule on the same file stays one observation; only a finding already marked resolved reopens.
  const key = JSON.stringify([entry.kind, entry.summary, entry.affected, entry.phase]);
  const known = observationList(state).find((item) => JSON.stringify([item.kind, item.summary, item.affected, item.phase]) === key);
  if (known && known.status !== 'resolved') return false;
  state.securityFindings.push(entry);
  if (active && ['HIGH', 'CRITICAL'].includes(finding.severity)) {
    active.status = 'parked';
    active.reason = finding.decision_reason;
    active.blockerKind = 'validation-failure';
    setActiveWave(state, state.activeWave?.phase);
    state.humanAction = { phase: active.id, status: 'parked', kind: 'validation-failure', reason: finding.decision_reason };
  }
  saveState(root, state);
  return true;
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
  const command = String(payload.tool_input?.command ?? payload.tool_input?.cmd ?? serialized);
  const destructive = [
    /\brm\s+-[^\n]*r[^\n]*f[^\n]*(?:\s\/\s|\s~\/?\s|\$HOME|\.\.)/i,
    /\bgit\s+(?:reset\s+--hard|clean\s+-[^\n]*f)/i,
    /\bgit\s+push\b[^\n;&|]*(?:\s--force(?:[\s;&|]|=|$)|\s-[A-Za-z]*f[A-Za-z]*(?:[\s;&|]|$))/,
    /\b(?:drop\s+(?:database|table)|truncate\s+table)\b/i,
  ].find((pattern) => pattern.test(command));
  if (destructive) {
    event(root, 'hook_block', { hook: 'destructive_guard', tool: payload.tool_name });
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'RIFF blocked a high-confidence destructive command. It could erase repository or database data. Narrow the target or obtain explicit destructive approval.' } };
  }
  if (SECRET_PATTERNS.some((pattern) => pattern.test(serialized))) {
    event(root, 'hook_block', { hook: 'secret_guard', tool: payload.tool_name });
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'RIFF blocked a likely production credential before it reached the tool. Remove the secret and use an approved secret store.' } };
  }
  const oldRiff = path.join(homedir(), 'DEV', 'frameworks', 'riff');
  const within = (parent, candidate) => {
    const relative = path.relative(parent, path.resolve(candidate));
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  };
  const strings = (value) => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
  const absolutePaths = strings(payload.tool_input).flatMap((value) =>
    [...value.matchAll(/(["'])(\/(?:Users|home|opt|var|tmp|private)\/.*?)\1|\/(?:Users|home|opt|var|tmp|private)\/[^\s"'`\\;,\)\]}]+/g)].map((match) => match[2] ?? match[0]));
  const legacy = root !== oldRiff && absolutePaths.some((candidate) => within(oldRiff, candidate));
  const outside = legacy || absolutePaths.some((candidate) => !within(root, candidate));
  if (outside) {
    event(root, 'hook_warning', { hook: 'boundary', tool: payload.tool_name });
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: legacy ? 'Boundary warning: this tool references the read-only legacy RIFF repository. Do not modify it, change its branch, or run processes there.' : 'Boundary warning: this tool references a path outside the current Git repository. Confirm that external path is within the user-authorized scope before writing.' } };
  }
  return {};
}

function postTool(root, payload) {
  const files = changedFiles(root, payload);
  accumulateValidation(root, files);
  // Each finding keeps its file so a batch can attribute it to the phase that owns that file.
  const detected = files.flatMap((file) => [...scanFile(file), orphanFinding(root, file)].filter(Boolean)
    .map((finding) => ({ ...plainFinding(finding), file: path.relative(root, file).replaceAll(path.sep, '/') })));
  const findings = detected.filter((finding) => parkForFinding(root, finding));
  for (const finding of findings) event(root, 'hook_finding', { hook: finding.kind, severity: finding.severity, file: finding.summary });
  // A blocking finding still present in a touched file blocks again, even when it is already recorded.
  const blocking = detected.find((finding) => ['HIGH', 'CRITICAL'].includes(finding.severity));
  if (blocking) return { decision: 'block', reason: `${blocking.summary} ${blocking.what_could_happen} Affected: ${blocking.affected} Fix: ${blocking.recommended_fix} ${blocking.decision_reason}` };
  if (findings.length) return { systemMessage: `RIFF recorded ${findings.length} focused warning(s). Review the changed boundary before issuing a candidate-bound receipt.`, hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: findings.map((finding) => finding.summary).join(' ') } };
  event(root, 'hook_post_tool', { tool: payload.tool_name, files: files.length });
  return {};
}

function preCommit(root) {
  // Read paths and bytes from the index, including files removed only from the worktree.
  // NUL delimiters preserve spaces, newlines and Git's otherwise quoted filenames.
  let findings;
  try {
    const files = execFileSync('git', ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMRT'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
    findings = files.flatMap((file) => {
      const text = execFileSync('git', ['show', `:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: Infinity, stdio: ['ignore', 'pipe', 'pipe'] });
      const results = scanFile(path.join(root, file), text);
      if (/^\.env(?:\.|$)/.test(path.basename(file)) && !file.endsWith('.example')) {
        results.push({ kind: 'environment_file', severity: 'HIGH', summary: `Private environment file ${file} is staged for commit.` });
      }
      const orphan = orphanFinding(root, path.join(root, file));
      if (orphan) results.push(orphan);
      return results;
    }).map(plainFinding);
  } catch {
    process.stderr.write('RIFF pre-commit blocked: could not inspect the staged files. Resolve the Git index or read failure before committing.\n');
    return 1;
  }
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
  // A batch commits every active phase at once, so each needs its own evidence for this staged tree.
  const actives = activePhases(state);
  if (!actives.length) return 0;
  const candidate = candidateTree(root);
  for (const active of actives) {
    const label = actives.length > 1 ? ` (phase ${active.id})` : '';
    try { requireValidation(root, active, candidate); }
    catch (error) { process.stderr.write(`RIFF pre-commit blocked${label}: ${error.message}\n`); return 1; }
    const functional = receiptFor(root, active, 'functional');
    const security = receiptFor(root, active, 'security');
    if (!functional || functional.status !== 'pass' || functional.candidate !== candidate || !evidenceValid(root, functional.evidence)) {
      process.stderr.write(`RIFF pre-commit blocked${label}: the active wave needs a fresh passing functional review receipt for this exact staged tree.\n`);
      return 1;
    }
    if (active.sensitive && (!security || security.status !== 'pass' || security.candidate !== candidate || !evidenceValid(root, security.evidence))) {
      process.stderr.write(`RIFF pre-commit blocked${label}: this sensitive wave needs a fresh passing security receipt for this exact staged tree.\n`);
      return 1;
    }
  }
  event(root, 'git_pre_commit', { phase: actives.map((phase) => phase.id).join(','), candidate });
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
      const context = [`RIFF conversation language: ${config?.language ?? 'en'}; artifact language: ${config?.artifactLanguage ?? 'en'}.`, `Project scope: ${config?.project?.scope ?? 'production'}. Preferences: explanation=${config?.preferences?.explanation ?? 'simple'}, autonomy=${config?.preferences?.autonomy ?? 'loop'}.`, `Use PROJECT.md and ROADMAP.yaml as shared product sources; use ${stateDirFor(root)}/state.json through the RIFF CLI only.`];
      context.push(`For implementation or review, read project taste.md when present and ${frameworkDirFor(root)}/references/taste.md; load only relevant topic and stack rules. For frontend work, read ${frameworkDirFor(root)}/references/taste/frontend.md, apply the relevant design skills and verify the rendered result in the browser. Use the learn-stack skill for reusable stack-convention gaps.`);
      if ((config?.preferences?.autonomy ?? 'loop') === 'loop') context.push('Loop autonomy governs waves: make conservative product and technical decisions, follow ready dependencies automatically, and do not request human decisions. Stop only for missing credentials or external access, impossible third-party verification, an unidentifiable destructive target, or failed RIFF validation. Product definition still asks the user: the start and evolve skills interview them, and add-phase asks when its outcome is unclear.');
      else context.push('Guided autonomy: preserve confirmation at product decision boundaries and between phases.');
      if (active) {
        const batch = state.activeWave?.batch?.length > 1 ? ` (built together with ${state.activeWave.batch.filter((id) => id !== active.id).join(', ')})` : '';
        context.push(`Resume interrupted phase ${active.id}${batch}. Load ${frameworkDirFor(root)}/references/operating-contract.md before continuing.`);
        const clip = (text) => String(text).replace(/\s+/g, ' ').slice(0, 300);
        if (active.checkpoint?.summary) context.push(`Last checkpoint: ${clip(active.checkpoint.summary)} Next: ${clip(active.checkpoint.next)} Check it against current files with riff wave context before trusting it.`);
      }
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

function cmdStatus(tokens) {
  const root = gitRoot();
  const data = dashboardData(root);
  if (parseOptions(tokens).json) {
    const review = (receipt) => receipt && { phase: receipt.phase, status: receipt.status, summary: receipt.summary ?? null, valid: receipt.valid };
    // Stable contract for host integrations; extend, never rename.
    process.stdout.write(`${JSON.stringify({
      schema: 'riff.status/1',
      version: data.version,
      project: { name: data.project.name ?? null, objective: data.project.objective ?? null },
      progress: data.progress,
      active: data.activeWave?.phase ?? null,
      activePhases: data.activeWave ? data.activeWave.batch ?? [data.activeWave.phase] : [],
      next: data.nextReady ? { id: data.nextReady.id, title: data.nextReady.title ?? null } : null,
      humanAction: data.humanAction ?? null,
      phases: readState(root).phases.map((phase) => ({ id: phase.id, title: phase.title ?? null, status: phase.status, ...(phase.acceptance ? { acceptedWithRisks: true } : {}) })),
      findings: data.securityFindings.filter((finding) => finding.status === 'pending')
        .map((finding) => ({ id: finding.id, severity: finding.severity ?? null, summary: finding.summary ?? null, phase: finding.phase ?? null })),
      reviews: { functional: review(data.reviews.functional), security: review(data.reviews.security) },
    }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${data.project.name ?? 'Unshaped project'}: ${data.project.objective ?? 'no objective yet'}\n${data.progress.completed}/${data.progress.total} phases completed. Active: ${activeLabel(data.activeWave)}. Next: ${data.nextReady?.id ?? 'none'}.\nHuman action: ${data.humanAction?.reason ?? 'none'}\n`);
}

function cmdReport(tokens) {
  const root = gitRoot();
  const options = parseOptions(tokens);
  const candidate = candidateTree(root);
  const evidence = verificationEvidence(root, optionRequired(options, 'evidence'), candidate);
  const report = writeReport(root, { title: evidence.manifest.title ?? 'Verification report', candidate, phase: options.phase ?? 'verification', evidence });
  event(root, 'verification_report', report);
  process.stdout.write(`${path.join(root, report.path)}\n${report.verdict}\n`);
}

function checkTerminalPhaseEvidence(root, state) {
  if (state.phases.some((phase) => !TERMINAL_PHASE_STATES.has(phase.status))) throw new Error('unfinished phases remain');
  for (const phase of state.phases.filter((phase) => phase.status === 'completed')) {
    const tree = run('git', ['rev-parse', `${phase.commit}^{tree}`], { cwd: root });
    requireValidation(root, phase, tree);
    for (const type of reviewTypesFor(phase)) {
      const receipt = receiptFor(root, phase, type);
      if (phase.acceptance?.source === 'owner' && phase.acceptance.commit === phase.commit && phase.acceptance.waived.some((entry) => entry.type === type)) continue;
      if (receipt?.status !== 'pass' || receipt.candidate !== tree || !evidenceValid(root, receipt.evidence)) throw new Error(`phase ${phase.id} lacks intact ${type} evidence`);
    }
    run('git', ['merge-base', '--is-ancestor', phase.commit, 'HEAD'], { cwd: root });
  }
}

function cmdFinish(tokens) {
  const options = parseOptions(tokens);
  const root = gitRoot();
  const state = readState(root);
  if (discoveryEnrolled(root, state)) {
    const observationError = pendingObservationError(state);
    if (observationError) throw new Error(observationError);
  }
  if (options.review) {
    checkTerminalPhaseEvidence(root, state);
    if (discoveryEnrolled(root, state)) discoveryGate(root, state);
    const candidate = candidateTree(root);
    if (state.deliveryReview?.status === 'fail' && state.deliveryReview.candidate === candidate) {
      throw new Error('repeated final delivery review after a failure on the unchanged candidate; revise the delivery or add a correction phase');
    }
    const headTree = run('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root });
    if (candidate !== headTree) throw new Error('final delivery review must bind the current HEAD candidate tree');
    if (run('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root })) throw new Error('final delivery review requires a clean tracked candidate');
    const deliveryStatus = readJson(localPath(root, options.review)).status;
    if (!['pass', 'fail'].includes(deliveryStatus)) throw new Error('delivery review status must be pass or fail');
    const proof = reviewArtifact(root, options.review, candidate, 'delivery', deliveryStatus);
    state.deliveryReview = {
      version: 1,
      type: 'delivery',
      status: deliveryStatus,
      candidate,
      reviewer: proof.artifact.reviewer,
      evidence: storeEvidence(root, 'delivery', proof.bytes),
      reviewedAt: now(),
    };
    saveState(root, state);
    event(root, 'delivery_review', { candidate, evidence: state.deliveryReview.evidence });
    process.stdout.write(`Final delivery review ${deliveryStatus} recorded at ${candidate}.\n`);
    return;
  }
  if (!options.check) throw new Error('finish requires --check or --review FILE; Git publication remains an explicit separate action');
  checkTerminalPhaseEvidence(root, state);
  if (discoveryEnrolled(root, state)) {
    discoveryGate(root, state);
    const candidate = run('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root });
    if (!storedReviewValid(root, state.deliveryReview, 'delivery', candidate)) throw new Error('enrolled project requires an intact passing final delivery review for the current candidate');
  }
  if (run('git', ['status', '--porcelain'], { cwd: root })) throw new Error('commit or preserve pending project changes before finishing');
  // Expert-review findings never block delivery: they ship with the agent's documented interim decision and stay listed.
  const expert = observationList(state).filter((finding) => finding.status === 'expert_review');
  const expertText = expert.length ? `Points for a human expert when one is available (${expert.length}: security findings and known residual risks), shipped with the interim decision in each note:\n${expert.map((finding) => `- ${finding.severity} ${finding.summary}: ${finding.review.note}`).join('\n')}\n` : '';
  process.stdout.write(`Ready for explicit Git finalization at ${run('git', ['rev-parse', 'HEAD'], { cwd: root })}.\n${acceptedPhasesText(state)}${expertText}No push, merge or deployment performed.\n`);
}

function cmdPromote(tokens) {
  const options = parseOptions(tokens);
  const root = gitRoot();
  const config = readJson(pathsFor(root).config);
  if (config.project?.scope === 'production') { process.stdout.write('Already production scope.\n'); return; }
  if (config.project?.scope !== 'scratch') throw new Error('promotion requires a scratch-scoped project');
  const candidate = candidateTree(root);
  if (!options.apply) { process.stdout.write(`Promotion candidate: ${candidate}\nPrepare PROJECT.md, ROADMAP.yaml and taste.md, stage changes, then supply independent architecture, roadmap and functional review artifacts with --apply; include security for sensitive boundaries.\n`); return; }
  for (const file of ['PROJECT.md', 'ROADMAP.yaml', 'taste.md']) if (!readFileSync(localPath(root, file), 'utf8').trim()) throw new Error(`missing production artifact ${file}`);
  readRoadmap(root);
  for (const file of ['PROJECT.md', 'ROADMAP.yaml', 'taste.md']) run('git', ['cat-file', '-e', `${candidate}:${file}`], { cwd: root });
  run('git', ['diff', '--exit-code'], { cwd: root });
  const state = readState(root);
  if (state.phases.some((phase) => ['active', 'parked', 'blocked', 'awaiting_human'].includes(phase.status))) throw new Error('resolve active work and blockers before scope promotion');
  const architecture = reviewArtifact(root, optionRequired(options, 'architecture'), candidate, 'architecture', 'pass');
  const roadmap = reviewArtifact(root, optionRequired(options, 'roadmap'), candidate, 'roadmap', 'pass');
  const functional = reviewArtifact(root, optionRequired(options, 'functional'), candidate, 'functional', 'pass');
  const sensitive = state.phases.some((phase) => phase.sensitive) || SENSITIVE_WORDS.test(readFileSync(path.join(root, 'PROJECT.md'), 'utf8'));
  const security = sensitive ? reviewArtifact(root, optionRequired(options, 'security'), candidate, 'security', 'pass') : null;
  config.project.scope = 'production';
  config.promotion = { candidate, at: now(), architecture: storeEvidence(root, 'architecture', architecture.bytes), roadmap: storeEvidence(root, 'roadmap', roadmap.bytes), functional: storeEvidence(root, 'functional', functional.bytes), security: security ? storeEvidence(root, 'security', security.bytes) : null };
  const ledger = localPath(root, 'INCIDENTS.md');
  if (!existsSync(ledger)) writeFileSync(ledger, '# Production incidents\n\nAppend-only incident history.\n', { flag: 'wx' });
  writeJson(localPath(root, pathsFor(root).config), config);
  event(root, 'scope_promoted', { candidate });
  process.stdout.write('Scope promoted from scratch to production. Existing phases preserved. No deployment performed.\n');
}

function cmdImprove(tokens) {
  const root = gitRoot();
  const action = tokens[0] ?? 'list';
  const options = parseOptions(tokens.slice(1));
  const ideas = ideasFile(path.dirname(PLUGIN_ROOT));
  if (action === 'list') {
    const target = options.target ?? 'project';
    if (!['project', 'riff'].includes(target)) throw new Error('--target must be project or riff');
    const items = target === 'riff' ? readIdeas(ideas) : readState(root).improvements ?? [];
    process.stdout.write(`${JSON.stringify(items)}\n`);
    return;
  }
  if (!['record', 'decide'].includes(action)) throw new Error('use improve record --phase ID --file FILE, improve list [--target project|riff], or improve decide --id ID --status taken|dismissed');
  withLock(root, () => {
    const state = readState(root);
    if (action === 'decide') {
      const item = decideImprovement(state, { id: optionRequired(options, 'id'), status: optionRequired(options, 'status'), note: options.note, at: now() });
      saveState(root, state);
      event(root, 'improvement_decided', { id: item.id, status: item.status });
      process.stdout.write(`${item.id} ${item.status}.\n`);
      return;
    }
    const phase = phaseById(state, optionRequired(options, 'phase'));
    activePhase(state, phase);
    const proposals = parseProposals(readJson(localPath(root, optionRequired(options, 'file'))));
    const { recorded, skipped } = recordImprovements({ state, phase, proposals, project: state.project?.name || path.basename(root), ideas, at: now() });
    saveState(root, state);
    event(root, 'improvement_pass', { phase: phase.id, recorded: recorded.map((entry) => entry.id), skipped: skipped.length });
    const lines = [`Improvement pass recorded for ${phase.id}: ${recorded.length} new, ${skipped.length} duplicate.`];
    for (const entry of recorded) lines.push(`  ${entry.id} [${entry.target}] ${entry.title}`);
    for (const entry of skipped) lines.push(`  skipped duplicate of ${entry.duplicateOf}: ${entry.title}`);
    process.stdout.write(`${lines.join('\n')}\n`);
  });
}

function gitCommonDir(directory) {
  return realpathSync(run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: directory }));
}

// Copies one file from another checkout into this one when it is missing; an existing file is kept.
function importFile(root, source, relative, dryRun, copied) {
  const from = path.join(source, relative);
  if (!existsSync(from) || !lstatSync(from).isFile()) return;
  const to = localPath(root, relative);
  if (existsSync(to)) return;
  copied.push(relative);
  if (dryRun) return;
  ensureDir(to, true);
  copyFileSync(from, to);
}

// Merges one phase's record and its evidence from a worktree checkout of the same repository.
// State resolution is unchanged: each checkout keeps its own .riff-data until this explicit import.
function cmdState(tokens) {
  if (tokens[0] !== 'import') throw new Error('use riff state import --from WORKTREE_PATH --phase ID [--dry-run]');
  const options = parseOptions(tokens.slice(1));
  const root = gitRoot();
  const source = gitRoot(path.resolve(String(optionRequired(options, 'from'))));
  const id = phaseId(optionRequired(options, 'phase'));
  const dryRun = options.dry_run === true;
  if (realpathSync(source) === realpathSync(root)) throw new Error('--from is this checkout; pass the worktree that holds the phase state');
  if (gitCommonDir(source) !== gitCommonDir(root)) throw new Error('--from must be a worktree of this repository');
  const sourceDir = path.join(source, stateDirFor(source));
  if (!existsSync(path.join(sourceDir, 'state.json')) || lstatSync(sourceDir).isSymbolicLink()) throw new Error(`no RIFF state in ${sourceDir}`);
  const theirs = readJson(path.join(sourceDir, 'state.json'));
  validateState(theirs);
  const incoming = theirs.phases.find((phase) => phase.id === id);
  if (!incoming) throw new Error(`phase ${id} is not in the worktree state`);
  withLock(root, () => {
    const state = readState(root);
    const index = state.phases.findIndex((phase) => phase.id === id);
    if (index < 0) throw new Error(`phase ${id} is not in this checkout's state; run riff wave sync first`);
    const current = state.phases[index];
    if (TERMINAL_PHASE_STATES.has(current.status) && JSON.stringify(current) !== JSON.stringify(incoming)) throw new Error(`phase ${id} is already ${current.status} here; its history is not overwritten`);
    const otherActive = activePhases(state).filter((phase) => phase.id !== id);
    if (incoming.status === 'active' && otherActive.length && !canRunBeside(current, otherActive)) throw new Error(`phase ${otherActive[0].id} is active here; finish or park it before importing active phase ${id}, or give both phases owns paths that don't overlap`);
    if (incoming.commit) {
      try { run('git', ['cat-file', '-e', `${incoming.commit}^{commit}`], { cwd: root }); }
      catch { throw new Error(`commit ${incoming.commit} of phase ${id} is not in this repository`); }
    }
    const report = { phase: id, from: source, status: `${current.status} -> ${incoming.status}`, findings: 0, improvements: 0, observationReviews: 0, files: [] };
    // Plan fields stay this checkout's: only execution history comes from the worktree.
    const plan = Object.fromEntries(NORMALIZED_PLAN_FIELDS.filter((field) => Object.hasOwn(current, field)).map((field) => [field, current[field]]));
    state.phases[index] = { ...incoming, ...plan, done_when: current.done_when?.length ? current.done_when : incoming.done_when, verify: current.verify?.length ? current.verify : incoming.verify };
    const known = new Set((state.securityFindings ?? []).map((finding) => JSON.stringify(finding)));
    for (const finding of (theirs.securityFindings ?? []).filter((item) => item?.phase === id && !known.has(JSON.stringify(item)))) { state.securityFindings.push(finding); report.findings += 1; }
    const improvementIds = new Set((state.improvements ?? []).map((item) => item.id));
    for (const item of (theirs.improvements ?? []).filter((entry) => entry?.phase === id && !improvementIds.has(entry.id))) { state.improvements = [...(state.improvements ?? []), item]; report.improvements += 1; }
    const observationIds = new Set(observationList(theirs).filter((finding) => finding.phase === id).map((finding) => finding.id));
    for (const [observation, review] of Object.entries(theirs.observationReviews ?? {})) {
      if (!observationIds.has(observation)) continue;
      const mine = state.observationReviews?.[observation];
      if (mine && String(mine.at) >= String(review.at)) continue;
      state.observationReviews = { ...(state.observationReviews ?? {}), [observation]: review };
      report.observationReviews += 1;
    }
    const history = new Set((state.observationHistory ?? []).map((entry) => JSON.stringify(entry)));
    const addedHistory = (theirs.observationHistory ?? []).filter((entry) => observationIds.has(entry.id) && !history.has(JSON.stringify(entry)));
    if (addedHistory.length) state.observationHistory = [...(state.observationHistory ?? []), ...addedHistory];
    if (theirs.lastValidation?.phase === id && (!state.lastValidation || String(state.lastValidation.at) <= String(theirs.lastValidation.at))) state.lastValidation = theirs.lastValidation;
    for (const type of ['functional', 'security']) {
      const review = theirs.reviews?.[type];
      if (review?.phase === id && (!state.reviews[type] || String(state.reviews[type].reviewedAt) <= String(review.reviewedAt))) state.reviews[type] = review;
    }
    if (incoming.status === 'active' && !otherActive.length) state.activeWave = theirs.activeWave?.phase === id ? { ...theirs.activeWave } : null;
    setActiveWave(state, state.activeWave?.phase ?? id);
    if (theirs.humanAction?.phase === id) state.humanAction = theirs.humanAction;
    else if (state.humanAction?.phase === id) state.humanAction = null;
    if (incoming.status === 'completed' && incoming.commit) state.lastCommit = incoming.commit;
    // Evidence: receipts, content-addressed evidence copies, the validation report and its manifest.
    const stateDir = stateDirFor(root);
    const sourceState = path.relative(source, sourceDir);
    const receipts = ['functional', 'security'].map((type) => `receipts/${id}-${type}.json`);
    for (const receipt of receipts) {
      const from = path.join(sourceDir, receipt);
      if (!existsSync(from)) continue;
      const to = localPath(root, path.join(stateDir, receipt));
      if (existsSync(to) && sha(readFileSync(to)) === sha(readFileSync(from))) continue;
      report.files.push(path.join(stateDir, receipt));
      if (!dryRun) { ensureDir(to, true); copyFileSync(from, to); }
    }
    const evidencePaths = [incoming.validation?.evidence?.path, ...receipts.map((receipt) => readJson(path.join(sourceDir, receipt), false)?.evidence?.path)].filter(Boolean);
    for (const evidence of evidencePaths) {
      const name = path.basename(evidence);
      const from = path.join(sourceState, 'evidence', name);
      const to = path.join(stateDir, 'evidence', name);
      if (existsSync(path.join(source, from)) && !existsSync(localPath(root, to))) {
        report.files.push(to);
        if (!dryRun) { ensureDir(localPath(root, to), true); copyFileSync(path.join(source, from), localPath(root, to)); }
      }
    }
    const reportPath = incoming.validation?.verification?.path;
    if (reportPath && /^\.uxtest\/runs\/[^/]+\//.test(reportPath)) {
      const runDir = path.dirname(reportPath);
      if (existsSync(path.join(source, runDir))) for (const entry of readdirSync(path.join(source, runDir))) importFile(root, source, path.join(runDir, entry), dryRun, report.files);
    }
    const manifest = incoming.validation?.verificationManifest?.path;
    if (manifest && !path.isAbsolute(manifest)) importFile(root, source, manifest, dryRun, report.files);
    validateState(state);
    if (!dryRun) {
      saveState(root, state);
      event(root, 'state_imported', { ...report, files: report.files.length });
    }
    let ancestor = true;
    if (incoming.commit) { try { run('git', ['merge-base', '--is-ancestor', incoming.commit, 'HEAD'], { cwd: root }); } catch { ancestor = false; } }
    process.stdout.write(`${dryRun ? 'Dry run, nothing written. Would import' : 'Imported'} phase ${id} from ${source}: ${report.status}; ${report.findings} finding(s), ${report.improvements} improvement(s), ${report.observationReviews} observation decision(s), ${report.files.length} file(s).\n${report.files.map((file) => `  ${file}\n`).join('')}${ancestor ? '' : `Commit ${incoming.commit.slice(0, 12)} is not in this checkout's HEAD yet; merge the worktree branch before riff finish --check.\n`}`);
  });
}

function cmdIncident(tokens) {
  if (tokens[0] !== 'log') throw new Error('use incident log --evidence FILE');
  const options = parseOptions(tokens.slice(1));
  const root = gitRoot();
  const entry = readJson(localPath(root, optionRequired(options, 'evidence')));
  for (const field of ['id', 'title', 'impact', 'rootCause', 'prevention']) if (typeof entry[field] !== 'string' || !entry[field].trim()) throw new Error(`incident requires ${field}`);
  phaseId(entry.id);
  if (!['critical', 'high', 'medium', 'low'].includes(entry.severity)) throw new Error('incident requires a valid severity');
  const file = localPath(root, 'INCIDENTS.md');
  const previous = existsSync(file) ? readFileSync(file, 'utf8') : '# Production incidents\n';
  const marker = `<!-- incident:${entry.id} -->`;
  if (previous.includes(marker)) { process.stdout.write(`Incident ${entry.id} already recorded.\n`); return; }
  const line = (text) => String(text).replace(/[\r\n]+/g, ' ');
  appendFileSync(file, `${existsSync(file) ? '' : previous}\n${marker}\n## ${now().slice(0, 10)}: ${line(entry.title)}\n\n- **Severity:** ${entry.severity}\n- **Phase:** ${line(entry.phase ?? 'not specified')}\n- **Impact:** ${line(entry.impact)}\n- **Root cause:** ${line(entry.rootCause)}\n- **Prevention:** ${line(entry.prevention)}\n`);
  event(root, 'incident_recorded', { id: entry.id, severity: entry.severity });
  process.stdout.write(`Incident ${entry.id} appended to INCIDENTS.md.\n`);
}

async function cmdModelAdvice(tokens) {
  const [action = 'show', ...args] = tokens;
  const options = parseOptions(args);
  const allowed = { catalog: [], show: [], configure: ['mode', 'allow_jev_summary'], recommend: ['input', 'mode', 'allow_jev_summary', 'reason'], plan: ['input', 'mode', 'allow_jev_summary', 'reason'] }[action];
  if (!allowed || options._.length || Object.keys(options).some((k) => k !== '_' && !allowed.includes(k))) throw new Error('use model-advice catalog|show|configure|recommend|plan with supported options');
  if (options.allow_jev_summary !== undefined && options.allow_jev_summary !== true) throw new Error('--allow-jev-summary is a flag');
  if (options.mode !== undefined && !MODES.includes(options.mode)) throw new Error('mode must be off, local or jev');
  const print = (value) => process.stdout.write(JSON.stringify(value, null, 2) + '\n');
  if (action === 'catalog') { print(loadCatalog()); return; }
  const root = gitRoot();
  const files = pathsFor(root);
  const readConfig = () => readJson(localPath(root, files.config));
  const preference = (config) => config.preferences?.modelAdvice ?? { mode: 'off', allowJevSummary: false };
  if (action === 'show') { const state = readState(root); print({ preference: preference(readConfig()), advice: state.modelAdvice ?? null, plan: state.modelAdvicePlan ?? null }); return; }
  await withLock(root, async () => {
    const config = readConfig();
    if (config.version !== 1) throw new Error('unsupported RIFF configuration');
    if (action === 'configure') {
      if (!MODES.includes(options.mode)) throw new Error('configure requires --mode off|local|jev');
      if (options.mode === 'jev' && options.allow_jev_summary !== true) throw new Error('persistent Jev requires --allow-jev-summary: curated task summaries will be sent to OpenRouter');
      config.preferences ??= {};
      config.preferences.modelAdvice = { mode: options.mode, allowJevSummary: options.mode === 'jev' };
      writeJson(localPath(root, files.config), config);
      event(root, 'model_advice_configured', config.preferences.modelAdvice);
      print(config.preferences.modelAdvice);
      return;
    }
    if (typeof options.input !== 'string') throw new Error(`${action} requires --input FILE|-`);
    if (options.input !== '-' && (path.isAbsolute(options.input) || options.input.split(/[\\/]/).includes('..'))) throw new Error('advice input must be project-relative without parent traversal');
    const bytes = readFileSync(options.input === '-' ? 0 : localPath(root, options.input), 'utf8');
    if (Buffer.byteLength(bytes) > 16384) throw new Error('advice input exceeds 16 KiB; supply a curated summary');
    let raw;
    try { raw = JSON.parse(bytes); } catch { throw new Error('advice input must be valid JSON'); }
    const state = readState(root);
    if (raw?.phase != null && !state.phases.some((p) => p.id === raw.phase)) throw new Error('advice phase is not in current RIFF state');
    const pref = preference(config);
    const mode = options.mode ?? pref.mode;
    const stateKey = action === 'plan' ? 'modelAdvicePlan' : 'modelAdvice';
    const result = await (action === 'plan' ? recommendPlan : recommend)(raw, {
      mode, previous: state[stateKey] ?? null,
      allowJev: options.allow_jev_summary === true || (pref.mode === 'jev' && pref.allowJevSummary === true),
      reason: options.reason ?? null,
    });
    // Advice and observed identity never overwrite the review model or wave gates.
    if (!result.reused) {
      result.recordedAt = now();
      state[stateKey] = result;
      saveState(root, state);
      event(root, action === 'plan' ? 'model_advice_plan' : 'model_advice', {
        phase: result.phase, policyVersion: result.policyVersion, fingerprint: result.fingerprint,
        origin: result.origin, status: result.status, requestedMode: mode,
        profile: result.profile ?? null, providerStatus: result.providerStatus,
        reevaluationReason: result.reevaluationReason ?? options.reason ?? null, cost: result.callCost ?? result.jev?.cost ?? null,
        ...(action === 'plan' ? { roles: result.roles.map((r) => ({ id: r.id, profile: r.advice.profile ?? null, origin: r.advice.origin, providerStatus: r.advice.providerStatus, dispatch: r.dispatch.status })), providerCalls: result.providerCalls } : {}),
      });
    } else {
      const normalizedRecord = { ...result, reused: false };
      if (JSON.stringify(state[stateKey]) !== JSON.stringify(normalizedRecord)) {
        state[stateKey] = normalizedRecord;
        saveState(root, state);
      }
    }
    print(result);
  });
}

function help() {
  process.stdout.write('Model advice (never switches the active model):\n  riff model-advice catalog|show\n  riff model-advice configure --mode off|local|jev [--allow-jev-summary]\n  riff model-advice recommend|plan --input FILE|- [--mode off|local|jev] [--allow-jev-summary] [--reason TEXT]\n\n');
  // Keep the lifecycle gates discoverable from the CLI without adding a second workflow.
  process.stdout.write(`RIFF ${VERSION}\n\nUsage:\n  riff init [--project-root PATH] [--git-init] [--configure] [--non-interactive] [--autonomy loop|guided]\n  riff resync [--record-hooks-approved]\n  riff doctor [--record-hooks-approved]\n  riff dashboard [--port 4000|--no-open|--snapshot|--check]\n  riff status [--json]\n  riff discovery [snapshot|check|review --evidence FILE]\n  riff review run --type discovery|functional|security|delivery|functional,security [--phase ID[,ID...]|--quick] [--since REF] [--timeout-minutes 25]\n  riff wave select --parallel\n  riff observations list\n  riff observations review --id ID --revision REV --status resolved --note "Verified correction"\n  riff wave [select|resume|sync|activate|context|checkpoint|validate|review|decision|risk|retry|park|block|await|complete] ...\n\nWave state examples:\n  riff wave sync [--preserve-legacy-verification]\n  riff wave context [phase-id] [--json]\n  riff wave checkpoint phase-1 --summary "Verified outcome" --next "Next action and references"\n  riff wave activate phase-1\n  riff wave validate phase-1 --run --command '["npm","test"]' --paths '["src","test"]'\n  riff wave validate phase-1 --rerun   (same command, paths and manifest as the last run, restaged)\n  riff wave park phase-1 --kind validation-failure --reason "Formal retry failed"\n  riff wave review phase-1 --type functional --status pass --summary "Vertical outcome works" --evidence .riff-data/review.json\n  riff wave decision phase-1 --note "Kept the verbatim quote; redaction happens at display" [--type functional|security|contract]\n  riff wave risk phase-1 --kind crash-window|runtime-unverified|edge-case --severity MEDIUM --summary "..." --note "why it stays open" [--finding "review finding title"]\n  riff wave complete phase-1 --commit HEAD\n  riff wave complete phase-1 --commit HEAD --accept-risks --reason "owner decision"   (owner instruction only)\n\nEvidence and lifecycle:\n  riff report --evidence .riff-data/verification.json\n  riff promote [--apply --architecture FILE --roadmap FILE --functional FILE [--security FILE]]\n  riff incident log --evidence FILE\n  riff improve record --phase phase-1 --file .riff-data/improvements.json\n  riff improve list [--target project|riff]\n  riff improve decide --id ID --status taken|dismissed [--note REASON]\n  riff finish --review FILE\n  riff finish --check\n  riff state import --from WORKTREE_PATH --phase phase-1 [--dry-run]\n\nLoop stop kinds: credentials-or-access, third-party-verification, destructive-target, validation-failure.\nRIFF never provides a public next command. Selection belongs to wave.\n`);
}

const [command, ...tokens] = process.argv.slice(2);
if (!command || command === '--help' || command === '-h' || command === 'help') help();
else if (command === '--version' || command === '-v') process.stdout.write(`${VERSION}\n`);
else if (command === 'init') await cmdInit(tokens);
else if (command === 'resync') cmdResync(tokens);
else if (command === 'doctor') cmdDoctor(tokens);
else if (command === 'dashboard') await cmdDashboard(tokens);
else if (command === 'status') cmdStatus(tokens);
else if (command === 'model-advice') {
  try { await cmdModelAdvice(tokens); } catch (error) { fail(error.message); }
}
else if (command === 'discovery') {
  try { withLock(gitRoot(), () => cmdDiscovery(tokens)); } catch (error) { fail(error.message); }
}
else if (['report', 'promote', 'incident', 'finish'].includes(command)) {
  try {
    const action = () => ({ report: cmdReport, promote: cmdPromote, incident: cmdIncident, finish: cmdFinish })[command](tokens);
    if (command === 'finish' && !parseOptions(tokens).review) action();
    else withLock(gitRoot(), action);
  } catch (error) { fail(error.message); }
}
else if (command === 'review') {
  try { await cmdReview(tokens); } catch (error) { fail(error.message); }
}
else if (command === 'state') {
  try { cmdState(tokens); } catch (error) { fail(error.message); }
}
else if (command === 'improve') {
  try { cmdImprove(tokens); } catch (error) { fail(error.message); }
}
else if (command === 'observations') {
  try {
    const root = gitRoot();
    if (tokens[0] === 'review') withLock(root, () => {
      const state = readState(root);
      const options = parseOptions(tokens.slice(1));
      const review = reviewObservation(state, options);
      saveState(root, state);
      event(root, 'observation_reviewed', review);
      process.stdout.write(JSON.stringify(review) + '\n');
    });
    else if (!tokens.length || tokens[0] === 'list') process.stdout.write(JSON.stringify(observationList(readState(root))) + '\n');
    else throw new Error('Use observations list or observations review --id ID --revision REV --status pending|resolved|false_positive|expert_review --note REASON');
  } catch (error) { fail(error.message); }
}
else if (command === 'wave') {
  try {
    if (tokens[0] === 'select') cmdWave(tokens);
    else if (tokens[0] === 'context') cmdContext(tokens.slice(1));
    else withLock(gitRoot(), () => cmdWave(tokens));
  } catch (error) { fail(error.message); }
}
else if (command === 'hook') {
  try { if (['post-tool', 'pre-compact'].includes(tokens[0])) withLock(gitRoot(), () => cmdHook(tokens)); else cmdHook(tokens); } catch (error) { fail(error.message); }
}
else if (command === 'next') fail('riff next is intentionally deferred; use the wave skill or riff wave select');
else fail(`unknown command ${command}; run riff --help`);
