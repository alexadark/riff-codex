#!/usr/bin/env node
// Compares two revisions of the framework on the same fixture. See docs/evals.md.
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { analyzeRun, exportTree, renderReport } from './analyze.mjs';
import { commandEnv, isolationProblem, makeHome, modelArgs, modelEnv } from './isolation.mjs';

const AB = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(AB, '..', '..');
const USAGE = `Usage: node test/ab/compare.mjs --old REV --new REV --dry
       node test/ab/compare.mjs --old REV --new REV --runs N --max-usd USD
  --old, --new        Git revisions of this repository to compare
  --dry               everything except the model, at no cost
  --runs N            runs per arm, 1 to 20 (default 1 with --dry, required otherwise)
  --max-usd USD       spending limit of the whole comparison (required without --dry)
  --skill NAME        quick (default) or wave
  --model, --effort   Claude model and effort (default opus, medium)
  --timeout-minutes N limit for one run (default 30)
  --out DIR           new folder for the report (default test/ab/runs/<date>-<skill>)`;
const PROMPTS = {
  quick: "Use the RIFF quick skill for this change: the error for an empty task title should read 'Task title is required'. Publication is not authorized: no push and no pull request.",
  wave: "Use the RIFF wave skill to build this project's roadmap. Autonomy is loop: work through every ready phase without asking me anything. Publication is not authorized: no push and no pull request.",
};

function readOptions() {
  const { values } = parseArgs({
    options: Object.fromEntries([...['old', 'new', 'runs', 'max-usd', 'skill', 'model', 'effort', 'timeout-minutes', 'out'].map((name) => [name, { type: 'string' }]), ['dry', { type: 'boolean' }], ['help', { type: 'boolean' }]]),
  });
  if (values.help) return null;
  if (!values.old || !values.new) throw new Error('--old and --new are required');
  const skill = values.skill ?? 'quick';
  if (!Object.hasOwn(PROMPTS, skill)) throw new Error(`--skill must be one of ${Object.keys(PROMPTS).join(', ')}`);
  const dry = Boolean(values.dry);
  if (!dry && values.runs === undefined) throw new Error('a model run needs its number of runs: --runs');
  if (!dry && values['max-usd'] === undefined) throw new Error('a model run needs a spending limit: --max-usd');
  const runs = Number(values.runs ?? 1);
  if (!Number.isInteger(runs) || runs < 1 || runs > 20) throw new Error('--runs must be a whole number from 1 to 20');
  const maxUsd = dry ? 0 : Number(values['max-usd']);
  if (!dry && !(Number.isFinite(maxUsd) && maxUsd > 0)) throw new Error('--max-usd must be a positive amount');
  const timeoutMinutes = Number(values['timeout-minutes'] ?? 30);
  if (!(Number.isFinite(timeoutMinutes) && timeoutMinutes > 0)) throw new Error('--timeout-minutes must be positive');
  const out = path.resolve(values.out ?? path.join(AB, 'runs', `${new Date().toISOString().replaceAll(':', '-').slice(0, 19)}-${skill}`));
  if (existsSync(out)) throw new Error(`--out already exists: ${out}`);
  return { refs: { old: values.old, new: values.new }, skill, dry, runs, maxUsd, timeoutMinutes, out, model: values.model ?? 'opus', effort: values.effort ?? 'medium' };
}

// Git variables of a calling hook would point these commands at another repository.
const hostEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));

function resolveCommit(ref) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`], { cwd: REPO, env: hostEnv, encoding: 'utf8' }).trim();
  } catch {
    throw new Error(`not a commit of this repository: ${ref}`);
  }
}

// One arm: the files of its revision with their dependencies, outside any Git repository.
function checkoutArm(commit, dir, skill) {
  exportTree(REPO, commit, dir, hostEnv);
  if (!existsSync(path.join(dir, 'riff', 'skills', skill, 'SKILL.md'))) throw new Error(`revision ${commit.slice(0, 12)} has no ${skill} skill`);
  const lock = 'package-lock.json';
  const same = existsSync(path.join(REPO, 'node_modules')) && existsSync(path.join(dir, lock)) && readFileSync(path.join(dir, lock), 'utf8') === readFileSync(path.join(REPO, lock), 'utf8');
  if (same) cpSync(path.join(REPO, 'node_modules'), path.join(dir, 'node_modules'), { recursive: true });
  else execFileSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--silent'], { cwd: dir, env: hostEnv, stdio: ['ignore', 'inherit', 'inherit'] });
  return path.join(dir, 'riff');
}

function prepareRun(dir, framework) {
  const project = path.join(dir, 'project');
  const home = makeHome(dir);
  const env = commandEnv(dir, home.home);
  cpSync(path.join(AB, 'template'), project, { recursive: true });
  const git = (...args) => execFileSync('git', args, { cwd: project, env, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('add', '-A');
  git('commit', '-qm', 'Tasklist baseline');
  const log = path.join(dir, 'init.log');
  try {
    writeFileSync(log, execFileSync(process.execPath, [path.join(framework, 'bin', 'riff.mjs'), 'init', '--project-root', '.', '--non-interactive', '--scope', 'production', '--autonomy', 'loop'], { cwd: project, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (error) {
    throw new Error(`riff init failed: ${String(error.stderr || error.stdout || error.message).trim().slice(-400)}`);
  }
  // The arm's own skills come from --plugin-dir; an installed RIFF plugin would mix revisions.
  const settingsFile = path.join(project, '.claude', 'settings.local.json');
  const settings = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) : {};
  settings.enabledPlugins = Object.fromEntries(Object.keys(settings.enabledPlugins ?? {}).map((name) => [name, false]));
  mkdirSync(path.dirname(settingsFile), { recursive: true });
  writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`);
  return { project, home, env, base: git('rev-parse', 'HEAD') };
}

let current = null;
let interrupted = false;
function stop(child, signal = 'SIGTERM') {
  try { process.kill(-child.pid, signal); } catch { /* already gone */ }
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    interrupted = true;
    if (current) stop(current);
  });
}

// Runs the model, or its stand-in, and returns why it was stopped, if it was.
function runModel({ dir, project, home, options, pluginDir, capUsd }) {
  const args = modelArgs({ prompt: PROMPTS[options.skill], model: options.model, effort: options.effort, pluginDir, capUsd });
  const [command, argv] = options.dry ? [process.execPath, [path.join(AB, 'dry-model.mjs'), ...args]] : ['claude', args];
  const stream = path.join(dir, 'stream.jsonl');
  return new Promise((resolve) => {
    let reason = null;
    const child = spawn(command, argv, { cwd: project, env: modelEnv(dir, home), detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    current = child;
    const end = (why) => { reason ??= why; stop(child); setTimeout(() => stop(child, 'SIGKILL'), 5000).unref(); };
    const timer = setTimeout(() => end(`timed out after ${options.timeoutMinutes} minutes`), options.timeoutMinutes * 60000);
    let checked = false;
    const reader = createInterface({ input: child.stdout });
    reader.on('line', (line) => {
      appendFileSync(stream, `${line}\n`);
      if (checked) return;
      let event;
      try { event = JSON.parse(line); } catch { return; }
      if (event.type !== 'system' || event.subtype !== 'init') return;
      checked = true;
      const problem = isolationProblem(event, pluginDir);
      if (problem) end(`not isolated: ${problem}`);
    });
    child.stderr.on('data', (chunk) => appendFileSync(path.join(dir, 'stderr.log'), chunk));
    child.on('error', (error) => { reason ??= `could not start ${command}: ${error.message}`; });
    const closed = [new Promise((done) => { reader.on('close', done); }), new Promise((done) => { child.on('close', done); })];
    Promise.all(closed).then(() => {
      clearTimeout(timer);
      stop(child, 'SIGKILL'); // background processes the run left in its group
      current = null;
      if (interrupted) reason ??= 'interrupted';
      if (!checked) reason ??= 'the session never reported what it loaded';
      resolve(reason);
    });
  });
}

const KEPT_FILES = ['stream.jsonl', 'stderr.log', 'init.log', 'probe.json', 'ideas.ndjson'];

async function main() {
  const options = readOptions();
  if (!options) return console.log(USAGE);
  const arms = Object.fromEntries(Object.entries(options.refs).map(([arm, ref]) => [arm, { ref, commit: resolveCommit(ref) }]));
  const scratch = realpathSync(mkdtempSync(path.join(tmpdir(), 'riff-ab-')));
  const rows = [];
  let spentUsd = 0;
  let stopped = null;
  const result = () => ({ date: new Date().toISOString(), skill: options.skill, dry: options.dry, runs: options.runs, maxUsd: options.maxUsd, spentUsd: Number(spentUsd.toFixed(4)), model: options.model, effort: options.effort, arms, stopped, rows });
  try {
    for (const [arm, entry] of Object.entries(arms)) entry.framework = checkoutArm(entry.commit, path.join(scratch, arm), options.skill);
    mkdirSync(options.out, { recursive: true });
    // Alternate which arm goes first, so a slow hour doesn't fall on one arm.
    const order = Array.from({ length: options.runs }, (_, index) => (index % 2 ? ['new', 'old'] : ['old', 'new']).map((arm) => [arm, index + 1])).flat();
    const share = options.maxUsd / order.length;
    for (const [arm, number] of order) {
      const run = `${arm}-${number}`;
      if (!stopped && interrupted) stopped = 'interrupted';
      if (!stopped && !options.dry && spentUsd >= options.maxUsd) stopped = 'spending limit reached';
      if (stopped) {
        rows.push({ run, arm, counted: false, note: `not started: ${stopped}` });
        continue;
      }
      const capUsd = options.dry ? null : Number(Math.min(share, options.maxUsd - spentUsd).toFixed(4));
      const dir = path.join(scratch, run);
      const kept = path.join(options.out, run);
      mkdirSync(dir);
      const { project, home, env, base } = prepareRun(dir, arms[arm].framework);
      console.log(`${run}: ${options.dry ? 'stand-in' : `${options.model}, at most $${capUsd}`}`);
      const started = Date.now();
      const reason = await runModel({ dir, project, home, options, pluginDir: arms[arm].framework, capUsd });
      const minutes = (Date.now() - started) / 60000;
      const measured = analyzeRun({ dir, skill: options.skill, base, env });
      spentUsd += options.dry ? 0 : measured.costUsd ?? capUsd;
      const note = reason ?? (measured.finished ? '' : `did not finish: ${measured.ending ?? 'no result'}`);
      rows.push({ run, arm, capUsd, minutes, ...measured, counted: !reason && measured.finished, note });
      mkdirSync(kept);
      for (const file of KEPT_FILES) if (existsSync(path.join(dir, file))) copyFileSync(path.join(dir, file), path.join(kept, file));
      writeFileSync(path.join(kept, 'changes.patch'), execFileSync('git', ['diff', base, measured.branch ?? base], { cwd: project, env }));
      rmSync(dir, { recursive: true, force: true });
      if (reason?.startsWith('not isolated') || reason?.startsWith('could not start')) stopped = reason;
    }
    if (!stopped && interrupted) stopped = 'interrupted';
  } finally {
    rmSync(scratch, { recursive: true, force: true, maxRetries: 3 });
    for (const entry of Object.values(arms)) delete entry.framework;
    if (rows.length) {
      writeFileSync(path.join(options.out, 'report.json'), `${JSON.stringify(result(), null, 2)}\n`);
      writeFileSync(path.join(options.out, 'report.md'), renderReport(result()));
    } else if (existsSync(options.out) && readdirSync(options.out).length === 0) rmSync(options.out, { recursive: true });
  }
  console.log(`\n${renderReport(result())}\nReport: ${path.join(options.out, 'report.md')}`);
  if (interrupted) process.exitCode = 130;
  else if (stopped && stopped !== 'spending limit reached') process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = interrupted ? 130 : 1;
}
