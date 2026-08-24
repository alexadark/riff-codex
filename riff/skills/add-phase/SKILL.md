---
name: add-phase
description: Add one justified vertical phase to an existing RIFF roadmap. Use when the user invokes $riff:add-phase or approves a newly discovered product outcome.
---

# Add a roadmap phase

Read `PROJECT.md`, `ROADMAP.yaml`, the current state, and the configured autonomy mode. Confirm the new outcome is in product scope and is not already covered. In default `loop` mode, choose conservative product and technical details automatically. If a discovered outcome would widen the product contract without explicit user authorization, keep the existing scope and report that no phase was added instead of creating `awaiting_human`. In `guided` mode, ask before a material product change and recommend a course.

Add one vertical, demonstrable phase with one explicit justified P0-P3 priority and only real dependencies, blocking edges, risks, sensitivity, and exclusions. Do not inherit a default priority from neighboring phases. Preserve the existing Codex or Claude roadmap representation, comments, key order, and every unknown field with a targeted edit. Never convert top-level `phase-*` entries into a `phases` array, or the reverse, and never renumber completed phases. Run `node .riff-codex/bin/riff.mjs wave sync` and report when the phase becomes ready.

In `loop`, stop only for missing credentials or external access, impossible third-party verification, an unidentifiable destructive target, or failed RIFF validation. Never stop for a product or technical choice. `guided` retains its confirmation behavior.
