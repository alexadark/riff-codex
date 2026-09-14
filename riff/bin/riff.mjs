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
import { inside, localPath, phaseId, withLock, withFileLock } from '../lib/safety.mjs';
import { verificationEvidence, writeReport } from '../lib/report.mjs';
import { managedHookPolicy } from '../lib/managed-hooks.mjs';
import { selectReadyPhase } from '../lib/phase-selection.mjs';

const VERSION = '0.1.0';
const SCRIPT = fileURLToPath(import.meta.url);
const PLUGIN_ROOT = path.resolve(path.dirname(SCRIPT), '..');
const FRAMEWORK_DIR = '.riff-codex';
const STATE_DIR = '.riff-codex-state';
const LEGACY_FRAMEWORK_DIR = '.riff';
const LEGACY_STATE_DIR = '.riff-state';
const HOOK_ID = 'riff-codex-hook:';
const LEGACY_HOOK_ID = 'riff-hook:';
const GIT_HOOK_MARKER = '# RIFF Codex managed wrapper';
const LEGACY_GIT_HOOK_MARKER = '# RIFF managed wrapper';
const PHASE_STATES = new Set(['ready', 'active', 'completed', 'parked', 'blocked', 'awaiting_human', 'skipped']);
const TERMINAL_PHASE_STATES = new Set(['completed', 'skipped']);
const ROADMAP_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const AUTONOMY_MODES = new Set(['loop', 'guided']);
const LOOP_STOP_KINDS = new Set(['credentials-or-access', 'third-party-verification', 'destructive-target', 'validation-failure']);
const PRIORITY_RANK = new Map([['P0', 0], ['P1', 1], ['P2', 2], ['P3', 3]]);
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

function pathsFor(root) {
  return {
    root,
    framework: path.join(root, FRAMEWORK_DIR),
    riff: path.join(root, STATE_DIR),
    config: path.join(root, STATE_DIR, 'config.json'),
    state: path.join(root, STATE_DIR, 'state.json'),
    events: path.join(root, STATE_DIR, 'events.ndjson'),
    receipts: path.join(root, STATE_DIR, 'receipts'),
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
  localPath(root, files.events);
  ensureDir(files.events, true);
  appendFileSync(files.events, `${JSON.stringify({ at: now(), type, ...data })}\n`);
}

function readState(root) {
  localPath(root, `${STATE_DIR}/state.json`);
  const state = readJson(pathsFor(root).state);
  validateState(state);
  return state;
}

function saveState(root, state) {
  localPath(root, `${STATE_DIR}/state.json`);
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

function desiredHooks(script = SCRIPT) {
  const handler = (name, extra = {}) => ({
    type: 'command',
    command: `/usr/bin/env node ${quote(script)} hook ${name} --id ${HOOK_ID}${name}`,
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

function isLegacyCodexHook(command) {
  return command.includes(LEGACY_HOOK_ID) && command.includes(`/${LEGACY_FRAMEWORK_DIR}/bin/riff.mjs`);
}

function mergeHooks(existing, script = SCRIPT, removeLegacyCodexHooks = false, machineManaged = false) {
  const result = existing ?? { description: 'Project-local Codex hooks.' };
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
  for (const [eventName, groups] of Object.entries(machineManaged ? {} : desiredHooks(script))) {
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

function installationPreflight(root) {
  const directory = gitHooksDir(root);
  for (const name of [STATE_DIR, '.codex', '.agents', '.agents/skills']) {
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
  for (const name of [STATE_DIR, '.codex/hooks.json', '.agents/skills']) localPath(root, name);
}

function installGitHook(root, name, migration) {
  const directory = gitHooksDir(root);
  ensureDir(directory);
  const target = path.join(directory, name);
  const backupDir = path.join(root, STATE_DIR, 'git-hooks');
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
      const legacyPrefix = `${path.join(root, LEGACY_STATE_DIR)}${path.sep}`;
      if (migration.migratedState && typeof prior === 'string' && prior.startsWith(legacyPrefix)) {
        const migratedPrior = path.join(root, STATE_DIR, path.relative(path.join(root, LEGACY_STATE_DIR), prior));
        if (pathExists(migratedPrior)) prior = migratedPrior;
      }
    }
  }
  const previousLine = `'${String(prior ?? '').replaceAll("'", "'\"'\"'")}'`;
  const arg = name === 'commit-msg' ? ' "$@"' : '';
  const wrapper = `#!/bin/sh\n${GIT_HOOK_MARKER}\n# RIFF_CODEX_PREVIOUS_JSON=${JSON.stringify(prior ?? '')}\nRIFF_CODEX_PREVIOUS=${previousLine}\nif [ -n "$RIFF_CODEX_PREVIOUS" ] && [ -x "$RIFF_CODEX_PREVIOUS" ]; then "$RIFF_CODEX_PREVIOUS" "$@" || exit $?; fi\n/usr/bin/env node "$(git rev-parse --show-toplevel)/${FRAMEWORK_DIR}/bin/riff.mjs" hook git-${name}${arg}\n`;
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

  if (!pathExists(state) && pathExists(legacyState) && ownership.owned) {
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

function ensureFrameworkLink(root) {
  const target = path.join(root, FRAMEWORK_DIR);
  if (pathExists(target)) {
    const stat = lstatSync(target);
    if (!stat.isSymbolicLink()) throw new Error(`${FRAMEWORK_DIR} already exists and is not a symlink; preserving it`);
    let resolved;
    try { resolved = path.resolve(path.dirname(target), readlinkSync(target)); } catch (error) { throw new Error(`cannot read ${FRAMEWORK_DIR} symlink: ${error.message}`); }
    if (resolved !== PLUGIN_ROOT) throw new Error(`${FRAMEWORK_DIR} points to ${resolved}; expected permanent RIFF Codex folder ${PLUGIN_ROOT}`);
    return false;
  }
  symlinkSync(path.relative(root, PLUGIN_ROOT), target);
  return true;
}

function exposeSkills(root, migration) {
  const source = path.join(PLUGIN_ROOT, 'skills');
  const destination = path.join(root, '.agents', 'skills');
  ensureDir(destination);
  const preserved = [];
  for (const name of readFileNames(source)) {
    const target = path.join(destination, `riff-codex-${name}`);
    const desiredTarget = path.join(root, FRAMEWORK_DIR, 'skills', name);
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
  if (!/^\.riff-codex-state\/$/m.test(current)) appendFileSync(exclude, `${current && !current.endsWith('\n') ? '\n' : ''}# RIFF Codex worktree-local state\n${STATE_DIR}/\n`);
  if (!/^\.uxtest\/runs\/$/m.test(current)) appendFileSync(exclude, '.uxtest/runs/\n');
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
    const migration = migrateLegacyInstall(root);
    return withLock(root, () => syncManagedUnlocked(root, { ...options, migration }));
  });
}

function syncManagedUnlocked(root, options) {
  const migration = options.migration ?? migrateLegacyInstall(root);
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
      artifactLanguage: options.artifactLanguage ?? 'en',
      project: { scope: options.scope ?? 'production' },
      preferences: { explanation: options.explanation ?? 'simple', autonomy: options.autonomy ?? 'loop' },
      notifications: { channel: 'codex' },
      hooks: { approvedHash: null },
      onboarding: { completedAt: options.configured ? now() : null },
      managed: {},
    };
  }
  if (config.version !== 1) throw new Error(`unsupported ${STATE_DIR}/config.json version`);
  config.preferences ??= {};
  if (options.autonomy) config.preferences = { ...config.preferences, autonomy: options.autonomy };
  config.preferences.autonomy ??= 'loop';
  if (!AUTONOMY_MODES.has(config.preferences.autonomy)) throw new Error('autonomy must be loop or guided');
  const existingHooks = readJson(files.hooks, false);
  const projectCli = `$(git rev-parse --show-toplevel)/${FRAMEWORK_DIR}/bin/riff.mjs`;
  const systemPolicy = managedHookPolicy(root, PLUGIN_ROOT);
  const merged = mergeHooks(existingHooks, projectCli, migration.legacyFrameworkOwned || migration.migratedState, Boolean(systemPolicy));
  writeJson(files.hooks, merged);
  const currentHash = hooksHash(merged);
  const preservedSkills = exposeSkills(root, migration);
  config.managed = { ...(config.managed ?? {}), version: VERSION, pluginRoot: PLUGIN_ROOT, cli: `${FRAMEWORK_DIR}/bin/riff.mjs`, hooksHash: currentHash, preservedSkills };
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
    if (result.migration.changes.length) process.stdout.write(`Migrated existing RIFF Codex installation: ${result.migration.changes.join(', ')}.\n`);
  } catch (error) { fail(error.message); }
  const config = readJson(pathsFor(root).config);
  process.stdout.write(`RIFF ${VERSION} initialized in ${root}\nConfiguration: conversation=${config.language}, artifacts=${config.artifactLanguage ?? 'en'}, scope=${config.project?.scope ?? 'production'}, explanation=${config.preferences?.explanation ?? 'simple'}, autonomy=${config.preferences?.autonomy ?? 'loop'}.\nFramework: ${FRAMEWORK_DIR} -> ${PLUGIN_ROOT}\nSkills: namespaced under .agents/skills/riff-codex-*; the native plugin supplies the $riff:* namespace.\nState: project-local in ${STATE_DIR}/.\nProduct artifacts: shared PROJECT.md and ROADMAP.yaml are preserved.\nHooks: installed in .codex/hooks.json and chained with existing Git hooks.\n${config.hooks?.source === 'system' ? 'Hooks use the installed system policy; no per-hook approval is required after configuration reload.' : 'Required: open /hooks in Codex, review the local hooks, then run riff-codex doctor --record-hooks-approved.'}\nClaude RIFF paths and state were not created or replaced.\n`);
}

function cmdResync(tokens) {
  const options = parseOptions(tokens);
  const root = gitRoot(options.project_root ?? process.cwd());
  let result;
  try { result = syncManaged(root, { resync: true, recordApproval: options.record_hooks_approved }); }
  catch (error) { fail(error.message); }
  if (result.migration.changes.length) process.stdout.write(`Migrated existing RIFF Codex installation: ${result.migration.changes.join(', ')}.\n`);
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
    verificationRequired: Boolean(phase.verification_required || phase.verification?.required || (Array.isArray(phase.mode) ? phase.mode : [phase.mode]).includes('HITL')),
    status: normalizeRoadmapStatus(phase.status, id),
  };
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

function syncRoadmap(root) {
  const roadmap = readRoadmap(root);
  const state = readState(root);
  const old = new Map(state.phases.map((phase) => [phase.id, phase]));
  const incoming = new Set(roadmap.phases.map((phase) => phase.id));
  for (const prior of state.phases) {
    if (!incoming.has(prior.id) && (prior.status !== 'ready' || prior.commit || state.reviews.functional?.phase === prior.id || state.reviews.security?.phase === prior.id || state.lastValidation?.phase === prior.id)) throw new Error(`cannot remove referenced phase ${prior.id}; preserve its history in the roadmap`);
  }
  state.project = { name: roadmap.project.name ?? null, objective: roadmap.project.objective ?? null };
  state.roadmap = { source: 'ROADMAP.yaml', format: roadmap.format, out_of_scope: roadmap.out_of_scope ?? [] };
  state.phases = roadmap.phases.map((phase) => {
    const prior = old.get(phase.id);
    return prior
      ? { ...prior, ...phase, status: prior.status, commit: prior.commit ?? null, attempts: prior.attempts ?? 0, reason: prior.reason ?? null, blockerKind: prior.blockerKind ?? null }
      : { ...phase, commit: null, attempts: 0, reason: null, blockerKind: null };
  });
  validateState(state);
  saveState(root, state);
  event(root, 'roadmap_synced', { phases: state.phases.length });
  return state;
}

function dependenciesComplete(state, phase) {
  const byId = new Map(state.phases.map((item) => [item.id, item]));
  return (phase.depends_on ?? []).every((id) => TERMINAL_PHASE_STATES.has(byId.get(id)?.status));
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
  state.activeWave = status === 'active' ? { phase: phase.id, startedAt: state.activeWave?.startedAt ?? now(), checkpointAt: now() } : null;
  if (status === 'awaiting_human' || status === 'blocked' || status === 'parked') {
    state.humanAction = { phase: phase.id, status, kind: blockerKind, reason: reason ?? 'Human attention is required.' };
  } else if (state.humanAction?.phase === phase.id) state.humanAction = null;
  saveState(root, state);
  event(root, `phase_${status}`, { phase: phase.id, kind: blockerKind, reason });
}

function activePhase(state, phase) {
  if (phase.status !== 'active' || state.activeWave?.phase !== phase.id || !dependenciesComplete(state, phase)) throw new Error(`phase ${phase.id} must be active with completed dependencies`);
}

function reviewArtifact(root, file, candidate, type, status) {
  const bytes = readFileSync(localPath(root, file));
  const artifact = JSON.parse(bytes);
  if (artifact.version !== 1 || artifact.candidate !== candidate || artifact.type !== type || artifact.status !== status || typeof artifact.reviewer?.id !== 'string' || !artifact.reviewer.id.trim() || artifact.reviewer.independent !== true || !Array.isArray(artifact.evidence) || !artifact.evidence.length || artifact.evidence.some((item) => typeof item !== 'string' || !item.trim()) || !Array.isArray(artifact.findings)) throw new Error('review artifact needs current candidate, matching type/status, independent reviewer identity, evidence and findings');
  if (status === 'pass' && artifact.findings.some((finding) => ['HIGH', 'CRITICAL'].includes(String(finding.severity).toUpperCase()))) throw new Error('passing review cannot contain blocking findings');
  return { artifact, bytes, hash: sha(bytes) };
}

function storeEvidence(root, kind, bytes) {
  const digest = sha(bytes);
  const file = localPath(root, `${STATE_DIR}/evidence/${kind}-${digest}.json`);
  ensureDir(file, true);
  if (!existsSync(file)) writeFileSync(file, bytes, { flag: 'wx' });
  if (sha(readFileSync(file)) !== digest) throw new Error('stored evidence hash mismatch');
  return { path: path.relative(root, file), hash: digest };
}

function evidenceValid(root, evidence) {
  try { return Boolean(evidence?.path && evidence.hash && sha(readFileSync(localPath(root, evidence.path))) === evidence.hash); }
  catch { return false; }
}

function requireValidation(root, phase, candidate) {
  const validation = phase.validation;
  if (!validation || validation.status !== 'pass' || !validation.executed || validation.candidate !== candidate || !evidenceValid(root, validation.evidence)) throw new Error('a successful executed validation for this exact candidate is required');
  if (!evidenceValid(root, validation.verification)) throw new Error('verification report is missing or changed');
  if (phase.verificationRequired && (!validation.verification || validation.verification.verdict !== 'PASS')) throw new Error('this phase requires passing verification evidence');
  return validation;
}

function validateCandidate(root, state, phase, options) {
  const command = optionRequired(options, 'command');
  const candidate = candidateTree(root);
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
  run('git', ['diff', '--exit-code'], { cwd: root });
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
  if (phase.verificationRequired && (!visual || visual.manifest.steps.some((step) => step.status !== 'pass'))) validation.status = 'fail';
  validation.verification = writeReport(root, { title: phase.title, phase: phase.id, candidate, validation, evidence: visual, steps: phase.verificationRequired && !visual ? [{ name: 'Required verification', status: 'unverified', observed: 'No verification manifest was supplied.' }] : [] });
  validation.evidence = storeEvidence(root, 'validation', Buffer.from(JSON.stringify(validation)));
  phase.allowedPaths = paths;
  phase.validation = validation;
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

function loopStopKind(root, state, phase, options) {
  const kind = String(options.kind ?? '');
  if (!LOOP_STOP_KINDS.has(kind)) {
    throw new Error(`loop mode may stop only with --kind ${[...LOOP_STOP_KINDS].join(', ')}`);
  }
  if (kind === 'validation-failure') {
    const validationFailed = state.lastValidation?.phase === phase.id && state.lastValidation?.status === 'fail';
    const reviewFailed = ['functional', 'security'].some((type) => receiptFor(root, phase, type)?.status === 'fail');
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
  state.reviews[type] = receipt;
  if (options.model) state.model = { name: options.model, reasoning: options.reasoning ?? null, fast_available: options.fast_available === 'true' };
  if (type === 'security' && status === 'fail') {
    state.securityFindings.push(receipt);
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      markPhase(root, state, phase, 'parked', receipt.decision_reason, 'validation-failure');
      return receipt;
    }
  }
  saveState(root, state);
  event(root, `${type}_review`, { phase: phase.id, status, severity, candidate: receipt.candidate, summary: receipt.summary });
  return receipt;
}

function receiptFor(root, phase, type) {
  return readJson(localPath(root, path.join(pathsFor(root).receipts, `${phaseId(phase.id)}-${type}.json`)), false);
}

function cmdWave(tokens) {
  const root = gitRoot();
  const action = tokens[0] ?? 'select';
  const options = parseOptions(tokens.slice(1));
  let state;
  try { state = readState(root); } catch (error) { fail(`${error.message}; run riff-codex init`); }
  try {
    const autonomy = autonomyMode(root);
    if (action === 'sync') {
      state = syncRoadmap(root);
      process.stdout.write(`${state.phases.length} roadmap phases synchronized.\n`);
      return;
    }
    if (action === 'select' || action === 'resume') {
      const requested = options._[0];
      if (action === 'resume' && requested) {
        const resumable = phaseById(state, requested);
        if (['parked', 'blocked', 'awaiting_human'].includes(resumable.status)) {
          const active = state.phases.find((item) => item.status === 'active');
          if (active && active.id !== resumable.id) throw new Error(`phase ${active.id} is active; resume or park it first`);
          const reason = optionRequired(options, 'reason');
          resumable.attempts = 0;
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
      process.stdout.write(`${JSON.stringify(phase, null, 2)}\n`);
      return;
    }
    const id = options._[0];
    if (!id) throw new Error(`riff-codex wave ${action} requires a phase id`);
    const phase = phaseById(state, id);
    if (action === 'activate') {
      const selected = selectPhase(state, id);
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
      saveState(root, state);
      event(root, 'targeted_retry', { phase: id, reason });
      process.stdout.write(`Recorded the one targeted correction for ${id}.\n`);
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
      activePhase(state, phase);
      const commitTree = run('git', ['rev-parse', `${commit}^{tree}`], { cwd: root });
      if (run('git', ['rev-parse', commit], { cwd: root }) !== run('git', ['rev-parse', 'HEAD'], { cwd: root })) throw new Error('completion must refer to current HEAD');
      requireValidation(root, phase, commitTree);
      const functional = receiptFor(root, phase, 'functional');
      const security = receiptFor(root, phase, 'security');
      if (!functional || functional.status !== 'pass' || functional.candidate !== commitTree || !evidenceValid(root, functional.evidence)) throw new Error('a passing functional receipt with intact evidence for the exact commit tree is required');
      if (phase.sensitive && (!security || security.status !== 'pass' || security.candidate !== commitTree || !evidenceValid(root, security.evidence))) throw new Error('a passing security receipt with intact evidence for the exact sensitive commit tree is required');
      phase.commit = run('git', ['rev-parse', commit], { cwd: root });
      phase.status = 'completed';
      phase.reason = null;
      phase.blockerKind = null;
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
  if (existsSync(files.roadmap)) {
    try { const roadmap = readRoadmap(root); add('ok', 'roadmap', `${roadmap.phases.length} phases parse correctly`); }
    catch (error) { add('error', 'roadmap', error.message); }
  } else add('ok', 'roadmap', 'not created yet; run $riff:start');
  let hooks = null;
  try {
    hooks = readJson(files.hooks);
    const count = Object.values(hooks.hooks ?? {}).flat().flatMap((group) => group.hooks ?? []).filter((hook) => String(hook.command ?? '').includes(HOOK_ID)).length;
    const systemPolicy = managedHookPolicy(root, PLUGIN_ROOT);
    if (!systemPolicy && count < 6) throw new Error(`only ${count}/6 RIFF hook groups found`);
    if (systemPolicy && count) add('warn', 'Codex hooks', 'system policy and duplicate project hooks; run resync');
    else add('ok', 'Codex hooks', systemPolicy ? '6 hooks configured by system policy; project duplicates removed' : `${count} managed groups installed`);
  } catch (error) { add('error', 'Codex hooks', error.message); }
  const codexHome = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(homedir(), '.codex');
  const disabledAt = [path.join(root, '.codex', 'config.toml'), path.join(codexHome, 'config.toml')].find(configDisablesHooks);
  if (disabledAt && !managedHookPolicy(root, PLUGIN_ROOT)) add('error', 'hook feature', `disabled in ${disabledAt}`); else add('ok', 'hook feature', managedHookPolicy(root, PLUGIN_ROOT) ? 'enabled by system requirements' : 'not disabled in project or user config');
  if (config && hooks && managedHookPolicy(root, PLUGIN_ROOT)) {
    add('ok', 'hook approval', 'trusted by system policy on next configuration load; no user approval marker needed');
  } else if (config && hooks) {
    const currentHash = hooksHash(hooks);
    if (recordApproval) { config.hooks ??= {}; config.hooks.approvedHash = currentHash; writeJson(files.config, config); }
    if (config.hooks?.approvedHash === currentHash) add('ok', 'hook approval', 'recorded for the current hook hash');
    else add('warn', 'hook approval', 'pending or changed; review with /hooks, then run riff-codex doctor --record-hooks-approved');
  }
  try {
    const framework = lstatSync(files.framework);
    const resolved = path.resolve(root, readlinkSync(files.framework));
    if (!framework.isSymbolicLink() || resolved !== PLUGIN_ROOT) throw new Error(`expected ${FRAMEWORK_DIR} -> ${PLUGIN_ROOT}`);
    add('ok', 'framework symlink', `${FRAMEWORK_DIR} -> ${PLUGIN_ROOT}`);
  } catch (error) { add('error', 'framework symlink', error.message); }
  for (const name of readFileNames(path.join(PLUGIN_ROOT, 'skills'))) {
    const target = path.join(root, '.agents', 'skills', `riff-codex-${name}`);
    let valid = false;
    try { valid = lstatSync(target).isSymbolicLink() && path.resolve(path.dirname(target), readlinkSync(target)) === path.join(root, FRAMEWORK_DIR, 'skills', name); } catch { /* missing */ }
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
    securityFindings: state.securityFindings.slice(-10),
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
  files.sort();
  return sha(files.map((file) => `${path.relative(dashboardRoot, file)}:${sha(readFileSync(file))}`).join('\n'));
}

async function dashboardTarget(startPort, explicitPort, dashboardInstance) {
  for (let offset = 0; offset < 20; offset += 1) {
    const port = startPort + offset;
    const url = `http://127.0.0.1:${port}`;
    const identity = await dashboardIdentity(url);
    if (!identity.reachable) return { port, url, reuse: false };
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
      else process.stdout.write(`${data.project.name ?? 'Unshaped project'}\nProgress: ${data.progress.completed}/${data.progress.total}\nActive: ${data.activeWave?.phase ?? 'none'}\nNext ready: ${data.nextReady?.id ?? 'none'}\nHuman action: ${data.humanAction?.reason ?? 'none'}\n`);
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
  const recordedCurrentFramework = prior?.frameworkRoot === PLUGIN_ROOT && prior?.url === priorUrl;
  if (
    priorIdentity.reachable &&
    (priorIdentity.frameworkRoot === PLUGIN_ROOT || recordedCurrentFramework) &&
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
    const child = spawn('bun', ['run', 'server.ts'], {
      cwd: dashboardRoot,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, PORT: String(port), RIFF_DASHBOARD_INSTANCE: dashboardInstance },
    });
    child.unref();
    if (!(await waitForDashboard(url, dashboardInstance))) fail(`dashboard failed to start at ${url}`);
    writeJson(processFile, { version: 1, pid: child.pid, port, url, dashboardRoot, frameworkRoot: PLUGIN_ROOT, dashboardInstance, startedAt: now() });
  } else if (prior?.url !== url || prior?.frameworkRoot !== PLUGIN_ROOT || prior?.dashboardInstance !== dashboardInstance) {
    writeJson(processFile, { version: 1, pid: prior?.pid ?? null, port, url, dashboardRoot, frameworkRoot: PLUGIN_ROOT, dashboardInstance, startedAt: prior?.startedAt ?? now() });
  }
  if (!options.no_open && process.platform === 'darwin') spawnSync('open', [url], { stdio: 'ignore' });
  process.stdout.write(`RIFF dashboard: ${url}\nShared, read-only, and independent from Codex or Claude.\n`);
}

function changedFiles(root, payload) {
  const files = new Set();
  const command = String(payload?.tool_input?.command ?? '');
  for (const match of command.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) files.add(match[1].trim());
  try {
    const args = ['status', '--porcelain=v1'];
    const output = run('git', args, { cwd: root });
    for (const line of output.split('\n').filter(Boolean)) files.add(line.slice(3));
  } catch { /* hook remains advisory */ }
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
  if (finding.kind === 'environment_file') return { ...finding, what_could_happen: 'Private environment configuration could be committed even when its credentials are not recognized.', affected: 'The services configured by this file.', recommended_fix: 'Unstage the environment file and commit only a sanitized .env.example template.', decision_reason: 'RIFF stops because private environment files must stay out of Git.' };
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
    active.blockerKind = 'validation-failure';
    state.activeWave = null;
    state.humanAction = { phase: active.id, status: 'parked', kind: 'validation-failure', reason: finding.decision_reason };
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
  const oldRiff = '/Users/webstantly/DEV/frameworks/riff';
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
  const findings = [...files.flatMap((file) => scanFile(file)), ...files.map((file) => orphanFinding(root, file)).filter(Boolean)].map(plainFinding);
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
  const active = state.phases.find((phase) => phase.status === 'active');
  if (!active) return 0;
  const candidate = candidateTree(root);
  try { requireValidation(root, active, candidate); }
  catch (error) { process.stderr.write(`RIFF pre-commit blocked: ${error.message}\n`); return 1; }
  const functional = receiptFor(root, active, 'functional');
  const security = receiptFor(root, active, 'security');
  if (!functional || functional.status !== 'pass' || functional.candidate !== candidate || !evidenceValid(root, functional.evidence)) {
    process.stderr.write('RIFF pre-commit blocked: the active wave needs a fresh passing functional review receipt for this exact staged tree.\n');
    return 1;
  }
  if (active.sensitive && (!security || security.status !== 'pass' || security.candidate !== candidate || !evidenceValid(root, security.evidence))) {
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
      const context = [`RIFF conversation language: ${config?.language ?? 'en'}; artifact language: ${config?.artifactLanguage ?? 'en'}.`, `Project scope: ${config?.project?.scope ?? 'production'}. Preferences: explanation=${config?.preferences?.explanation ?? 'simple'}, autonomy=${config?.preferences?.autonomy ?? 'loop'}.`, `Use PROJECT.md and ROADMAP.yaml as shared product sources; use ${STATE_DIR}/state.json through the RIFF CLI only.`];
      context.push(`For implementation or review, read project taste.md when present and ${FRAMEWORK_DIR}/references/taste.md; load only relevant topic and stack rules. For frontend work, read ${FRAMEWORK_DIR}/references/taste/frontend.md, apply the relevant design skills and verify the rendered result in the browser. Use $riff:learn-stack for reusable stack-convention gaps.`);
      if ((config?.preferences?.autonomy ?? 'loop') === 'loop') context.push('Loop autonomy: make conservative product and technical decisions, follow ready dependencies automatically, and do not request human decisions. Stop only for missing credentials or external access, impossible third-party verification, an unidentifiable destructive target, or failed RIFF validation.');
      else context.push('Guided autonomy: preserve confirmation at product decision boundaries and between phases.');
      if (active) context.push(`Resume interrupted phase ${active.id}. Load ${FRAMEWORK_DIR}/references/operating-contract.md before continuing.`);
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

function cmdReport(tokens) {
  const root = gitRoot();
  const options = parseOptions(tokens);
  const candidate = candidateTree(root);
  const evidence = verificationEvidence(root, optionRequired(options, 'evidence'), candidate);
  const report = writeReport(root, { title: evidence.manifest.title ?? 'Verification report', candidate, phase: options.phase ?? 'verification', evidence });
  event(root, 'verification_report', report);
  process.stdout.write(`${path.join(root, report.path)}\n${report.verdict}\n`);
}

function cmdFinish(tokens) {
  const options = parseOptions(tokens);
  if (!options.check) throw new Error('finish currently requires --check; Git publication remains an explicit separate action');
  const root = gitRoot();
  const state = readState(root);
  if (state.phases.some((phase) => !TERMINAL_PHASE_STATES.has(phase.status))) throw new Error('unfinished phases remain');
  for (const phase of state.phases.filter((phase) => phase.status === 'completed')) {
    const tree = run('git', ['rev-parse', `${phase.commit}^{tree}`], { cwd: root });
    requireValidation(root, phase, tree);
    for (const type of phase.sensitive ? ['functional', 'security'] : ['functional']) {
      const receipt = receiptFor(root, phase, type);
      if (receipt?.status !== 'pass' || receipt.candidate !== tree || !evidenceValid(root, receipt.evidence)) throw new Error(`phase ${phase.id} lacks intact ${type} evidence`);
    }
    run('git', ['merge-base', '--is-ancestor', phase.commit, 'HEAD'], { cwd: root });
  }
  if (run('git', ['status', '--porcelain'], { cwd: root })) throw new Error('commit or preserve pending project changes before finishing');
  process.stdout.write(`Ready for explicit Git finalization at ${run('git', ['rev-parse', 'HEAD'], { cwd: root })}.\nNo push, merge or deployment performed.\n`);
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

function help() {
  process.stdout.write(`RIFF ${VERSION}\n\nUsage:\n  riff-codex init [--project-root PATH] [--configure] [--non-interactive] [--autonomy loop|guided]\n  riff-codex resync [--record-hooks-approved]\n  riff-codex doctor [--record-hooks-approved]\n  riff-codex dashboard [--port 4000|--no-open|--snapshot|--check]\n  riff-codex status\n  riff-codex wave [select|resume|sync|activate|validate|review|retry|park|block|await|complete] ...\n\nWave state examples:\n  riff-codex wave sync\n  riff-codex wave activate phase-1\n  riff-codex wave validate phase-1 --run --command '["npm","test"]' --paths '["src","test"]'\n  riff-codex wave park phase-1 --kind validation-failure --reason "Formal retry failed"\n  riff-codex wave review phase-1 --type functional --status pass --summary "Vertical outcome works" --evidence .riff-codex-state/review.json\n  riff-codex wave complete phase-1 --commit HEAD\n\nEvidence and lifecycle:\n  riff-codex report --evidence .riff-codex-state/verification.json\n  riff-codex promote [--apply --architecture FILE --roadmap FILE --functional FILE [--security FILE]]\n  riff-codex incident log --evidence FILE\n  riff-codex finish --check\n\nLoop stop kinds: credentials-or-access, third-party-verification, destructive-target, validation-failure.\nRIFF never provides a public next command. Selection belongs to wave.\n`);
}

const [command, ...tokens] = process.argv.slice(2);
if (!command || command === '--help' || command === '-h' || command === 'help') help();
else if (command === '--version' || command === '-v') process.stdout.write(`${VERSION}\n`);
else if (command === 'init') await cmdInit(tokens);
else if (command === 'resync') cmdResync(tokens);
else if (command === 'doctor') cmdDoctor(tokens);
else if (command === 'dashboard') await cmdDashboard(tokens);
else if (command === 'status') cmdStatus();
else if (['report', 'promote', 'incident', 'finish'].includes(command)) {
  try {
    const action = () => ({ report: cmdReport, promote: cmdPromote, incident: cmdIncident, finish: cmdFinish })[command](tokens);
    if (command === 'finish') action(); else withLock(gitRoot(), action);
  } catch (error) { fail(error.message); }
}
else if (command === 'wave') {
  try { if (tokens[0] === 'select') cmdWave(tokens); else withLock(gitRoot(), () => cmdWave(tokens)); } catch (error) { fail(error.message); }
}
else if (command === 'hook') {
  try { if (['post-tool', 'pre-compact'].includes(tokens[0])) withLock(gitRoot(), () => cmdHook(tokens)); else cmdHook(tokens); } catch (error) { fail(error.message); }
}
else if (command === 'next') fail('riff-codex next is intentionally deferred; use $riff:wave or riff-codex wave select');
else fail(`unknown command ${command}; run riff-codex --help`);
