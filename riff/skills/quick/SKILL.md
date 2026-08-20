---
name: quick
description: Deliver a small bounded change with RIFF safety and evidence but no roadmap phase. Use when the user invokes $riff:quick for work too small to justify a phase.
---

# Run a quick RIFF change

Use only for a bounded change that does not alter the product roadmap. Inspect the affected boundary, implement with one writer, validate only changed behavior, and perform a fresh functional review. Load `.riff/references/security.md` if the boundary is sensitive.

Create one atomic commit and append a concise event with `node .riff/bin/riff.mjs hook` only through normal hooks. If scope expands or a product decision appears, stop and recommend `$riff:add-phase` instead.
