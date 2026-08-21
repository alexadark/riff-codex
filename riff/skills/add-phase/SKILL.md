---
name: add-phase
description: Add one justified vertical phase to an existing RIFF roadmap. Use when the user invokes $riff:add-phase or approves a newly discovered product outcome.
---

# Add a roadmap phase

Read `PROJECT.md`, `ROADMAP.yaml`, and the current state. Confirm the new outcome is in product scope and is not already covered. If it materially changes the product, ask for that decision and recommend a course.

Add one vertical, demonstrable phase with one explicit justified P0-P3 priority and only real dependencies, blocking edges, risks, sensitivity, and exclusions. Do not inherit a default priority from neighboring phases. Do not renumber completed phases or rewrite foreign roadmap content unnecessarily. Run `node .riff/bin/riff.mjs wave sync` and report when the phase becomes ready.
