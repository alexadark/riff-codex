---
name: onboard
description: Bring an existing project into RIFF with concise brownfield discovery. Use when the user invokes $riff:onboard or wants RIFF artifacts for an application that already has code.
---

# Onboard an existing project

Inspect the repository first. Separate implemented facts from preferences, assumptions, and open product decisions. Summarize current user-visible capabilities, architecture, constraints, risks, and vocabulary.

Ask only decisions at the current product boundary, with a recommendation for each. Identify technical debt only when it blocks a vertical outcome. Mark uncertain later work as fog of war.

Draft `PROJECT.md` and a vertical `ROADMAP.yaml` with an explicit justified P0-P3 priority for every phase, then ask for confirmation before writing them. Do not assign one default priority across the roadmap. Preserve existing product documentation unless the user authorizes replacement. After confirmation, write the artifacts, run `node .riff/bin/riff.mjs wave sync`, and stop.
