import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { homedir } from "node:os";
import YAML from "yaml";

export type DashboardLevel = "technical" | "simple" | "eli5";
export type DashboardLanguage = string;
export interface DashboardConfig { level: DashboardLevel; language: DashboardLanguage; projects: string[] }
export interface ProjectConfig { level: DashboardLevel; language: DashboardLanguage; source: string }
export interface RegistryEntry { slug: string; root: string; exists: boolean }

const SHARED_REGISTRY = join(homedir(), ".config", "riff-dashboard", "registry.json");
const OLD_RIFF_CONFIG = join(homedir(), ".config", "riff", "config.yaml");

export function findFrameworkRoot(startDir: string): string | null {
  let current = startDir;
  for (let i = 0; i < 20; i += 1) {
    if (existsSync(join(current, ".codex-plugin", "plugin.json"))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

function readYaml(file: string): Record<string, any> {
  try { return YAML.parse(readFileSync(file, "utf8")) ?? {}; } catch { return {}; }
}

function oldFrameworkRoot(): string {
  const config = readYaml(OLD_RIFF_CONFIG);
  return typeof config.framework_path === "string" ? config.framework_path : join(homedir(), "DEV", "frameworks", "riff");
}

function oldProfile(): Record<string, any> {
  const root = oldFrameworkRoot();
  const file = existsSync(join(root, "profile.yaml")) ? join(root, "profile.yaml") : join(root, "profile.yaml.example");
  return readYaml(file);
}

function sharedRegistry(): { projects: string[]; hidden: string[] } {
  try {
    const value = JSON.parse(readFileSync(SHARED_REGISTRY, "utf8"));
    return {
      projects: Array.isArray(value.projects) ? value.projects.filter((item: unknown) => typeof item === "string" && isAbsolute(item)) : [],
      hidden: Array.isArray(value.hidden) ? value.hidden.filter((item: unknown) => typeof item === "string" && isAbsolute(item)) : [],
    };
  } catch { return { projects: [], hidden: [] }; }
}

function writeRegistry(value: { projects: string[]; hidden: string[] }): void {
  mkdirSync(dirname(SHARED_REGISTRY), { recursive: true });
  writeFileSync(SHARED_REGISTRY, `${JSON.stringify({ version: 1, ...value }, null, 2)}\n`);
}

function preferences(profile: Record<string, any>): { level: DashboardLevel; language: string } {
  const raw = profile.style?.explanation_level ?? profile.dashboard?.level;
  const level: DashboardLevel = ["technical", "simple", "eli5"].includes(raw) ? raw : "simple";
  const language = profile.user?.narrative_language ?? profile.dashboard?.language ?? profile.user?.conversational_language ?? "en";
  return { level, language };
}

export function loadProfile(_frameworkRoot: string): { profile: Record<string, any>; config: DashboardConfig } {
  const profile = oldProfile();
  const shared = sharedRegistry();
  const legacy = Array.isArray(profile.dashboard?.projects) ? profile.dashboard.projects.filter((item: unknown) => typeof item === "string" && isAbsolute(item)) : [];
  const hidden = new Set(shared.hidden);
  const projects = [...new Set([...legacy, ...shared.projects])].filter((item) => !hidden.has(item));
  return { profile, config: { ...preferences(profile), projects } };
}

export function resolveProjectConfig(projectRoot: string, _frameworkRoot: string): ProjectConfig {
  const codex = join(projectRoot, ".riff-state", "config.json");
  if (existsSync(codex)) {
    try {
      const config = JSON.parse(readFileSync(codex, "utf8"));
      const level = ["technical", "simple", "eli5"].includes(config.preferences?.explanation) ? config.preferences.explanation : "simple";
      return { level, language: config.language ?? "en", source: "riff-codex" };
    } catch { /* fall through */ }
  }
  const local = join(projectRoot, ".planning", "profile.yaml");
  const profile = existsSync(local) ? readYaml(local) : oldProfile();
  return { ...preferences(profile), source: existsSync(local) ? "project" : "legacy-default" };
}

export function slugFromPath(value: string): string { return basename(value).toLowerCase(); }

export function resolveRegistry(projects: string[]): RegistryEntry[] {
  const counts = new Map<string, number>();
  return projects.map((root) => {
    const base = slugFromPath(root);
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    return { slug: count === 1 ? base : `${base}-${count}`, root, exists: existsSync(root) };
  });
}

export function addProject(frameworkRoot: string, projectPath: string): RegistryEntry[] {
  if (!isAbsolute(projectPath)) throw new Error(`path must be absolute: ${projectPath}`);
  const registry = sharedRegistry();
  if (!registry.projects.includes(projectPath)) registry.projects.push(projectPath);
  registry.hidden = registry.hidden.filter((item) => item !== projectPath);
  writeRegistry(registry);
  return resolveRegistry(loadProfile(frameworkRoot).config.projects);
}

export function removeProject(frameworkRoot: string, slugOrPath: string): RegistryEntry[] {
  const entries = resolveRegistry(loadProfile(frameworkRoot).config.projects);
  const target = entries.find((entry) => entry.slug === slugOrPath || entry.root === slugOrPath)?.root;
  if (!target) return entries;
  const registry = sharedRegistry();
  registry.projects = registry.projects.filter((item) => item !== target);
  if (!registry.hidden.includes(target)) registry.hidden.push(target);
  writeRegistry(registry);
  return resolveRegistry(loadProfile(frameworkRoot).config.projects);
}
