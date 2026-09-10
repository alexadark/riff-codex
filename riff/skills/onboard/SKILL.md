---
name: onboard
description: Bring an existing project into RIFF with concise brownfield discovery. Use when the user invokes $riff:onboard or wants RIFF artifacts for an application that already has code.
---

# Onboard an existing project

Inspect the repository and configured autonomy mode first. Classify the scope before choosing the depth of discovery. For an existing project with several dependent outcomes, multiple user roles or system boundaries, a multi-system integration, or an explicit large-project request, read `.riff-codex/references/project-framing.md` and capture user stories with observable criteria, the relevant entities, relationships, constraints and rights, architecture and integrations with motivated decisions, and a phase map connecting outcomes to stories. Keep a small application with one clear outcome on the concise onboarding path. Reuse existing answers and project documents rather than repeating resolved questions. Separate implemented facts from preferences, assumptions, and open product decisions. Summarize current user-visible capabilities, architecture, constraints, risks, and vocabulary.

In default `loop` mode, resolve current product and technical decisions conservatively from repository evidence: preserve existing behavior and data, minimize scope, permissions, dependencies, and external effects, prefer reversible choices, record assumptions, and continue without asking. In `guided` mode, ask only decisions at the current product boundary, with a recommendation for each. Identify technical debt only when it blocks a vertical outcome. Mark uncertain later work as fog of war.

Draft `PROJECT.md` and a vertical `ROADMAP.yaml` with an explicit justified P0-P3 priority for every phase. In `loop`, write the conservative draft without a confirmation round. In `guided`, ask for confirmation before writing it. Do not assign one default priority across the roadmap. Treat both artifacts as shared with Claude RIFF. Preserve existing content, roadmap representation, comments, key order, and unknown fields unless the user authorizes a targeted replacement. After the mode-specific boundary, write the artifacts, run `node .riff-codex/bin/riff.mjs wave sync`, and stop. Do not publish GitHub issues unless the user separately invokes `$riff:issue`.

In `loop`, stop only for missing credentials or external access, impossible third-party verification, an unidentifiable destructive target, or failed RIFF validation. Never create `awaiting_human` for a product or technical decision. `guided` retains its confirmation behavior.
