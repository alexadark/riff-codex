import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { titleKey } from './improvements.mjs';
import { localPath } from './safety.mjs';

// A lesson is a heading of taste.md or taste/*.md. Its optional `yaml riff-lesson` block holds how often the
// error was seen and what enforces the rule; a heading without a block is an older lesson, seen once.
// The strongest rung comes first. Taste alone (`none`) is the last one.
const RUNGS = ['architecture', 'types', 'lint_or_ci', 'test'];
const REASON_LENGTH = 10;
const NO_HEADING = '(no heading)';
const DEFAULT_TOPIC = 'taste/lessons.md';
// Installed dependencies are not in Git: both exported trees of a proof borrow the project's.
const DEPENDENCY_FOLDERS = ['node_modules', '.venv', 'vendor'];
const SECRET = /\b(?:sk-proj-|(?:sk|rk)_live_|gh[pousr]_)[A-Za-z0-9_-]+\b/g;

const isReason = (value) => typeof value === 'string' && value.trim().length >= REASON_LENGTH;
const isText = (value) => typeof value === 'string' && Boolean(value.trim()) && !value.includes('\0');
const isArgv = (value) => Array.isArray(value) && value.length > 0 && value.every((arg) => typeof arg === 'string' && arg && !arg.includes('\0'));
const isProjectFile = (value) => isText(value) && !path.isAbsolute(value) && !value.split(/[\\/]/).some((part) => part === '..' || part === '.git');
const oneLine = (value) => String(value).replace(/\s+/g, ' ').trim();

function parseLessons(text, file) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let section = null;
  let fence = null;
  lines.forEach((line, index) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})\s*(.*)$/);
    if (fence) {
      if (!marker || marker[1][0] !== fence.mark[0] || marker[1].length < fence.mark.length || marker[2].trim()) return;
      if (fence.lesson) {
        const block = { start: fence.start, end: index };
        try { block.data = YAML.parse(lines.slice(fence.start + 1, index).join('\n')); } catch (error) { block.error = `invalid YAML: ${error.message.split('\n')[0]}`; }
        if (section.title === NO_HEADING) block.error = 'the riff-lesson block needs a heading of its own (## or lower)';
        if (section.block) section.block.error = 'holds two riff-lesson blocks';
        else section.block = block;
      }
      fence = null;
      return;
    }
    if (marker) {
      const lesson = /\briff-lesson\b/.test(marker[2]);
      fence = { mark: marker[1], lesson, start: index };
      if (lesson && !section) { section = { title: NO_HEADING, file, start: index, end: lines.length, block: null }; sections.push(section); }
      return;
    }
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!heading) return;
    if (section) section.end = index;
    section = line.startsWith('# ') ? null : { title: heading[1], file, start: index, end: lines.length, block: null };
    if (section) sections.push(section);
  });
  if (fence?.lesson) section.block = { start: fence.start, end: lines.length - 1, error: 'has an unclosed riff-lesson block' };
  return sections;
}

const seenOf = (section) => (Number.isInteger(section.block?.data?.seen) ? section.block.data.seen : 1);

// Why a lesson's recorded fields are refused, or null. Whether its check really catches the error is proveCheck's job.
function lessonProblem(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'the riff-lesson block must be a mapping with seen and enforced_by';
  if (!Number.isInteger(data.seen) || data.seen < 1) return 'seen must be a whole number, 1 or more';
  const enforced = data.enforced_by;
  if (enforced === undefined || enforced === null) {
    if (data.seen === 1) return null;
    return `this error was seen ${data.seen} times, so a plain lesson is refused. Stop it with the strongest check that can: ${RUNGS.join(', ')}, in that order (enforced_by: rung, file, check, evidence); taste alone is the last resort (enforced_by.none with the reason). Say in passed_over why each stronger rung was passed over`;
  }
  if (typeof enforced !== 'object' || Array.isArray(enforced)) return 'enforced_by must name a rung with its file, check and evidence, or none with a reason';
  const last = Object.hasOwn(enforced, 'none');
  if (last) {
    if (['rung', 'file', 'check', 'evidence'].some((field) => enforced[field] !== undefined)) return 'enforced_by holds a check or none, not both';
    if (!isReason(enforced.none)) return `enforced_by.none needs the reason no check can catch this error (at least ${REASON_LENGTH} characters)`;
  } else {
    if (!RUNGS.includes(enforced.rung)) return `enforced_by.rung must be one of ${RUNGS.join(', ')}; use none with a reason when no check can catch the error`;
    if (!isProjectFile(enforced.file)) return 'enforced_by.file must be the project-relative file that holds the check';
    if (!isArgv(enforced.check)) return 'enforced_by.check must be the command as an argv array, run without a shell';
    const evidence = enforced.evidence;
    const shown = isText(evidence?.before) && isText(evidence?.shows);
    if (!shown && !isReason(evidence?.cannot)) return `a check needs its evidence: evidence.before (the commit that holds the error) and evidence.shows (the failure text seen there), or evidence.cannot with the reason it can't be shown (at least ${REASON_LENGTH} characters)`;
  }
  if (data.seen === 1) return null;
  const stronger = last ? RUNGS : RUNGS.slice(0, RUNGS.indexOf(enforced.rung));
  const missing = stronger.find((rung) => !isReason(data.passed_over?.[rung]));
  return missing ? `passed_over.${missing} must say why this stronger rung was passed over (at least ${REASON_LENGTH} characters)` : null;
}

const isTasteFile = (file) => file === 'taste.md' || /^taste\/(?:.+\/)?[^/]+\.md$/.test(file);

function treeLessons(root, tree) {
  const listed = execFileSync('git', ['ls-tree', '-r', '-z', tree, '--', 'taste.md', 'taste'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  return listed.flatMap((entry) => {
    const [, mode, object, file] = entry.match(/^(\d+) \w+ ([0-9a-f]+)\t([\s\S]+)$/) ?? [];
    // A symlink points at a shared, read-only source.
    if (!/^100/.test(mode ?? '') || !isTasteFile(file)) return [];
    return parseLessons(execFileSync('git', ['cat-file', 'blob', object], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }), file);
  });
}

export function projectLessons(root) {
  const files = [];
  const visit = (relative) => {
    let stat;
    try { stat = lstatSync(path.join(root, relative)); } catch { return; }
    if (stat.isDirectory()) readdirSync(path.join(root, relative)).sort().forEach((name) => visit(`${relative}/${name}`));
    else if (stat.isFile() && isTasteFile(relative)) files.push(relative);
  };
  ['taste.md', 'taste'].forEach(visit);
  return files.flatMap((file) => parseLessons(readFileSync(path.join(root, file), 'utf8'), file));
}

export function lessonSummary(section) {
  return { title: section.title, file: section.file, seen: seenOf(section), enforced_by: section.block?.data?.enforced_by ?? null };
}

// A recorded lesson names a commit, not a moving reference such as HEAD.
function unresolvedBefore(data) {
  const before = data.enforced_by?.evidence?.before;
  return before !== undefined && !/^[0-9a-f]{40,64}$/.test(before) ? 'enforced_by.evidence.before must be a full commit id' : null;
}

// Lessons the candidate adds or changes since base. Untouched ones are never judged again.
function changedLessons(root, base, candidate) {
  if (spawnSync('git', ['diff', '--quiet', base, candidate, '--', 'taste.md', 'taste'], { cwd: root }).status === 0) return [];
  const before = treeLessons(root, base);
  const after = treeLessons(root, candidate);
  // Same title in two topics: the highest count is the one that must not go down.
  const alike = (sections, section) => sections.filter((item) => item.block && titleKey(item.title) === titleKey(section.title));
  const highest = (sections) => Math.max(0, ...sections.map(seenOf));
  return after.flatMap((section) => {
    const same = alike(before, section);
    const was = highest(same);
    const is = highest(alike(after, section));
    const lowered = was > is ? `seen went from ${was} to ${is || 'nothing'}; the count of a recorded lesson never goes down` : null;
    if (!section.block) return lowered ? [{ ...section, problem: lowered }] : [];
    if (!section.block.error && same.some((item) => JSON.stringify(item.block.data) === JSON.stringify(section.block.data))) return [];
    return [{ ...section, problem: section.block.error ?? lowered ?? lessonProblem(section.block.data) ?? unresolvedBefore(section.block.data) }];
  });
}

// Refuses changed lessons that skip the ladder; with `run`, also runs their checks before and after the fix.
export function requireLessons(root, base, candidate, { run = false, timeoutSeconds } = {}) {
  const changed = changedLessons(root, base, candidate);
  const refused = changed.filter((section) => section.problem);
  if (refused.length) throw new Error(refused.map((section) => `lesson "${section.title}" (${section.file}): ${section.problem}`).join('\n'));
  return changed.map((section) => {
    const enforced = section.block.data.enforced_by;
    const summary = { title: section.title, file: section.file, seen: section.block.data.seen, enforced_by: enforced ?? null };
    if (!run || !enforced?.check || enforced.evidence.cannot) return summary;
    try { return { ...summary, proof: proveCheck(root, { candidate, file: enforced.file, check: enforced.check, before: enforced.evidence.before, shows: enforced.evidence.shows, timeoutSeconds }) }; }
    catch (error) { throw new Error(`lesson "${section.title}" (${section.file}): ${error.message}`); }
  });
}

function exportTree(root, tree, directory) {
  mkdirSync(directory, { recursive: true });
  const env = { ...process.env, GIT_INDEX_FILE: `${directory}.index` };
  execFileSync('git', ['read-tree', tree], { cwd: root, env, stdio: 'pipe' });
  execFileSync('git', ['checkout-index', '-a', '-f', `--prefix=${directory}/`], { cwd: root, env, stdio: 'pipe' });
  for (const name of DEPENDENCY_FOLDERS) {
    if (existsSync(path.join(root, name)) && !existsSync(path.join(directory, name))) symlinkSync(path.join(root, name), path.join(directory, name));
  }
}

// Runs the candidate's check on the code before the fix, where it must fail and show the error, then on the
// candidate, where it must pass. Both run in exported trees set up the same way, so a missing dependency
// fails both and proves nothing.
export function proveCheck(root, { candidate, before = 'HEAD', file, check, shows, timeoutSeconds = 60 }) {
  if (!isProjectFile(file)) throw new Error('the check file must be project-relative');
  if (!isArgv(check)) throw new Error('the check must be an argv array');
  if (!isText(shows)) throw new Error('say which failure text shows the error on the code before the fix');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  let commit;
  try { commit = git('rev-parse', '--verify', '--quiet', '--end-of-options', `${before}^{commit}`); } catch { throw new Error(`the code before the fix is not a commit of this repository: ${before}`); }
  let blob;
  try { blob = execFileSync('git', ['cat-file', 'blob', `${candidate}:${file}`], { cwd: root, stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 }); } catch { throw new Error(`${file} is not in the staged candidate; stage the fix and its check first`); }
  const scratch = realpathSync(mkdtempSync(path.join(tmpdir(), 'riff-proof-')));
  const observe = (name, tree) => {
    const directory = path.join(scratch, name);
    exportTree(root, tree, directory);
    const target = localPath(directory, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, blob);
    const result = spawnSync(check[0], check.slice(1), { cwd: directory, encoding: 'utf8', timeout: timeoutSeconds * 1000, maxBuffer: 8 * 1024 * 1024 });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.replaceAll(directory, '.').replace(SECRET, '[REDACTED]');
    const label = name === 'before' ? `the code before the fix (${commit.slice(0, 12)})` : 'the candidate';
    if (result.error?.code === 'ETIMEDOUT') throw new Error(`the check exceeded ${timeoutSeconds} s on ${label}; raise validation.runTimeoutSeconds or --timeout-seconds`);
    if (result.error || result.status === null || [126, 127].includes(result.status)) throw new Error(`the check did not run on ${label}: ${result.error?.message ?? result.signal ?? `exit ${result.status}`}`);
    return { status: result.status, output: output.trim() };
  };
  const tail = (text) => (text.length > 800 ? `…${text.slice(-800)}` : text || '(no output)');
  try {
    const old = observe('before', commit);
    if (old.status === 0) throw new Error(`the check passes on the code before the fix (${commit.slice(0, 12)}), so it does not catch the error. Name the commit that holds it (before), or correct the check`);
    if (!old.output.includes(shows)) throw new Error(`the check fails on the code before the fix but does not show "${shows}". Its output:\n${tail(old.output)}`);
    const fixed = observe('candidate', candidate);
    if (fixed.status !== 0) throw new Error(`the check fails on the candidate:\n${tail(fixed.output)}`);
    return { file, check, before: commit, shows, candidate, output: tail(old.output) };
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

function renderBlock(data) {
  // Quoted values keep line breaks escaped, so no value can close the fence or add a heading.
  return `\`\`\`yaml riff-lesson\n${YAML.stringify(data, { defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN', lineWidth: 0 })}\`\`\``;
}

// What recording this lesson would write, or a refusal. Nothing is written here.
export function planLesson(root, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('the lesson file must be a JSON object');
  for (const field of ['title', 'evidence']) if (!isText(input[field])) throw new Error(`lesson ${field} is required`);
  const key = titleKey(input.title);
  if (!key) throw new Error('lesson title needs letters or digits');
  const alike = projectLessons(root).filter((section) => titleKey(section.title) === key);
  // Common headings repeat across topics: a recorded lesson wins over a plain heading, then the named topic.
  const recorded = alike.filter((section) => section.block);
  const named = recorded.length ? recorded : alike.filter((section) => !input.topic || section.file === input.topic);
  const matches = named.length > 1 && input.topic ? named.filter((section) => section.file === input.topic) : named;
  if (matches.length > 1) throw new Error(`several lessons are titled "${input.title}" (${matches.map((section) => section.file).join(', ')}); name the topic, or merge them`);
  const existing = matches[0] ?? null;
  if (existing?.block?.error) throw new Error(`lesson "${existing.title}" (${existing.file}) ${existing.block.error}`);
  const topic = existing?.file ?? input.topic ?? DEFAULT_TOPIC;
  if (!isProjectFile(topic) || !isTasteFile(topic)) throw new Error('lesson topic must be taste.md or a taste/*.md file');
  if (!existing) for (const field of ['when', 'rule']) if (!isText(input[field])) throw new Error(`lesson ${field} is required for a new lesson`);
  const next = existing ? seenOf(existing) + 1 : 1;
  const seen = input.seen ?? next;
  if (!Number.isInteger(seen) || seen < next) throw new Error(`lesson seen must be a whole number, ${next} or more`);
  const data = { seen, ...(input.enforced_by ? { enforced_by: structuredClone(input.enforced_by) } : {}), ...(input.passed_over ? { passed_over: input.passed_over } : {}) };
  const evidence = data.enforced_by?.evidence;
  if (evidence?.shows && !evidence.before) evidence.before = 'HEAD';
  const problem = lessonProblem(data);
  if (problem) throw new Error(`lesson "${input.title}": ${problem}`);
  return { existing, topic, data, input };
}

export function writeLesson(root, { existing, topic, data, input }) {
  const target = localPath(root, topic);
  const bullet = (label, text) => `- **${label}:** ${oneLine(text)}`;
  if (!existing) {
    const previous = existsSync(target) ? `${readFileSync(target, 'utf8').trimEnd()}\n` : '# Lessons\n';
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${previous}\n## ${oneLine(input.title)}\n\n${[bullet('When', input.when), bullet('Rule and reason', input.rule), bullet('Evidence', input.evidence)].join('\n')}\n\n${renderBlock(data)}\n`);
    return;
  }
  const lines = readFileSync(target, 'utf8').split(/\r?\n/);
  const { start, end, block } = existing;
  const body = block ? [...lines.slice(start, block.start), ...lines.slice(block.end + 1, end)] : lines.slice(start, end);
  while (body.length && !body.at(-1).trim()) body.pop();
  const rest = lines.slice(end);
  // Join the evidence to the entry's bullets; a block that followed them left one blank line behind.
  const glue = /^\s*[-*] /.test(body.at(-1)) ? [] : [''];
  const updated = [...lines.slice(0, start), ...body, ...glue, bullet(`Seen again (${data.seen})`, input.evidence), '', ...renderBlock(data).split('\n'), ...(rest.some((line) => line.trim()) ? ['', ...rest] : [''])];
  writeFileSync(target, updated.join('\n'));
}
