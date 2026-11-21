import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RIFF_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const AGENTS_DIR = path.join(RIFF_ROOT, 'agents');
const READ_ONLY_TOOLS = 'Read, Grep, Glob';

// One Claude Code subagent per Anthropic catalog profile, so a dispatch profile becomes a
// native launch with the profile's exact model and effort.
export function claudeAgents(catalog) {
  return catalog.profiles.filter((profile) => profile.provider === 'anthropic').map((profile) => {
    const name = profile.id.replaceAll('_', '-');
    const firstSentence = profile.usage.split(/(?<=\.)\s/)[0];
    const readOnly = profile.readOnly === true;
    const effort = profile.effort && profile.effort !== 'none' ? profile.effort : null;
    const frontmatter = [
      `name: ${name}`,
      `description: RIFF worker for catalog profile ${profile.id} (${profile.model}${effort ? `, ${effort} effort` : ''}${readOnly ? ', read-only' : ''}). ${firstSentence} Use when a RIFF dispatch names this profile.`,
      `model: ${profile.model}`,
      ...(effort ? [`effort: ${effort}`] : []),
      ...(readOnly ? [`tools: ${READ_ONLY_TOOLS}`] : []),
    ];
    const body = [
      'You run one bounded package that a parent agent, usually the main RIFF agent, handed you.',
      '',
      '- When instructions conflict, follow this order: the owner\'s own instructions (their messages and personal CLAUDE.md or AGENTS.md), then the repository\'s rules, then your brief, then this profile, then a RIFF skill.',
      '- Do exactly the package in your brief: its goal, the files you own and how to verify it.',
      '- Run the checks the brief names and report their real output.',
      ...(readOnly ? [] : ['- Work in the worktree and branch your brief names, and commit your package there, on your own branch. Never commit to, merge into or push the integration or default branch: the parent merges your branch. Return a patch instead only when the brief says not to commit.']),
      '- Never run RIFF commands that change project state (`riff init`, `riff resync`, `riff wave`, `riff improve`, `riff observations review`, `riff discovery review`, `riff incident log`, `riff finish`): list the ones your package needs in your report and the main agent runs them.',
      readOnly ? '- Report what you found, with the sources and checks behind it, and anything left unresolved.' : '- Report what changed, the files touched, your branch and commits, the checks and their results, and anything left unresolved.',
    ];
    if (readOnly) body.splice(2, 0, '- You only read: never modify files.');
    return { file: `${name}.md`, content: `---\n${frontmatter.join('\n')}\n---\n\n${body.join('\n')}\n` };
  });
}

export function writeClaudeAgents(catalog, directory = AGENTS_DIR) {
  const agents = claudeAgents(catalog);
  mkdirSync(directory, { recursive: true });
  const wanted = new Set(agents.map((agent) => agent.file));
  for (const file of readdirSync(directory)) if (file.endsWith('.md') && !wanted.has(file)) rmSync(path.join(directory, file));
  for (const agent of agents) writeFileSync(path.join(directory, agent.file), agent.content);
  return agents.map((agent) => agent.file);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = JSON.parse(readFileSync(path.join(RIFF_ROOT, 'references', 'model-profiles.json'), 'utf8'));
  process.stdout.write(`${writeClaudeAgents(catalog).join('\n')}\n`);
}
