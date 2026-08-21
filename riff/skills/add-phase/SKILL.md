---
name: add-phase
description: Add one justified vertical phase to an existing RIFF roadmap. Use when the user invokes $riff:add-phase or approves a newly discovered product outcome.
---

# Add a roadmap phase

Read `PROJECT.md`, `ROADMAP.yaml`, and the current state. Confirm the new outcome is in product scope and is not already covered. If it materially changes the product, ask for that decision and recommend a course.

Add one vertical, demonstrable phase with one explicit justified P0-P3 priority and only real dependencies, blocking edges, risks, sensitivity, and exclusions. Do not inherit a default priority from neighboring phases. Preserve the existing Codex or Claude roadmap representation, comments, key order, and every unknown field with a targeted edit. Never convert top-level `phase-*` entries into a `phases` array, or the reverse, and never renumber completed phases. Run `node .riff-codex/bin/riff.mjs wave sync` and report when the phase becomes ready.
