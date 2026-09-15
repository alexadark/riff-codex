---
name: quick
description: Deliver a small bounded change with RIFF safety and evidence but no roadmap phase. Use when the user invokes $riff:quick for work too small to justify a phase.
---

# Run a quick RIFF change

Read `.riff-codex/references/taste.md` and applicable project conventions. For UI changes, use the relevant design skills and scoped rendered checks from `.riff-codex/references/taste/frontend.md`. Merge a proven reusable lesson before final review; keep this proportional to the change.

Use only for a bounded change that does not alter the product roadmap. Read `.riff-codex/references/git-delivery.md` and establish or reconcile this change's scoped branch before implementation. Inspect the affected boundary, implement with one writer, validate only changed behavior, and perform a fresh functional review. Load `.riff-codex/references/security.md` if the boundary is sensitive.

Follow `.riff-codex/references/learning.md` for selective reuse and deduplicated learning in the project's existing taste topics.

For changed user journeys, capture observed browser results and screenshots, then generate the HTML report using `.riff-codex/references/evidence.md` and link it in the result. Nonvisual checks need their observed results, not invented screenshots.

Before finishing, perform agent-owned observation triage under `.riff-codex/references/dashboard.md#end-of-work-observation-triage`. Inspect current code and evidence, repair confirmed in-scope problems, and record justified decisions through `observations review`. Do not delegate technical validity judgments to the user or mark unverified findings resolved.

Create one atomic commit and append a concise event with `node .riff-codex/bin/riff.mjs hook` only through normal hooks. Follow the Git delivery reference to create or update this bounded change's PR when publication is authorized; otherwise prepare and report the local result. Verify and return the PR URL and actual checks, without claiming merge or deployment. If scope expands or a product decision appears, stop and recommend `$riff:add-phase` instead.
