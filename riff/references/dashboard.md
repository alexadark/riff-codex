# Dashboard projection contract

The dashboard is an independent application. Roadmap and wave state remain read-only. Observation triage is its only project-state write: it invokes the locked RIFF observations CLI, never a model, SDK, agent CLI or wave command.

RIFF Codex producers write derived display artifacts under `.riff-codex-state/dashboard/phases/<id>-<slug>/`, where `<slug>` is the phase title converted to lowercase kebab-case:

- `EXPLAIN.simple.md` describes the demonstrable outcome before implementation in the configured conversation language.
- `EXPLAIN-POST.simple.md` replaces intent with the verified result after completion and briefly includes validation, review, security, and commit evidence when available.

Keep each explanation concrete, jargon-free, and short. The product contract, roadmap, receipts, and RIFF state remain canonical; dashboard files are disposable projections and must never drive execution.

Legacy RIFF projects keep their existing `.planning/phases/**/EXPLAIN*.md` artifacts. The dashboard adapts both layouts to the same view.

## End-of-work observation triage

Expand observations to review, choose To review, Resolved or False positive, and save a concise reason or verification result. Processed groups move to a collapsed history section and can be reopened. Decisions persist in the project state via `observations review`; original findings and decision history are preserved. A new occurrence reopens its group. Stale decisions are rejected and must be refreshed. Triage never clears phase blockers, changes review receipts or bypasses security hooks.

CLI equivalent: `node .riff-codex/bin/riff.mjs observations list`, then `observations review --id ID --revision REV --status resolved --note "Verified correction"`. Status values are `pending`, `resolved` and `false_positive`.
