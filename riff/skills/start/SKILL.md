---
name: start
description: Shape a new product with repository-aware discovery and a vertical RIFF roadmap. Use when the user invokes $riff:start or asks RIFF to define a new project before building.
---

# Start RIFF discovery

Use Sol Medium for product judgment. Follow `.riff/references/model-routing.md` only when delegation adds value.

1. Confirm `node .riff/bin/riff.mjs doctor` can read the installation. Inspect the repository, documentation, configuration, and environment for facts before asking the user anything. A Luna Light read-only inventory may extract facts mechanically.
2. Maintain four distinct sets: verified facts, user preferences, explicit hypotheses, and open questions. Establish a small shared product vocabulary.
3. At each turn, state the current decision boundary: decisions that can be made now, missing information, fog of war, and explicit exclusions. Ask only a small group of currently decidable product questions. Give one clear recommendation and its reason for every question.
4. Do not ask for technical details Codex can determine. Stop interviewing once remaining uncertainty belongs to later phases.
5. Propose product outcomes and the simplest fitting architecture. Define only real blocking edges. Build a roadmap of demonstrable vertical tracer bullets, dependencies, risks, sensitive boundaries, and explicit exclusions.
6. Present the discovery summary and ask the user to confirm or correct it before freezing artifacts.
7. After confirmation, write `PROJECT.md` and `ROADMAP.yaml`. Make `ROADMAP.yaml` JSON-formatted YAML using the schema in `.riff/references/operating-contract.md`. Do not predict exact files, exhaustive tests, or detailed phase plans.
8. Run `node .riff/bin/riff.mjs wave sync`, check that both artifacts parse, and stop. Do not start implementation unless the user separately invokes `$riff:wave`.

If a truly multi-system architecture decision cannot be resolved normally, use at most one bounded Sol XHigh review and record why.
