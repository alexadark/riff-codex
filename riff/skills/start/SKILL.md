---
name: start
description: Shape a new product with repository-aware discovery and a vertical RIFF roadmap. Use when the user invokes $riff:start or asks RIFF to define a new project before building.
---

# Start RIFF discovery

Use Sol Medium for product judgment. Follow `.riff-codex/references/model-routing.md` only when delegation adds value.

1. Confirm `node .riff-codex/bin/riff.mjs doctor` can read the installation. Read the configured autonomy mode. Inspect the repository, documentation, configuration, and environment for facts before asking the user anything. A Luna Light read-only inventory may extract facts mechanically.
2. Maintain four distinct sets: verified facts, user preferences, explicit hypotheses, and open questions. Establish a small shared product vocabulary.
3. In default `loop` mode, answer currently decidable product and technical questions with the smallest reversible option consistent with the request, repository evidence, existing behavior, data preservation, least privilege, and minimal external effects. Record each assumption and continue without asking. In `guided` mode, ask only a small group of currently decidable product questions and give one clear recommendation with its reason for every question.
4. Do not ask for technical details Codex can determine. Stop interviewing once remaining uncertainty belongs to later phases.
5. Propose product outcomes and the simplest fitting architecture. Define only real blocking edges. Build a roadmap of demonstrable vertical tracer bullets, explicit P0-P3 priorities, dependencies, risks, sensitive boundaries, and explicit exclusions. Justify priority from urgency and consequence; do not assign the same default to every phase.
6. In `loop`, freeze the conservative discovery summary without a confirmation round. In `guided`, present it and ask the user to confirm or correct it.
7. Write `PROJECT.md` and `ROADMAP.yaml` after the mode-specific boundary above. For a new roadmap, use the Codex schema in `.riff-codex/references/operating-contract.md`. If either shared artifact already exists, preserve its content and preserve the roadmap's representation, comments, key order, and unknown fields with targeted edits only. Do not predict exact files, exhaustive tests, or detailed phase plans.
8. Run `node .riff-codex/bin/riff.mjs wave sync`, check that both artifacts parse, then write each phase's `EXPLAIN.simple.md` projection using `.riff-codex/references/dashboard.md`.
9. Stop. Do not start implementation unless the user separately invokes `$riff:wave`.

If a truly multi-system architecture decision cannot be resolved normally, use at most one bounded Sol XHigh review and record why.

In `loop`, stop only for missing credentials or external access, impossible third-party verification, an unidentifiable destructive target, or failed RIFF validation. Never create `awaiting_human` for a product or technical decision. `guided` retains its confirmation behavior.
