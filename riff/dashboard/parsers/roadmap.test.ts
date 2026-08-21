import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseRoadmap, validateRoadmap } from "./roadmap.ts";

const roots: string[] = [];

function fixture(roadmap: Record<string, unknown>, state?: Record<string, unknown>) {
  const root = mkdtempSync(join(tmpdir(), "riff-dashboard-roadmap-"));
  roots.push(root);
  writeFileSync(join(root, "ROADMAP.yaml"), `${JSON.stringify(roadmap, null, 2)}\n`);
  if (state) {
    const stateDir = join(root, ".riff-codex-state");
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, "state.json"), `${JSON.stringify(state, null, 2)}\n`);
  }
  return root;
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("RIFF Codex roadmap projection", () => {
  test("uses live Codex state and reads Claude root phase entries", async () => {
    const phases = [
      { id: "1", title: "Complete", outcome: "Done", priority: "P1", status: "ready" },
      { id: "2-design", title: "Design", outcome: "Doing", priority: "P1", status: "ready" },
      { id: "3", title: "Blocked", outcome: "Blocked", priority: "P0", status: "ready" },
      { id: "4", title: "Ready", outcome: "Todo", priority: "P2", status: "ready" },
      { id: "legacy-skip", title: "Skipped", outcome: "Skipped", priority: "P3", status: "skipped" },
    ];
    const root = fixture(
      { version: 1, project: { name: "Test" }, phases },
      {
        version: 1,
        phases: [
          { ...phases[0], status: "completed" },
          { ...phases[1], status: "active" },
          { ...phases[2], status: "parked" },
          phases[3],
        ],
      },
    );

    const roadmap = parseRoadmap(root);

    expect(roadmap?.phases.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "1", status: "done" },
      { id: "2-design", status: "in-progress" },
      { id: "3", status: "blocked" },
      { id: "4", status: "todo" },
      { id: "legacy-skip", status: "skipped" },
    ]);

    const claudeRoot = fixture({
      name: "Claude",
      "phase-alpha": { name: "Alpha", status: "done" },
      "phase-beta": { title: "Beta", status: "todo", depends_on: ["phase-alpha"] },
    });
    expect(parseRoadmap(claudeRoot)?.phases.map(({ id, title, depends_on }) => ({ id, title, depends_on }))).toEqual([
      { id: "alpha", title: "Alpha", depends_on: [] },
      { id: "beta", title: "Beta", depends_on: ["alpha"] },
    ]);
  });

  test("does not invent a Medium priority when the roadmap omits it", () => {
    const raw = {
      version: 1,
      project: { name: "Test" },
      phases: [{ id: "1", title: "Unprioritized", outcome: "Test", status: "ready" }],
    };
    const root = fixture(raw);

    expect(parseRoadmap(root)?.phases[0]?.priority).toBeNull();
    expect(validateRoadmap(raw).warnings).toContain(
      "phases[0] (id=1): missing explicit priority P0 | P1 | P2 | P3",
    );
  });
});
