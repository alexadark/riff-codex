import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { MIN_RUNS, renderReport } from './ab/analyze.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));

// The environment of this test run may come from a Git hook or an agent session.
const env = (extra) => ({ ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))), ...extra });

function git(cwd, ...args) {
  const result = spawnSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', ...args], { cwd, encoding: 'utf8', env: env() });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

// A fresh clone in another folder with the current harness, plus a commit that changes the quick skill.
function freshClone(t) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'riff-ab-test-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const clone = path.join(root, 'clone');
  git(root, 'clone', '-q', repo, clone);
  cpSync(path.join(repo, 'test/ab'), path.join(clone, 'test/ab'), { recursive: true, filter: (file) => path.basename(file) !== 'runs' });
  const skill = path.join(clone, 'riff/skills/quick/SKILL.md');
  writeFileSync(skill, `${readFileSync(skill, 'utf8')}\nMarker of the new arm.\n`);
  git(clone, 'add', '-A');
  git(clone, 'commit', '-qm', 'New arm', '--no-verify');
  // Offline stand-in for `npm ci`: same lockfile, dependencies already installed here.
  cpSync(path.join(repo, 'node_modules'), path.join(clone, 'node_modules'), { recursive: true });
  const tmp = path.join(root, 'tmp');
  const bin = path.join(root, 'bin');
  mkdirSync(tmp);
  mkdirSync(bin);
  const out = path.join(root, 'out');
  const args = (...rest) => [path.join(clone, 'test/ab/compare.mjs'), '--old', 'HEAD~1', '--new', 'HEAD', '--out', out, ...rest];
  const options = { cwd: root, encoding: 'utf8', env: env({ TMPDIR: tmp, PATH: `${bin}${path.delimiter}${process.env.PATH}`, SECRET_TOKEN: 'leak', RIFF_IDEAS_FILE: path.join(root, 'real-ideas') }) };
  const fakeClaude = (script) => {
    writeFileSync(path.join(bin, 'claude'), `#!/bin/sh\n${script}\n`);
    chmodSync(path.join(bin, 'claude'), 0o755);
  };
  return { clone, out, tmp, args, options, fakeClaude, standIn: path.join(clone, 'test/ab/dry-model.mjs'), compare: (...rest) => spawnSync(process.execPath, args(...rest), options), report: () => JSON.parse(readFileSync(path.join(out, 'report.json'), 'utf8')) };
}

test('dry comparison from a fresh clone runs both revisions isolated, without pushing, and leaves nothing behind', (t) => {
  const { clone, out, tmp, compare, report, fakeClaude } = freshClone(t);
  fakeClaude('echo "the dry mode called a model" >&2; exit 99');
  const result = compare('--dry');
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const { arms, rows } = report();
  assert.equal(arms.old.commit, git(clone, 'rev-parse', 'HEAD~1'));
  assert.equal(arms.new.commit, git(clone, 'rev-parse', 'HEAD'));
  assert.deepEqual(rows.map((row) => row.arm), ['old', 'new']);
  for (const row of rows) assert.deepEqual([row.counted, row.goalMet, row.testsPass, row.commits, row.outOfScope], [true, true, true, 1, 'none'], JSON.stringify(row));
  const probes = rows.map((row) => JSON.parse(readFileSync(path.join(out, row.run, 'probe.json'), 'utf8')));
  assert.notEqual(probes[0].skillSha, probes[1].skillSha);
  for (const probe of probes) {
    assert.notEqual(probe.pushStatus, 0);
    assert.notEqual(probe.toolHome, process.env.HOME);
    assert.ok(!probe.envKeys.includes('SECRET_TOKEN'));
    assert.ok(probe.argv.join(' ').includes('--setting-sources project,local --strict-mcp-config'));
  }
  assert.match(readFileSync(path.join(out, 'report.md'), 'utf8'), /Dry run: no model ran/);
  assert.deepEqual(readdirSync(tmp), []);
  assert.equal(git(clone, 'worktree', 'list').split('\n').length, 1);
  assert.equal(git(clone, 'status', '--porcelain'), '');
});

test('a model run needs its number of runs and a spending limit, and the limit stops the next run', (t) => {
  const { compare, report, fakeClaude, standIn } = freshClone(t);
  fakeClaude(`AB_STAND_IN_COST=0.6 exec "${process.execPath}" "${standIn}" "$@"`);
  for (const missing of [['--runs', '1'], ['--max-usd', '1'], ['--runs', '0', '--max-usd', '1'], ['--runs', '1', '--max-usd', '0']]) {
    const refused = compare(...missing);
    assert.notEqual(refused.status, 0, missing.join(' '));
    assert.match(refused.stderr, /--runs|--max-usd/);
  }
  const result = compare('--runs', '2', '--max-usd', '1');
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const { rows, spentUsd } = report();
  assert.deepEqual(rows.map((row) => [row.run, row.capUsd ?? null, row.counted]), [['old-1', 0.25, true], ['new-1', 0.25, true], ['new-2', null, false], ['old-2', null, false]]);
  assert.match(rows[2].note, /spending limit/);
  assert.equal(spentUsd, 1.2);
});

test('a run that loads other settings is stopped and not counted', (t) => {
  const { compare, report, fakeClaude, standIn } = freshClone(t);
  fakeClaude(`AB_STAND_IN_MCP=mail exec "${process.execPath}" "${standIn}" "$@"`);
  const result = compare('--runs', '1', '--max-usd', '1');
  assert.notEqual(result.status, 0);
  const { rows } = report();
  assert.ok(rows.every((row) => !row.counted));
  assert.match(rows[0].note, /not isolated.*mail/);
  assert.equal(rows.length, 2);
  assert.match(rows[1].note, /not started/);
});

test('an interrupted comparison stops the model, writes what it has and removes its scratch folder', async (t) => {
  const { args, options, out, tmp, fakeClaude } = freshClone(t);
  const pidFile = path.join(path.dirname(out), 'pid');
  fakeClaude(`echo $$ > "${pidFile}"; exec sleep 600`);
  const child = spawn(process.execPath, args('--runs', '1', '--max-usd', '1'), { ...options, stdio: 'ignore' });
  const deadline = Date.now() + 60000;
  while (!(existsSync(pidFile) && readFileSync(pidFile, 'utf8').trim())) {
    assert.ok(Date.now() < deadline && child.exitCode === null, 'the model run did not start');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill('SIGTERM');
  assert.equal(await new Promise((resolve) => child.on('exit', resolve)), 130);
  assert.throws(() => process.kill(Number(readFileSync(pidFile, 'utf8')), 0));
  assert.deepEqual(readdirSync(tmp), []);
  assert.match(readFileSync(path.join(out, 'report.md'), 'utf8'), /interrupted/);
});

test('the report shows every run and its spread, and withholds a reading below the runs needed', () => {
  const row = (arm, n, costUsd, extra = {}) => ({ run: `${arm}-${n}`, arm, counted: true, goalMet: true, testsPass: true, costUsd, minutes: n, turns: 10, outOfScope: 'none', note: '', ...extra });
  const result = (rows) => ({ skill: 'quick', dry: false, runs: MIN_RUNS, spentUsd: 1, maxUsd: 5, model: 'opus', effort: 'medium', arms: { old: { ref: 'a', commit: 'a'.repeat(40) }, new: { ref: 'b', commit: 'b'.repeat(40) } }, rows });
  const numbers = Array.from({ length: MIN_RUNS }, (_, index) => index + 1);
  const all = [...numbers.map((n) => row('old', n, n)), ...numbers.map((n) => row('new', n, n + 100))];
  const few = renderReport(result([...all.slice(0, -1), row('new', MIN_RUNS, 0.5, { counted: false, note: 'timed out' })]));
  assert.match(few, /Not enough data/);
  assert.doesNotMatch(few, /separate|overlap/);
  assert.match(few, /new-5.*timed out/);
  assert.match(few, /\| Cost \(USD\) \| old \| 5 \| 1 \| 3 \| 5 \|/);
  const enough = renderReport(result(all));
  assert.doesNotMatch(enough, /Not enough data/);
  assert.match(enough, /Cost \(USD\): the ranges are separate/);
  assert.match(enough, /Turns: the ranges overlap/);
});
