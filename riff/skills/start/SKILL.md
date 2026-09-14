---
name: start
description: Shape a new product with repository-aware discovery and a vertical RIFF roadmap. Use when the user invokes $riff:start or asks RIFF to define a new project before building.
---

# Start RIFF discovery

For production discovery, read `.riff-codex/references/taste.md` and establish the applicable project taste alongside the product artifacts. Reuse existing conventions and confirmed stack references; for a UI product, include the frontend direction and design-skill routing. Keep scratch discovery lightweight.

Use Astra Medium for planning and product judgment. Follow `.riff-codex/references/model-routing.md` for execution and escalation; delegate only when it adds value.

1. Confirm `node .riff-codex/bin/riff.mjs doctor` can read the installation. Read the configured autonomy mode. Inspect the repository, documentation, configuration, and environment for facts before asking the user anything. A Luna XHigh read-only inventory may extract facts mechanically.
2. Classify the scope before choosing the depth of discovery. For a project with several dependent outcomes, multiple user roles or system boundaries, a multi-system integration, or an explicit large-project request, also read `.riff-codex/references/project-framing.md`. Keep a small application with one clear outcome and bounded APEX or quick work on the existing concise path.
3. Maintain four distinct sets: verified facts, user preferences, explicit hypotheses, and open questions. Establish a small shared product vocabulary. For a large project, capture user stories with observable criteria, the relevant entities, relationships, constraints and rights, architecture and integrations with motivated decisions, and a phase map connecting outcomes to stories. Reuse existing answers and project documents; do not repeat a resolved interview branch.
4. In default `loop` mode, answer currently decidable product and technical questions with the smallest reversible option consistent with the request, repository evidence, existing behavior, data preservation, least privilege, and minimal external effects. Record each assumption and continue without asking. In `guided` mode, ask only a small group of currently decidable product questions and give one clear recommendation with its reason for every question.
5. Do not ask for technical details Codex can determine. Stop interviewing once remaining uncertainty belongs to later phases.
6. Propose product outcomes and the simplest fitting architecture. Define only real blocking edges. Build a roadmap of demonstrable vertical tracer bullets, explicit P0-P3 priorities, dependencies, risks, sensitive boundaries, and explicit exclusions. Justify priority from urgency and consequence; do not assign the same default to every phase.
7. In `loop`, freeze the conservative discovery summary without a confirmation round. In `guided`, present it and ask the user to confirm or correct it.
8. Write `PROJECT.md` and `ROADMAP.yaml` after the mode-specific boundary above. For a new roadmap, use the Codex schema in `.riff-codex/references/operating-contract.md`. If either shared artifact already exists, preserve its content and preserve the roadmap's representation, comments, key order, and unknown fields with targeted edits only. Do not predict exact files, exhaustive tests, or detailed phase plans.
9. Run `node .riff-codex/bin/riff.mjs wave sync`, check that both artifacts parse, then write each phase's `EXPLAIN.simple.md` projection using `.riff-codex/references/dashboard.md`.
10. Stop. Do not start implementation unless the user separately invokes `$riff:wave`. Do not publish GitHub issues unless the user separately invokes `$riff:issue`.

If a complex decision remains unresolved at Astra Medium, escalate to a bounded Astra High review, then Astra XHigh only if High is insufficient. Record the concrete reason.

In `loop`, stop only for missing credentials or external access, impossible third-party verification, an unidentifiable destructive target, or failed RIFF validation. Never create `awaiting_human` for a product or technical decision. `guided` retains its confirmation behavior.
