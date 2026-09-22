---
name: map
description: Map an existing codebase around product behavior and current boundaries. Use when the user invokes $riff:map or needs a focused repository map before a decision.
---

# Map the current system

Read existing project taste under `.riff-codex/references/taste.md` and distinguish stable conventions from accidental patterns. Report useful additions without modifying taste during a read-only map. When explicitly asked to save conventions, merge them into the project-owned taste following that reference.

Follow the [model-advice contract](../../references/model-routing.md) and its single catalog. A read-only map does not persist advice or call Jev without an explicit request. An advice-only request stops before mapping; a recommendation does not authorize a worker. Map user-visible flows to entry points, data boundaries, external systems, and sensitive surfaces. Distinguish verified facts from inference.

Write a concise `.riff-codex-state/MAP.md` only when the map will be reused. Do not create a speculative target architecture, implementation plan, or exhaustive file inventory.

For the explicit install → map → onboard → evolve → wave path, save the reusable map with the inspected revision or working-tree context, source references, and remaining uncertainties. Map does not onboard the project or invent a roadmap. Point to `$riff:onboard`, which reuses these findings after checking relevant drift.
