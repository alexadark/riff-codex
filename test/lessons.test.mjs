import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'riff', 'bin', 'riff.mjs');
const roots = [];
test.after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const write = (root, file, value) => {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
};
const read = (root, file) => readFileSync(path.join(root, file), 'utf8');
const state = (root) => JSON.parse(read(root, '.riff-data/state.json'));
const git = (root, ...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
function riff(root, ...args) {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, HOME: path.join(root, '.home'), CODEX_HOME: path.join(root, '.home', '.codex'), RIFF_IDEAS_FILE: path.join(root, '.home', 'ideas.ndjson') } });
  return { status: result.status, text: `${result.stdout}${result.stderr}` };
}
function ok(root, ...args) {
  const result = riff(root, ...args);
  assert.equal(result.status, 0, result.text);
  return result.text;
}
function refused(root, pattern, ...args) {
  const result = riff(root, ...args);
  assert.notEqual(result.status, 0, `expected a refusal: ${result.text}`);
  assert.match(result.text, pattern);
  return result.text;
}
const record = (root, lesson) => { write(root, '.riff-data/lesson.json', lesson); return ['lesson', 'record', '--file', '.riff-data/lesson.json']; };

const LEGACY = '# Taste\n\n## Old rule\n\n- **When:** always.\n- **Rule and reason:** keep it.\n- **Evidence:** `README.md`.\n';
const CHECK = ['node', 'test/total.check.mjs'];
// The committed code holds the bug; the staged candidate holds the fix and the check.
function fixture({ init = true, phases = ['a'] } = {}) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'riff-lessons-')));
  roots.push(root);
  git(root, 'init', '-q');
  write(root, '.gitignore', '.riff-cli\n.riff-data/\n.riff-codex\n.riff-codex-state\n.agents/\n.claude/\n.codex/\n.home/\n.uxtest/\n');
  write(root, 'ROADMAP.yaml', { version: 1, project: { name: 'Fixture' }, phases: phases.map((id, index) => ({ id, title: id, outcome: 'Visible result', priority: 'P2', depends_on: index ? [phases[index - 1]] : [] })) });
  write(root, 'taste.md', LEGACY);
  write(root, 'src/total.mjs', 'export const total = (items) => items.reduce((sum, item) => sum + item);\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'Baseline with the bug');
  if (init) { ok(root, 'init', '--project-root', root, '--non-interactive'); ok(root, 'wave', 'sync'); }
  write(root, 'src/total.mjs', 'export const total = (items) => items.reduce((sum, item) => sum + item, 0);\n');
  write(root, 'test/total.check.mjs', "import { total } from '../src/total.mjs';\nif (total([]) !== 0) throw new Error('wrong total');\n");
  write(root, 'test/blind.check.mjs', "import { total } from '../src/total.mjs';\nif (total([1]) !== 1) throw new Error('wrong total');\n");
  git(root, 'add', '--', 'src', 'test');
  return root;
}
const LESSON = { title: 'Empty list totals', when: 'Reducing a list that can be empty.', rule: 'Give reduce an initial value: an empty cart crashed.', evidence: 'src/total.mjs, first crash' };
const PASSED = { architecture: 'the helper is already the single owner', types: 'an empty array has the same type', lint_or_ci: 'no linter runs in this project' };
const proven = (extra = {}) => ({ rung: 'test', file: 'test/total.check.mjs', check: CHECK, evidence: { shows: 'Reduce of empty array' }, ...extra });

test('a repeated failure is refused as a plain lesson until a check that catches it, or why none can, is recorded', () => {
  const root = fixture();
  ok(root, ...record(root, LESSON));
  const topic = 'taste/lessons.md';
  assert.match(read(root, topic), /## Empty list totals\n[\s\S]*seen: 1\n/);
  const before = read(root, topic);
  const again = { title: 'empty list  totals', evidence: 'src/total.mjs, second crash' };
  const reject = (pattern, extra) => { refused(root, pattern, ...record(root, { ...again, ...extra })); assert.equal(read(root, topic), before); };
  reject(/seen 2 times.*architecture, types, lint_or_ci, test/s);
  reject(/none.*reason/s, { enforced_by: { none: '' }, passed_over: { ...PASSED, test: 'needs the live payment provider' } });
  reject(/passed_over\.test/, { enforced_by: { none: 'only the live payment provider shows it' }, passed_over: PASSED });
  reject(/passed_over\.types/, { enforced_by: proven(), passed_over: { ...PASSED, types: '' } });
  reject(/evidence/, { enforced_by: proven({ evidence: undefined }), passed_over: PASSED });
  reject(/passes on the code before the fix/, { enforced_by: proven({ file: 'test/blind.check.mjs', check: ['node', 'test/blind.check.mjs'] }), passed_over: PASSED });
  reject(/did not run/, { enforced_by: proven({ check: ['no-such-command-anywhere'] }), passed_over: PASSED });
  reject(/does not show/, { enforced_by: proven({ evidence: { shows: 'some other error' } }), passed_over: PASSED });
  reject(/fails on the candidate/, { enforced_by: proven({ check: ['node', 'test/missing.check.mjs'], evidence: { shows: 'Cannot find module' } }), passed_over: PASSED });
  ok(root, ...record(root, { ...again, enforced_by: proven(), passed_over: PASSED }));
  const entry = JSON.parse(ok(root, 'lesson', 'list')).find((item) => item.title === LESSON.title);
  assert.equal(entry.seen, 2);
  assert.equal(entry.enforced_by.file, 'test/total.check.mjs');
  assert.equal(entry.enforced_by.evidence.before, git(root, 'rev-parse', 'HEAD'));
  assert.match(read(root, topic), /second crash/);
  // A lesson written before these fields keeps its text and counts as seen once.
  assert.equal(read(root, 'taste.md'), LEGACY);
  refused(root, /seen 2 times/, ...record(root, { title: 'Old rule', evidence: 'seen again' }));
  ok(root, ...record(root, { title: 'Old rule', evidence: 'seen again', enforced_by: { none: 'only a person can judge it' }, passed_over: { ...PASSED, test: 'nothing observable to assert' } }));
  assert.ok(read(root, 'taste.md').startsWith(LEGACY.trimEnd()));
});

test('validation and commits refuse a hand-written lesson that skips the ladder or carries an untrue check', () => {
  const root = fixture();
  const validate = ['wave', 'validate', 'a', '--run', '--command', '["node","-e","0"]', '--paths', '["src","test","taste","taste.md"]'];
  const lesson = (block) => { write(root, 'taste/lessons.md', `# Lessons\n\n## Empty list totals\n\n\`\`\`yaml riff-lesson\n${JSON.stringify(block)}\n\`\`\`\n`); git(root, 'add', '--', 'taste'); };
  ok(root, 'wave', 'activate', 'a');
  ok(root, ...validate);
  lesson({ seen: 2 });
  refused(root, /Empty list totals.*seen 2 times/s, ...validate);
  assert.throws(() => git(root, 'commit', '-qm', 'Plain repeated lesson'), /Empty list totals.*seen 2 times/s);
  const head = git(root, 'rev-parse', 'HEAD');
  const blind = { seen: 2, passed_over: PASSED, enforced_by: proven({ file: 'test/blind.check.mjs', check: ['node', 'test/blind.check.mjs'], evidence: { before: head, shows: 'Reduce of empty array' } }) };
  lesson(blind);
  refused(root, /passes on the code before the fix/, ...validate);
  lesson({ ...blind, enforced_by: proven({ evidence: { before: head, shows: 'Reduce of empty array' } }) });
  ok(root, ...validate);
  assert.match(JSON.stringify(state(root).phases[0].validation.lessons), /Empty list totals/);
  git(root, 'commit', '-qm', 'Enforced lesson', '--no-verify');
  // The count of a recorded lesson cannot be walked back by hand.
  lesson({ seen: 1 });
  refused(root, /seen.*2.*1/s, 'lesson', 'check');
});

test('a fix records that its regression check fails before it, or why that cannot be shown', () => {
  const root = fixture();
  ok(root, 'wave', 'activate', 'a');
  const prove = (...extra) => ['lesson', 'prove', '--file', 'test/total.check.mjs', '--check', JSON.stringify(CHECK), ...extra];
  refused(root, /--shows is required/, ...prove());
  refused(root, /passes on the code before the fix/, 'lesson', 'prove', '--file', 'test/blind.check.mjs', '--check', '["node","test/blind.check.mjs"]', '--shows', 'Reduce');
  assert.match(ok(root, ...prove('--shows', 'Reduce of empty array')), /fails on [0-9a-f]{12}.*passes on the candidate/s);
  refused(root, /reason/, 'lesson', 'prove', '--cannot', 'no');
  ok(root, 'lesson', 'prove', '--file', 'test/total.check.mjs', '--cannot', 'the old code needs a retired payment sandbox');
  assert.deepEqual(state(root).phases[0].regressions.map((entry) => [entry.file, Boolean(entry.before), entry.cannot ?? null]), [['test/total.check.mjs', true, null], ['test/total.check.mjs', false, 'the old code needs a retired payment sandbox']]);
  assert.equal(git(root, 'status', '--porcelain', '--', 'src', 'test').includes('??'), false);
  // Without RIFF state the proof still runs and leaves nothing behind.
  const bare = fixture({ init: false });
  ok(bare, ...prove('--shows', 'Reduce of empty array'));
  assert.equal(existsSync(path.join(bare, '.riff-data')), false);
});

test('the last phase of a version cannot complete without its improvement pass, earlier phases can', () => {
  const root = fixture({ phases: ['a', 'b'] });
  const deliver = (id) => {
    ok(root, 'wave', 'activate', id);
    write(root, 'README.md', `${id}\n`);
    git(root, 'add', '--', 'README.md');
    ok(root, 'wave', 'validate', id, '--run', '--command', '["node","-e","0"]', '--paths', '["README.md","src","test"]');
    write(root, '.riff-data/review.json', { version: 1, candidate: git(root, 'write-tree'), type: 'functional', status: 'pass', reviewedBy: 'native-subagent', fallbackReason: 'test fixture', reviewer: { id: 'fresh', independent: true }, evidence: ['README.md:1'], findings: [] });
    ok(root, 'wave', 'review', id, '--type', 'functional', '--status', 'pass', '--summary', 'Works', '--evidence', '.riff-data/review.json');
    git(root, 'commit', '-qm', `Phase ${id}`);
  };
  deliver('a');
  ok(root, 'wave', 'complete', 'a', '--commit', 'HEAD');
  deliver('b');
  refused(root, /improve record --phase b/, 'wave', 'complete', 'b', '--commit', 'HEAD');
  write(root, '.riff-data/pass.json', []);
  ok(root, 'improve', 'record', '--phase', 'b', '--file', '.riff-data/pass.json');
  ok(root, 'wave', 'complete', 'b', '--commit', 'HEAD');
});
