import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { withFileLock } from './safety.mjs';

// End-of-phase improvement proposals. The agent proposes; nothing here applies a change.
// Project proposals live in local RIFF state; RIFF proposals go to the framework idea box.
const MAX_PER_PHASE = 3;
const TARGETS = new Set(['project', 'riff']);
const IMPACTS = new Set(['HIGH', 'MEDIUM', 'LOW']);
const AREAS = new Set(['skill', 'reference', 'cli', 'dashboard', 'doc', 'other']);
const DECISIONS = new Set(['taken', 'dismissed']);
const TEXT_FIELDS = ['title', 'what_happened', 'proposal'];

export function ideasFile(frameworkRepo) {
  return process.env.RIFF_IDEAS_FILE ? path.resolve(process.env.RIFF_IDEAS_FILE) : path.join(frameworkRepo, 'ideas', 'inbox.ndjson');
}

const titleKey = (title) => title.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function parseProposals(proposals) {
  if (!Array.isArray(proposals)) throw new Error('improvement file must be a JSON array of proposals (an empty array is valid)');
  if (proposals.length > MAX_PER_PHASE) throw new Error(`at most ${MAX_PER_PHASE} improvement proposals per phase; keep the most useful ones`);
  return proposals.map((item, index) => {
    const where = `proposal ${index + 1}`;
    if (!TARGETS.has(item?.target)) throw new Error(`${where}: target must be project or riff`);
    for (const field of TEXT_FIELDS) if (typeof item[field] !== 'string' || !item[field].trim()) throw new Error(`${where}: ${field} is required`);
    const impact = String(item.impact ?? '').toUpperCase();
    if (!IMPACTS.has(impact)) throw new Error(`${where}: impact must be HIGH, MEDIUM or LOW`);
    const proposal = { target: item.target, title: item.title.trim(), what_happened: item.what_happened.trim(), proposal: item.proposal.trim(), impact };
    if (item.target === 'riff') {
      const area = item.area ?? 'other';
      if (!AREAS.has(area)) throw new Error(`${where}: area must be one of ${[...AREAS].join(', ')}`);
      proposal.area = area;
    } else {
      proposal.suggested_phase = typeof item.suggested_phase === 'string' && item.suggested_phase.trim() ? item.suggested_phase.trim() : 'new phase';
    }
    return proposal;
  });
}

export function readIdeas(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').flatMap((line) => {
    try { return line.trim() ? [JSON.parse(line)] : []; } catch { return []; }
  });
}

// Records one improvement pass for a phase. Duplicates of an existing title are skipped, not rejected,
// so a repeated proposal never costs the wave a retry.
export function recordImprovements({ state, phase, proposals, project, ideas, at }) {
  const projectKeys = new Map((state.improvements ?? []).map((item) => [titleKey(item.title), item.id]));
  const recorded = [];
  const skipped = [];
  const riffEntries = [];
  withFileLock(`${ideas}.lock`, () => {
    const riffKeys = new Map(readIdeas(ideas).map((item) => [titleKey(String(item.title ?? '')), item.id]));
    for (const proposal of proposals) {
      const keys = proposal.target === 'riff' ? riffKeys : projectKeys;
      const key = titleKey(proposal.title);
      if (keys.has(key)) { skipped.push({ title: proposal.title, duplicateOf: keys.get(key) }); continue; }
      const id = `imp-${createHash('sha256').update(`${project}\0${phase.id}\0${proposal.target}\0${key}`).digest('hex').slice(0, 10)}`;
      const entry = { id, at, project, phase: phase.id, ...proposal, status: 'proposed' };
      keys.set(key, id);
      recorded.push(entry);
      if (proposal.target === 'riff') riffEntries.push(entry);
    }
    if (riffEntries.length) {
      mkdirSync(path.dirname(ideas), { recursive: true });
      appendFileSync(ideas, riffEntries.map((entry) => `${JSON.stringify(entry)}\n`).join(''));
    }
  });
  state.improvements = [...(state.improvements ?? []), ...recorded.filter((entry) => entry.target === 'project')];
  phase.improvementPass = { at, recorded: recorded.map((entry) => entry.id), skipped: skipped.length };
  return { recorded, skipped };
}

export function decideImprovement(state, { id, status, note, at }) {
  if (!DECISIONS.has(status)) throw new Error('--status must be taken or dismissed');
  const item = (state.improvements ?? []).find((entry) => entry.id === id);
  if (!item) throw new Error(`unknown project improvement ${id}`);
  item.status = status;
  item.decision = { note: typeof note === 'string' ? note.trim() : '', at };
  return item;
}

export function improvementPassError(phase) {
  if (phase.improvementPass) return null;
  return `record the end-of-phase improvement pass first: riff improve record --phase ${phase.id} --file FILE (an empty list [] is valid)`;
}
