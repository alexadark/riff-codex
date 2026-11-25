// What a comparison run may see: no user settings, no credentials beyond the model's own, no Git transport.
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const KEPT = ['PATH', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TERM', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS'];
const MODEL_AUTH = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CONFIG_DIR'];
export const TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Agent', 'Skill', 'TodoWrite'];
const DENIED = ['Bash(git push:*)', 'Bash(gh:*)', 'Bash(npm publish:*)', 'Bash(claude:*)', 'Bash(codex:*)', 'Bash(opencode:*)'];

const pick = (names) => Object.fromEntries(names.filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

// The home folder the project's commands get, with a neutral Git identity.
export function makeHome(dir) {
  const home = path.join(dir, 'home');
  mkdirSync(home, { recursive: true });
  mkdirSync(path.join(dir, 'tmp'));
  writeFileSync(path.join(home, '.gitconfig'), '[user]\n\tname = RIFF eval\n\temail = eval@example.invalid\n[init]\n\tdefaultBranch = main\n');
  // Claude Code runs every tool command and hook through this prefix: they get the scratch home, not the
  // real one, and never the model's credentials.
  const prefix = path.join(dir, 'tool-shell.sh');
  writeFileSync(prefix, `#!/bin/sh\nunset ${MODEL_AUTH.join(' ')}\nHOME=${quote(home)}\nexport HOME\nexec bash -c "$*"\n`);
  chmodSync(prefix, 0o755);
  return { home, prefix };
}

// Environment of every command run for a project: RIFF, Git, npm, and through the prefix the agent's tools.
export function commandEnv(dir, home) {
  const disabled = path.join(home, 'reviewer-disabled');
  return {
    ...pick(KEPT),
    HOME: home,
    TMPDIR: path.join(dir, 'tmp'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: path.join(home, '.gitconfig'),
    GIT_TERMINAL_PROMPT: '0',
    GIT_ALLOW_PROTOCOL: 'none',
    GH_TOKEN: 'disabled',
    GITHUB_TOKEN: 'disabled',
    GH_CONFIG_DIR: path.join(home, 'gh'),
    RIFF_IDEAS_FILE: path.join(dir, 'ideas.ndjson'),
    // External reviewers are paid outside the spending limit.
    RIFF_REVIEW_CODEX_BIN: disabled,
    RIFF_REVIEW_OPENCODE_BIN: disabled,
    RIFF_REVIEW_CLAUDE_BIN: disabled,
  };
}

// The model process keeps the real home, only to find its own login.
export function modelEnv(dir, { home, prefix }) {
  return {
    ...commandEnv(dir, home),
    ...pick([...MODEL_AUTH, 'HOME']),
    SHELL: '/bin/bash',
    CLAUDE_CODE_SHELL_PREFIX: prefix,
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
    DISABLE_AUTOUPDATER: '1',
  };
}

export function modelArgs({ prompt, model, effort, pluginDir, capUsd }) {
  return ['-p', prompt, '--model', model, '--effort', effort,
    '--setting-sources', 'project,local', '--strict-mcp-config', '--plugin-dir', pluginDir, '--no-chrome',
    '--permission-mode', 'acceptEdits', '--allowedTools', TOOLS.join(' '), '--disallowedTools', ...DENIED,
    ...(capUsd === null ? [] : ['--max-budget-usd', String(capUsd)]),
    '--output-format', 'stream-json', '--verbose', '--no-session-persistence'];
}

// Reads the first event of a Claude Code stream: what the session really loaded. Null when isolated.
export function isolationProblem(init, pluginDir) {
  const problems = [];
  const servers = (init.mcp_servers ?? []).map((server) => server.name);
  if (servers.length) problems.push(`MCP servers ${servers.join(', ')}`);
  const plugins = (init.plugins ?? []).filter((plugin) => plugin.path !== 'builtin');
  const foreign = plugins.filter((plugin) => plugin.path !== pluginDir).map((plugin) => plugin.name);
  if (foreign.length) problems.push(`plugins ${foreign.join(', ')}`);
  if (!plugins.some((plugin) => plugin.path === pluginDir)) problems.push('the RIFF skills of this arm are missing');
  return problems.length ? problems.join('; ') : null;
}
