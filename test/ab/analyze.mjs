// Summarizes comparison runs from RIFF state, Git and the Claude stream, not from the agent's report.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Counted runs per arm before the report reads a difference. With four, only a perfect split between the
// arms would stand out from chance; five leaves room for one ordinary run in the middle.
export const MIN_RUNS = 5;

const lines = (file) => (existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean) : []);

// Writes the files of one Git revision into a folder, without any Git link back to the repository.
export function exportTree(repository, revision, destination, env) {
  mkdirSync(destination, { recursive: true });
  const archive = `${destination}.tar`;
  execFileSync('git', ['archive', '--format=tar', '-o', archive, revision], { cwd: repository, env });
  execFileSync('tar', ['-xf', archive, '-C', destination]);
  rmSync(archive);
}

export function analyzeRun({ dir, skill, base, env }) {
  const project = path.join(dir, 'project');
  const git = (...args) => execFileSync('git', args, { cwd: project, env, encoding: 'utf8' }).trim();
  const stream = lines(path.join(dir, 'stream.jsonl')).map((line) => { try { return JSON.parse(line); } catch { return {}; } });
  const result = stream.findLast((event) => event.type === 'result');
  const toolUses = stream.flatMap((event) => (event.type === 'assistant' ? event.message?.content ?? [] : [])).filter((item) => item.type === 'tool_use');

  // The committed outcome: the newest branch that moved, checked in its own folder so leftovers in the
  // working tree neither help nor hurt it.
  const tips = git('for-each-ref', '--sort=-committerdate', '--format=%(objectname) %(refname:short)', 'refs/heads').split('\n').map((tip) => tip.split(' '));
  const [commit, branch] = tips.find(([sha]) => sha !== base) ?? [base, null];
  const outcome = path.join(dir, 'outcome');
  exportTree(project, commit, outcome, env);
  const run = (command, args) => spawnSync(command, args, { cwd: outcome, env, encoding: 'utf8', timeout: 120000 });
  const changed = git('diff', '--name-only', base, commit).split('\n').filter(Boolean);

  const stateFile = path.join(project, '.riff-data', 'state.json');
  const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { phases: [] };
  const events = lines(path.join(project, '.riff-data', 'events.ndjson')).map((line) => JSON.parse(line));
  const count = (type, status) => events.filter((event) => event.type === type && (!status || event.status === status)).length;

  return {
    finished: Boolean(result) && !result.is_error && result.subtype === 'success',
    ending: result?.subtype ?? null,
    costUsd: typeof result?.total_cost_usd === 'number' ? result.total_cost_usd : null,
    turns: result?.num_turns ?? null,
    goalMet: skill === 'quick' ? quickGoal(run, outcome) : state.phases.length > 0 && state.phases.every((phase) => phase.status === 'completed'),
    testsPass: run('npm', ['test', '--silent']).status === 0,
    branch,
    commits: Number(git('rev-list', '--count', `${base}..${commit}`)),
    changedFiles: changed.join(' '),
    outOfScope: changed.filter((file) => file.startsWith('src/dates') || file === 'ROADMAP.yaml' || file === 'PROJECT.md').join(' ') || 'none',
    uncommitted: git('status', '--porcelain') || 'none',
    remotes: git('remote') || 'none',
    phases: state.phases.map((phase) => `${phase.id}:${phase.status}`).join(' '),
    validationsPass: count('validation', 'pass'),
    validationsFail: count('validation', 'fail'),
    functionalReviews: count('functional_review'),
    securityReviews: count('security_review'),
    checkpoints: count('phase_checkpoint'),
    improvementPasses: count('improvement_pass'),
    projectProposals: (state.improvements ?? []).length,
    riffIdeas: lines(path.join(dir, 'ideas.ndjson')).length,
    skillsUsed: toolUses.filter((use) => use.name === 'Skill').map((use) => use.input?.skill ?? '').join(' '),
    agents: toolUses.filter((use) => use.name === 'Agent' || use.name === 'Task').map((use) => (use.input?.description ?? '').slice(0, 40)).join(' | '),
    explainPost: explanations(project),
    endedWithQuestion: /\?\s*$/.test(String(result?.result ?? '').trim()),
  };
}

// The message the quick prompt asks for, read from the committed code.
function quickGoal(run, outcome) {
  const module = pathToFileURL(path.join(outcome, 'src', 'tasks.js')).href;
  const script = `const { createTaskList } = await import(${JSON.stringify(module)}); try { createTaskList().add('  '); } catch (error) { if (error.message === 'Task title is required') process.exit(0); } process.exit(1);`;
  return run(process.execPath, ['--input-type=module', '-e', script]).status === 0;
}

// Phases whose dashboard folder holds the post-completion explanation.
function explanations(project) {
  const dir = path.join(project, '.riff-data/dashboard/phases');
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((name) => existsSync(path.join(dir, name, 'EXPLAIN-POST.simple.md'))).length;
}

const METRICS = [['Cost (USD)', 'costUsd'], ['Minutes', 'minutes'], ['Turns', 'turns']];
const show = (value) => (typeof value === 'number' ? String(Number(value.toFixed(2))) : value === true ? 'yes' : value === false ? 'no' : value ?? '');
const cell = (value) => String(show(value)).replaceAll('|', '/').replaceAll('\n', ' ');
const table = (head, body) => [head, head.map(() => '---'), ...body].map((row) => `| ${row.map(cell).join(' | ')} |`).join('\n');

function spread(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return { n: sorted.length, min: sorted[0], median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, max: sorted.at(-1) };
}

export function renderReport({ skill, dry, runs, spentUsd, maxUsd, model, effort, arms, rows, stopped }) {
  const counted = (arm) => rows.filter((row) => row.arm === arm && row.counted);
  const spreads = METRICS.map(([label, key]) => [label, ...['old', 'new'].map((arm) => spread(counted(arm).map((row) => row[key]).filter((value) => typeof value === 'number')))]);
  const out = [
    `# Comparison on the ${skill} fixture`,
    '',
    ...(dry ? ['**Dry run: no model ran. The numbers below say nothing about the two revisions.**', ''] : []),
    ...(stopped ? [`**Stopped early: ${stopped}.**`, ''] : []),
    `- Old: \`${arms.old.ref}\` (${arms.old.commit.slice(0, 12)})`,
    `- New: \`${arms.new.ref}\` (${arms.new.commit.slice(0, 12)})`,
    ...(arms.old.commit === arms.new.commit ? ['- Both arms are the same revision: any difference is noise.'] : []),
    `- Model: ${dry ? 'none' : `${model}, effort ${effort}`}. Runs asked per arm: ${runs}.`,
    ...(dry ? [] : [`- Spent: $${spentUsd.toFixed(2)} of $${maxUsd.toFixed(2)} (a run whose cost is unknown counts for its whole share).`]),
    '',
    '## Each run',
    '',
    table(['Run', 'Counted', 'Goal met', 'Tests pass', 'Cost (USD)', 'Minutes', 'Turns', 'Commits', 'Out of scope', 'Note'],
      rows.map((row) => [row.run, row.counted, row.goalMet, row.testsPass, row.costUsd, row.minutes, row.turns, row.commits, row.outOfScope, row.note])),
    '',
    '## Spread of the counted runs',
    '',
    table(['Measure', 'Arm', 'Runs', 'Min', 'Median', 'Max'], spreads.flatMap(([label, before, after]) => [['old', before], ['new', after]].map(([arm, s]) => [label, arm, s.n, s.min, s.median, s.max]))),
    '',
    '## Reading',
    '',
  ];
  const enough = Math.min(counted('old').length, counted('new').length) >= MIN_RUNS;
  if (dry) {
    out.push('None: this was a dry run.');
  } else if (!enough) {
    out.push(`Not enough data: ${counted('old').length} counted old and ${counted('new').length} counted new, ${MIN_RUNS} of each needed. Read the runs one by one; don't conclude that one revision is better.`);
  } else {
    for (const arm of ['old', 'new']) out.push(`- Goal met, ${arm}: ${counted(arm).filter((row) => row.goalMet).length} of ${counted(arm).length}.`);
    for (const [label, before, after] of spreads) {
      if (!before.n || !after.n) out.push(`- ${label}: not recorded.`);
      else if (before.max < after.min || after.max < before.min) out.push(`- ${label}: the ranges are separate (median ${show(before.median)} to ${show(after.median)}).`);
      else out.push(`- ${label}: the ranges overlap, so this comparison shows no clear difference.`);
    }
  }
  const excluded = rows.filter((row) => !row.counted).length;
  if (excluded) out.push('', `${excluded} of ${rows.length} runs not counted. Their cost and time are outside the spread, so an arm that fails or runs out of budget can look better than it is: read the notes.`);
  return `${out.join('\n')}\n`;
}
