// Stand-in for the Claude CLI in dry mode: the same arguments and stream, a fixed edit, no model call.
// It records what it was given (probe.json) and tries a push, which must fail.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const pluginDir = argv[argv.indexOf('--plugin-dir') + 1];
const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
// Tool commands go through the prefix, as Claude Code does.
const tool = (command) => spawnSync(process.env.CLAUDE_CODE_SHELL_PREFIX, [command], { encoding: 'utf8' });

const servers = process.env.AB_STAND_IN_MCP ? [{ name: process.env.AB_STAND_IN_MCP }] : [];
emit({ type: 'system', subtype: 'init', mcp_servers: servers, plugins: [{ name: 'riff', path: pluginDir }] });
// Like a model, take longer than the harness needs to stop a session that isn't isolated.
if (servers.length) await new Promise((resolve) => { setTimeout(resolve, 60000); });

tool('git checkout -q -b riff/title-error');
const file = path.join('src', 'tasks.js');
writeFileSync(file, readFileSync(file, 'utf8').replace("'title is required'", "'Task title is required'"));
const commit = tool("git commit -qam 'Say which title is required'");
tool('git init -q --bare ../push-target.git');
writeFileSync(path.join('..', 'probe.json'), JSON.stringify({
  argv,
  envKeys: Object.keys(process.env).sort(),
  toolHome: tool('printf %s "$HOME"').stdout,
  skillSha: createHash('sha256').update(readFileSync(path.join(pluginDir, 'skills', 'quick', 'SKILL.md'))).digest('hex'),
  commitError: commit.status === 0 ? null : commit.stderr,
  pushStatus: tool('git push -q ../push-target.git HEAD:main').status,
}, null, 2));
emit({ type: 'result', subtype: 'success', is_error: false, num_turns: 1, total_cost_usd: Number(process.env.AB_STAND_IN_COST ?? 0), result: 'Stand-in edit committed.' });
