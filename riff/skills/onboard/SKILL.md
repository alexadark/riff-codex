---
name: onboard
description: Map an existing codebase and bring it into RIFF as a baseline. Use when the user invokes this skill by name, or asks to map or onboard a project that already has code.
---

# Map and onboard an existing project

`riff` means `node .riff-cli/bin/riff.mjs`; before installation it means `node <RIFF source>/riff/bin/riff.mjs`, the RIFF source checkout rather than a plugin cache copy. The brownfield path is: check prerequisites, install RIFF, then onboard, then the `evolve` skill for new features, then the `wave` skill.

A map-only request needs no installation. Without RIFF state it runs in degraded mode: say so in one line, report the map, and write `MAP.md` only where the brief or the owner says.

## Goal

Understand the existing application from its code, then record it as the RIFF baseline: what it does today, not a retrospective list of completed phases. A request to map only stops after the map.

## Done when

- **Map:** user-visible flows are linked to entry points, data boundaries, external systems and sensitive surfaces, with verified facts kept apart from inference. If the map will be reused, `MAP.md` in the RIFF state folder records the inspected revision, sources and remaining uncertainties. No target architecture, implementation plan or exhaustive file inventory.
- **Onboard:** `PROJECT.md` summarizes current capabilities, architecture, constraints, risks and vocabulary, separating implemented facts from preferences, assumptions and open decisions. `ROADMAP.yaml` lists only requested future outcomes, often none; each phase has a justified P0 to P3 priority, `done_when` and `verify`. `riff wave sync` passed (a subagent hands it to the main agent), and the skill stopped there.
- The project taste holds the verified conventions of the actual code and design, merged into existing Claude or project taste without overwriting it. For a UI product, it includes the frontend direction and design-skill routing.

## Verify

Check every map finding against the current code before relying on it, including findings from an earlier `MAP.md`. Confirm the actual stack and reuse its stack references.

## Prerequisites before installing

`riff init` changes repository plumbing shared by every worktree: Git `pre-commit` and `commit-msg` hooks, `.git/info/exclude`, `.claude/settings.local.json`, `.codex/hooks.json`, `.agents/skills/riff-codex-*`, `.riff-data/` and the dashboard registry. Before it:

1. Run `node <RIFF source>/riff/bin/riff.mjs init --check` from the project's main checkout. It changes nothing; it lists linked worktrees and their uncommitted work, `core.hooksPath`, existing hooks it will chain, a RIFF copy inside a plugin cache, and the files `init` will touch.
2. Stop and report when it fails, or when another agent or person is working in a linked worktree of this repository: plumbing changes wait for a moment without active work on the repository. Never attach an install to a repair brief.
3. Install with `node <RIFF source>/riff/bin/riff.mjs init --non-interactive --language <en|fr> --autonomy <loop|guided>` (add `--scope scratch` for a prototype). Without a terminal, `init` takes the defaults silently (language `en`, scope `production`, autonomy `loop`), so pass them explicitly.

## How to work

1. Inspect the repository, existing project answers and the configured autonomy mode. Reuse a valid `MAP.md` and existing onboarding artifacts instead of repeating discovery.
2. Classify the scope. Several dependent outcomes, multiple user roles or system boundaries, multi-system integration or an explicit large-project request use the project framing reference: stories with observable criteria, entities, relationships and rights, architecture and integrations with motivated decisions, and a phase map. A small application with one clear outcome stays concise.
3. A read-only map reports useful conventions without changing taste and doesn't persist model advice or call paid advice without an explicit request. Save conventions only when asked.
4. In `loop` mode, settle product and technical questions from repository evidence: preserve behavior and data, minimize scope, permissions, dependencies and external effects, prefer reversible choices, record assumptions and continue. Never create `awaiting_human` for a decision. Stop only for missing credentials or access, impossible third-party verification, an unidentifiable destructive target or a failed RIFF validation. In `guided` mode, ask only product-boundary decisions, each with a recommendation, and confirm before writing the artifacts.
5. Name technical debt only when it blocks a vertical outcome; mark uncertain later work as fog of war. Don't redesign the application.
6. `PROJECT.md` and `ROADMAP.yaml` are shared with the original RIFF framework: keep existing content, representation, comments, key order and unknown fields unless a targeted replacement is authorized.

Publish GitHub issues only through the `issue` skill.

## References

Read when the step needs them, under `.riff-cli/references/`: `project-framing.md`, `evolution.md`, `taste.md` and `taste/frontend.md`, `operating-contract.md`.
