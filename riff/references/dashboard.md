# Dashboard projection contract

The dashboard is an independent read-only application. It never invokes a model, SDK, agent CLI, or wave command.

RIFF Codex producers write derived display artifacts under `.riff-codex-state/dashboard/phases/<id>-<slug>/`, where `<slug>` is the phase title converted to lowercase kebab-case:

- `EXPLAIN.simple.md` describes the demonstrable outcome before implementation in the configured conversation language.
- `EXPLAIN-POST.simple.md` replaces intent with the verified result after completion and briefly includes validation, review, security, and commit evidence when available.

Keep each explanation concrete, jargon-free, and short. The product contract, roadmap, receipts, and RIFF state remain canonical; dashboard files are disposable projections and must never drive execution.

Legacy RIFF projects keep their existing `.planning/phases/**/EXPLAIN*.md` artifacts. The dashboard adapts both layouts to the same view.
