// Summarizes each comparison run from RIFF state, Git and the Claude stream, not from the agent's report.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const runs = path.join(path.dirname(new URL(import.meta.url).pathname), 'runs');
const sh = (cwd, cmd, args) => { try { return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (e) { return `ERR ${String(e.stdout || '').slice(-200)}`; } };
const rows = [];
for (const name of readdirSync(runs).sort()) {
  const dir = path.join(runs, name);
  const project = path.join(dir, 'project');
  const lines = existsSync(path.join(dir, 'stream.jsonl')) ? readFileSync(path.join(dir, 'stream.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } }) : [];
  const result = lines.findLast((e) => e.type === 'result') ?? {};
  const toolUses = lines.flatMap((e) => (e.type === 'assistant' ? e.message?.content ?? [] : [])).filter((c) => c.type === 'tool_use');
  const agents = toolUses.filter((t) => t.name === 'Agent' || t.name === 'Task').map((t) => (t.input?.description ?? '').slice(0, 40));
  const stateFile = path.join(project, '.riff-data', 'state.json');
  const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { phases: [] };
  const eventsFile = path.join(project, '.riff-data', 'events.ndjson');
  const events = existsSync(eventsFile) ? readFileSync(eventsFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const count = (type, filter = () => true) => events.filter((e) => e.type === type && filter(e)).length;
  const base = existsSync(path.join(dir, 'base.txt')) ? readFileSync(path.join(dir, 'base.txt'), 'utf8').trim() : 'HEAD';
  const changed = sh(project, 'git', ['diff', '--name-only', base, 'HEAD']).split('\n').filter(Boolean);
  const dirty = sh(project, 'git', ['status', '--porcelain']).split('\n').filter(Boolean);
  const ideas = existsSync(path.join(dir, 'ideas.ndjson')) ? readFileSync(path.join(dir, 'ideas.ndjson'), 'utf8').split('\n').filter(Boolean).length : 0;
  const tests = sh(project, 'npm', ['test', '--silent']).match(/# fail (\d+)/)?.[1];
  rows.push({
    run: name,
    finished: Boolean(result.type),
    minutes: existsSync(path.join(dir, 'seconds.txt')) ? Math.round(Number(readFileSync(path.join(dir, 'seconds.txt'), 'utf8')) / 60) : null,
    turns: result.num_turns ?? null,
    costUsd: result.total_cost_usd ? Number(result.total_cost_usd.toFixed(2)) : null,
    phases: state.phases.map((p) => `${p.id}:${p.status}`).join(' '),
    validationsPass: count('validation', (e) => e.status === 'pass'),
    validationsFail: count('validation', (e) => e.status === 'fail'),
    functionalReviews: count('functional_review'),
    securityReviews: count('security_review'),
    checkpoints: count('phase_checkpoint'),
    improvementPasses: count('improvement_pass'),
    projectProposals: (state.improvements ?? []).length,
    riffIdeas: ideas,
    reviewerAgents: agents.join(' | '),
    commits: Number(sh(project, 'git', ['rev-list', '--count', `${base}..HEAD`])) || 0,
    changedFiles: changed.join(' '),
    outOfScope: changed.filter((f) => f.startsWith('src/dates') || f === 'ROADMAP.yaml' || f === 'PROJECT.md').join(' ') || 'none',
    uncommitted: dirty.join(' ') || 'none',
    testsFailing: tests ?? 'unknown',
    explainPost: existsSync(path.join(project, 'EXPLAIN-POST.simple.md')),
    endedWithQuestion: /\?\s*$/.test(String(result.result ?? '').trim()),
    isError: result.is_error ?? null,
  });
}
console.log(JSON.stringify(rows, null, 2));
