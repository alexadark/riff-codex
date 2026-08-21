import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

export type PhaseStatus = "todo" | "in-progress" | "done" | "blocked" | "skipped";
export type PhasePriority = "P0" | "P1" | "P2" | "P3";

export interface RoadmapPhase {
  id: string;
  slug: string;
  title: string;
  status: PhaseStatus;
  priority: PhasePriority | null;
  description: string;
  depends_on: string[];
}

export interface Roadmap {
  name: string;
  description: string;
  phases: RoadmapPhase[];
}

// STATUS_ALIASES intentionally accepts more than the canonical 5 statuses so
// brownfield roadmaps render. validateRoadmap() mirrors this leniency by
// normalizing through STATUS_ALIASES before flagging an error. The bash
// validator at lib/validate-roadmap.sh stays strict (canonical-only) because
// it gates new-phase creation, where there's no excuse for an alias.
const STATUS_ALIASES: Record<string, PhaseStatus> = {
  todo: "todo",
  pending: "todo",
  planned: "todo",
  "in-progress": "in-progress",
  in_progress: "in-progress",
  inprogress: "in-progress",
  wip: "in-progress",
  active: "in-progress",
  ready: "todo",
  done: "done",
  complete: "done",
  completed: "done",
  shipped: "done",
  blocked: "blocked",
  parked: "blocked",
  awaiting_human: "blocked",
  skipped: "skipped",
  rejected: "skipped",
  cancelled: "skipped",
  canceled: "skipped",
};

const PRIORITY_ALIASES: Record<string, PhasePriority> = {
  p0: "P0",
  p1: "P1",
  p2: "P2",
  p3: "P3",
  critical: "P0",
  high: "P1",
  medium: "P2",
  normal: "P2",
  low: "P3",
};

function normalizeStatus(value: unknown): PhaseStatus {
  if (typeof value !== "string") return "todo";
  return STATUS_ALIASES[value.toLowerCase().trim()] ?? "todo";
}

function normalizePriority(value: unknown): PhasePriority | null {
  if (typeof value !== "string") return null;
  return PRIORITY_ALIASES[value.toLowerCase().trim()] ?? null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v).trim())
    .filter(Boolean);
}

function isPhaseId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

function isSlugLike(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function humanize(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "phase";
}

function findFolderSlug(projectRoot: string, id: string): string | null {
  const codexProject = existsSync(join(projectRoot, ".riff-codex-state", "state.json"));
  const dir = codexProject
    ? join(projectRoot, ".riff-codex-state", "dashboard", "phases")
    : join(projectRoot, ".planning", "phases");
  if (!existsSync(dir)) return null;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  const prefix = `${id}-`;
  const match = entries.find((e) => e.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

const warnedSlugMismatch = new Set<string>();

function warnSlugMismatch(projectRoot: string, id: string, yamlSlug: string, folderSlug: string): void {
  const key = `${projectRoot}#${id}`;
  if (warnedSlugMismatch.has(key)) return;
  warnedSlugMismatch.add(key);
  console.warn(
    `[roadmap] phase ${id}: YAML slug "${yamlSlug}" does not match folder slug "${folderSlug}" — using YAML. Rename the folder to .planning/phases/${id}-${yamlSlug}/ to silence this warning.`,
  );
}

function resolvePhase(
  projectRoot: string,
  id: string,
  entry: Record<string, unknown>,
): RoadmapPhase | null {
  if (!isPhaseId(id)) return null;

  const folderSlug = findFolderSlug(projectRoot, id);
  const rawSlug = typeof entry.slug === "string" ? entry.slug : "";
  const rawTitle = typeof entry.title === "string" ? entry.title : typeof entry.name === "string" ? entry.name : "";

  let slug = "";

  // YAML is canonical for slug. Folder slug is a fallback only when YAML is
  // missing or malformed. If both exist and disagree, YAML wins and we warn
  // once per (project, id) so drift is visible without spamming logs.
  if (rawSlug && isSlugLike(rawSlug)) {
    slug = rawSlug;
    if (folderSlug && folderSlug !== rawSlug) {
      warnSlugMismatch(projectRoot, id, rawSlug, folderSlug);
    }
  } else if (existsSync(join(projectRoot, ".riff-codex-state", "state.json")) && rawTitle) {
    slug = slugify(rawTitle);
  } else if (folderSlug) {
    slug = folderSlug;
  } else if (rawTitle) {
    slug = slugify(rawTitle);
  } else {
    slug = `phase-${id}`;
  }

  // Title: YAML wins. Falls back to a humanized version of the slug.
  const title = rawTitle ? rawTitle : humanize(slug);

  const description =
    typeof entry.description === "string" ? entry.description :
    typeof entry.rationale === "string" ? entry.rationale :
    typeof entry.outcome === "string" ? entry.outcome :
    typeof entry.goal === "string" ? entry.goal :
    typeof entry.demo === "string" ? entry.demo : "";

  let status = normalizeStatus(entry.status);
  const stateFile = join(projectRoot, ".riff-codex-state", "state.json");
  if (existsSync(stateFile)) {
    try {
      const state = JSON.parse(readFileSync(stateFile, "utf8"));
      const current = state.phases?.find((phase: any) => String(phase.id) === String(id));
      if (current?.status) status = normalizeStatus(current.status);
    } catch { /* dashboard remains tolerant */ }
  }

  return {
    id,
    slug,
    title,
    status,
    priority: normalizePriority(entry.priority),
    description,
    depends_on: toStringArray(entry.depends_on),
  };
}

export interface RoadmapValidation {
  errors: string[];
  warnings: string[];
}

const VALID_STATUSES: ReadonlySet<string> = new Set([
  "todo",
  "in-progress",
  "done",
  "blocked",
  "skipped",
]);

/**
 * Lightweight schema check on the raw YAML object. Returns errors (block
 * progress) and warnings (informational, dashboard still loads). Mirrors
 * the bash validator at lib/validate-roadmap.sh — keep both in sync.
 */
export function validateRoadmap(parsed: unknown): RoadmapValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!parsed || typeof parsed !== "object") {
    errors.push("ROADMAP.yaml must be a YAML mapping at the top level");
    return { errors, warnings };
  }

  const obj = parsed as Record<string, unknown>;
  const phases = obj.phases;
  const codexFormat = obj.version === 1 && !!obj.project;

  if (!Array.isArray(phases)) {
    // Legacy top-level `phase-N:` format is parsed elsewhere; only flag it as
    // a warning so old roadmaps don't go red.
    const hasLegacy = Object.keys(obj).some((k) => /^phase-[A-Za-z0-9._-]+$/i.test(k));
    if (hasLegacy) {
      warnings.push("ROADMAP.yaml uses supported Claude top-level `phase-*:` keys; its existing format will be preserved");
    } else {
      errors.push("ROADMAP.yaml is missing a `phases:` array");
    }
    return { errors, warnings };
  }

  phases.forEach((entry, index) => {
    const where = `phases[${index}]`;
    if (!entry || typeof entry !== "object") {
      errors.push(`${where}: not a YAML mapping`);
      return;
    }
    const p = entry as Record<string, unknown>;
    const idLabel = typeof p.id === "number" || typeof p.id === "string" ? `id=${p.id}` : "id=?";

    const phaseId = typeof p.id === "number" || typeof p.id === "string" ? String(p.id).trim() : "";
    if (!phaseId || !isPhaseId(phaseId)) {
      errors.push(`${where}: missing or invalid \`id\``);
    }
    if (!codexFormat && (typeof p.slug !== "string" || p.slug.trim() === "")) {
      errors.push(`${where} (${idLabel}): missing required field \`slug\``);
    } else if (typeof p.slug === "string" && !isSlugLike(p.slug)) {
      errors.push(`${where} (${idLabel}): slug "${p.slug}" is not kebab-case`);
    }
    if (typeof p.title !== "string" || p.title.trim() === "") {
      errors.push(`${where} (${idLabel}): missing required field \`title\``);
    }
    if (typeof p.status !== "string" || p.status.trim() === "") {
      errors.push(`${where} (${idLabel}): missing required field \`status\``);
    } else {
      // Apply the same alias normalization that resolvePhase uses, so the
      // validator does not flag well-known synonyms like "pending" or "wip"
      // that the parser already tolerates. Bash validator is strict; this
      // intentional divergence is documented next to STATUS_ALIASES.
      const normalized = STATUS_ALIASES[p.status.trim().toLowerCase()];
      if (!normalized || !VALID_STATUSES.has(normalized)) {
        errors.push(`${where} (${idLabel}): status "${p.status}" is not one of: todo | in-progress | done | blocked | skipped (or accepted alias)`);
      }
    }
    if ("name" in p) {
      errors.push(`${where} (${idLabel}): uses deprecated phase-level \`name:\` field, use \`title:\` instead`);
    }
    if (codexFormat && normalizePriority(p.priority) === null) {
      warnings.push(`${where} (${idLabel}): missing explicit priority P0 | P1 | P2 | P3`);
    }
  });

  return { errors, warnings };
}

const warnedValidation = new Set<string>();

function logValidationOnce(path: string, validation: RoadmapValidation): void {
  if (validation.errors.length === 0 && validation.warnings.length === 0) return;
  const sig = JSON.stringify(validation);
  const key = `${path}#${sig}`;
  if (warnedValidation.has(key)) return;
  warnedValidation.add(key);
  for (const w of validation.warnings) {
    console.warn(`[roadmap] ${path}: ${w}`);
  }
  for (const e of validation.errors) {
    console.warn(`[roadmap] ${path}: ${e}`);
  }
}

/**
 * Parse ROADMAP.yaml from a project root. Tolerant of two formats:
 *   1. `phases: [{ id, slug, title, status, ... }]` — canonical RIFF template
 *   2. Top-level `phase-*: { ... }` keys — Claude roadmap shape, kept readable
 *      so old projects don't go blank in the dashboard.
 *
 * Schema problems are surfaced via console.warn (once per path+signature) but
 * never block the parse — a partially-broken roadmap is still more useful in
 * the UI than a blank screen.
 */
export function parseRoadmap(projectRoot: string): Roadmap | null {
  const path = join(projectRoot, "ROADMAP.yaml");
  if (!existsSync(path)) {
    return null;
  }

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    console.warn(`[roadmap] failed to read ${path}:`, (err as Error).message);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(raw);
  } catch (err) {
    console.warn(`[roadmap] YAML parse error in ${path}:`, (err as Error).message);
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  logValidationOnce(path, validateRoadmap(parsed));

  const phases: RoadmapPhase[] = [];

  // Format 1: phases: [...] array (canonical)
  if (Array.isArray(obj.phases)) {
    for (const entry of obj.phases) {
      if (!entry || typeof entry !== "object") continue;
      const p = entry as Record<string, unknown>;
      const id = String(p.id ?? "").trim();
      const phase = resolvePhase(projectRoot, id, p);
      if (phase) phases.push(phase);
    }
  }

  // Format 2: top-level phase-* keys (only if no phases array was found)
  if (phases.length === 0) {
    for (const [key, value] of Object.entries(obj)) {
      const match = /^phase-([A-Za-z0-9._-]+)$/i.exec(key);
      if (!match) continue;
      if (!value || typeof value !== "object") continue;
      const id = match[1]!;
      const phase = resolvePhase(projectRoot, id, value as Record<string, unknown>);
      if (phase) phases.push(phase);
    }
    phases.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }

  const ids = new Set(phases.map((phase) => phase.id));
  for (const phase of phases) {
    phase.depends_on = phase.depends_on.map((dependency) => {
      if (ids.has(dependency)) return dependency;
      const unprefixed = dependency.replace(/^phase-/i, "");
      return ids.has(unprefixed) ? unprefixed : dependency;
    });
  }

  const project = obj.project && typeof obj.project === "object" ? obj.project as Record<string, unknown> : {};
  return {
    name: typeof obj.name === "string" ? obj.name : typeof project.name === "string" ? project.name : "",
    description: typeof obj.description === "string" ? obj.description : typeof project.objective === "string" ? project.objective : "",
    phases,
  };
}

/**
 * Find the absolute folder for a phase under .planning/phases/.
 * The folder is named `${id}-${slug}`. Returns null if not present.
 */
export function phaseDir(projectRoot: string, phase: Pick<RoadmapPhase, "id" | "slug">): string {
  if (existsSync(join(projectRoot, ".riff-codex-state"))) {
    return join(projectRoot, ".riff-codex-state", "dashboard", "phases", `${phase.id}-${phase.slug}`);
  }
  return join(projectRoot, ".planning", "phases", `${phase.id}-${phase.slug}`);
}

export function phaseDirExists(projectRoot: string, phase: Pick<RoadmapPhase, "id" | "slug">): boolean {
  return existsSync(phaseDir(projectRoot, phase));
}
