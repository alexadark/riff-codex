#!/usr/bin/env node
// Machine-installed dispatcher. Only the explicitly configured RIFF checkout is executable.
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';

const names = new Set(['session-start', 'pre-compact', 'pre-tool', 'post-tool', 'stop', 'session-end']);
const input = readFileSync(0, 'utf8');
const name = process.argv[2];
if (!names.has(name)) throw new Error('Unsupported RIFF hook');
const policy = JSON.parse(readFileSync(new URL('./installation.json', import.meta.url), 'utf8'));
const payload = JSON.parse(input || '{}');
const inside = (root, target) => { const rel = path.relative(root, target); return rel === '' || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`)); };
let root;
try { root = realpathSync(execFileSync('/usr/bin/git', ['-C', payload.cwd ?? process.cwd(), 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()); } catch { /* not a Git project */ }
let eligible = Boolean(root && process.getuid() === policy.uid && inside(policy.projectsRoot, root));
if (eligible) {
  try { eligible = realpathSync(path.join(root, '.riff-codex')) === policy.frameworkRoot && existsSync(path.join(root, '.riff-codex-state/config.json')); }
  catch { eligible = false; }
}
if (!eligible) process.stdout.write('{}\n');
else {
  const result = spawnSync(policy.node, [path.join(policy.frameworkRoot, 'bin/riff.mjs'), 'hook', name, '--id', `riff-codex-hook:${name}`], { cwd: root, input, encoding: 'utf8', timeout: name === 'session-end' ? 2500 : 9000, maxBuffer: 4 * 1024 * 1024 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) process.stderr.write(`RIFF managed hook: ${result.error.message}\n`);
  process.exitCode = result.status ?? 1;
}
