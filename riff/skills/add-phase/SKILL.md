---
name: add-phase
description: Add one justified vertical phase to an existing RIFF roadmap. Use when the user invokes $riff:add-phase or approves a newly discovered product outcome.
---

# Add a roadmap phase

Use this for one already-understood independent outcome. When the request needs product reconsideration, impact analysis across existing behavior, or several interacting roadmap changes, use `$riff:evolve` and its [evolution contract](../../references/evolution.md) before adding phases. Do not reduce such a request to a blind append.

Read `PROJECT.md`, `ROADMAP.yaml`, the current state, and the configured autonomy mode. If this is a large project, also read `.riff-codex/references/project-framing.md` and reuse its stories, criteria, data boundaries, rights, integrations, decisions, and prior answers. Confirm the new outcome is in product scope and is not already covered. In default `loop` mode, choose conservative product and technical details automatically. If a discovered outcome would widen the product contract without explicit user authorization, keep the existing scope and report that no phase was added instead of creating `awaiting_human`. In `guided` mode, ask before a material product change and recommend a course.

Add one vertical, demonstrable phase with one explicit justified P0-P3 priority and only real dependencies, blocking edges, risks, sensitivity, and exclusions. For a large project, connect it to the stories and criteria it advances and deepen only the phase-specific data, permission, integration, recovery, and validation boundaries that are useful now. Do not inherit a default priority from neighboring phases. Preserve the existing Codex or Claude roadmap representation, comments, key order, and every unknown field with a targeted edit. Never convert top-level `phase-*` entries into a `phases` array, or the reverse, and never renumber completed phases. Run `node .riff-codex/bin/riff.mjs wave sync` and report when the phase becomes ready.

In `loop`, stop only for missing credentials or external access, impossible third-party verification, an unidentifiable destructive target, or failed RIFF validation. Never stop for a product or technical choice. `guided` retains its confirmation behavior.

For a project enrolled through `docs/specs/readiness.json`, update the dossier's story/phase mapping and references affected by the added outcome. Obtain an independent discovery review for the revised digest and pass `discovery check` before activating further work. A defect found by whole-version verification can become an in-scope correction phase without another product approval; preserve completed phases and their historical receipts. Identify useful independent work packages within the phase, but do not activate multiple phases or invent file-by-file future plans.
