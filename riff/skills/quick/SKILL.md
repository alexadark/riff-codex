---
name: quick
description: Deliver a small bounded change with RIFF safety and evidence but no roadmap phase. Use when the user invokes $riff:quick for work too small to justify a phase.
---

# Run a quick RIFF change

Read `.riff-codex/references/taste.md` and applicable project conventions. For UI changes, use the relevant design skills and scoped rendered checks from `.riff-codex/references/taste/frontend.md`. Merge a proven reusable lesson before final review; keep this proportional to the change.

Use only for a bounded change that does not alter the product roadmap. Inspect the affected boundary, implement with one writer, validate only changed behavior, and perform a fresh functional review. Load `.riff-codex/references/security.md` if the boundary is sensitive.

For changed user journeys, capture observed browser results and screenshots, then generate the HTML report using `.riff-codex/references/evidence.md` and link it in the result. Nonvisual checks need their observed results, not invented screenshots.

Create one atomic commit and append a concise event with `node .riff-codex/bin/riff.mjs hook` only through normal hooks. If scope expands or a product decision appears, stop and recommend `$riff:add-phase` instead.
