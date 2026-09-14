import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const framework = path.join(repository, 'riff');
function setup() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'managed-riff-')));
  copyFileSync(path.join(framework, 'hooks/managed-dispatch.mjs'), path.join(root, 'managed-dispatch.mjs'));
  writeFileSync(path.join(root, 'installation.json'), JSON.stringify({ uid: process.getuid(), frameworkRoot: framework, projectsRoot: root, node: process.execPath }));
  return root;
}
function invoke(root, cwd, name = 'session-start') {
  return execFileSync(process.execPath, [path.join(root, 'managed-dispatch.mjs'), name], { cwd, input: JSON.stringify({ cwd, source: 'startup' }), encoding: 'utf8' });
}
test('managed dispatcher leaves non-RIFF and foreign framework projects untouched', () => {
  const root = setup();
  try {
    assert.deepEqual(JSON.parse(invoke(root, root)), {});
    execFileSync('/usr/bin/git', ['init', '-q', root]);
    const foreign = path.join(root, 'foreign'); mkdirSync(foreign);
    symlinkSync(foreign, path.join(root, '.riff-codex'));
    mkdirSync(path.join(root, '.riff-codex-state'));
    writeFileSync(path.join(root, '.riff-codex-state/config.json'), '{}');
    assert.deepEqual(JSON.parse(invoke(root, root)), {});
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('managed dispatcher runs the canonical hook and rejects unknown events', () => {
  const root = setup();
  try {
    execFileSync('/usr/bin/git', ['init', '-q', root]);
    const privateHome = path.join(root, 'home'); mkdirSync(privateHome);
    execFileSync(process.execPath, [path.join(framework, 'bin/riff.mjs'), 'init', '--project-root', root, '--non-interactive'], { cwd: root, env: { ...process.env, HOME: privateHome, CODEX_HOME: path.join(privateHome, '.codex') } });
    const result = JSON.parse(invoke(root, root));
    assert.match(result.hookSpecificOutput.additionalContext, /RIFF conversation language/);
    assert.throws(() => invoke(root, root, 'unknown-event'));
    assert.match(readFileSync(path.join(root, '.riff-codex-state/events.ndjson'), 'utf8'), /hook_session_start/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
