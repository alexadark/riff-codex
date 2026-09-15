---
name: start
description: Shape a new product with repository-aware discovery and a vertical RIFF roadmap. Use when the user invokes $riff:start or asks RIFF to define a project before building.
---

# Start RIFF discovery

Use [the discovery contract](../../references/discovery.md) for scope, dossier, design handoff, readiness, review, and stop rules. Use [project framing](../../references/project-framing.md) for the product synthesis that belongs in `PROJECT.md`.

## Scope first

Classify the request before choosing the depth of discovery:

- An explicit request to plan a full application, or a new application intended for production, requires a complete scoped-version dossier.
- Scratch work, a bounded spike, an existing small application with one clear outcome, and `$riff:quick` remain on the light path unless the user explicitly asks for a full application plan.
- A risk probe may use a small isolated prototype. It must not become product implementation or a hidden phase.

Run `node .riff-codex/bin/riff.mjs doctor`. Inspect the configured autonomy mode, the repository, existing `PROJECT.md` and `ROADMAP.yaml`, relevant documentation, and project taste before asking anything. For a production or complete dossier, read `.riff-codex/references/taste.md` and establish or conservatively merge the project-owned `taste.md`; for a UI product, include the applicable frontend direction and design-skill routing. Scratch and light work reads existing taste without bootstrapping a production file set. Read only the taste and stack topics that apply. Inspect existing supporting specifications and preserve them. Determine technical details from the repository, approved template, taste, and user stack; follow the mode boundary below for product questions.

Respect the configured mode. In `loop`, resolve ordinary product and technical ambiguity with the smallest reversible choice, record assumptions, and freeze the conservative summary without a confirmation round. In `guided`, present the summary and ask the user to confirm or correct it before freezing shared artifacts. Loop mode never creates `awaiting_human` for a product or technical decision; only the hard blockers in the discovery and operating contracts may stop it.

## Full dossier

For the complete path, produce the whole version plan before any implementation wave. `PROJECT.md` is the product synthesis and index. `ROADMAP.yaml` is the canonical phase list. Supporting `docs/specs/`, `docs/diagrams/`, or existing project paths may hold detail and must be linked rather than duplicated. The dossier must include:

- numbered stories and observable criteria with stable IDs, and a mapping from stories and criteria to phases;
- journeys, screens, states, responsive ASCII wireframes, and error, empty, recovery, privacy, authorization, and audit behavior where applicable;
- the data model with fields, types, keys, constraints, index reasons, relationships, lifecycle, rights, and tenancy boundaries;
- the smallest architecture and each API or integration contract, with decisions justified by repository, template, stack, taste, and user precedence;
- risks and bounded probes, verification evidence, explicit exclusions, assumptions, and later fog of war;
- real Mermaid `.mmd` source files for architecture, the ER model when data exists, critical-path sequences, and state diagrams when applicable;
- a design handoff package, or a declared external design dependency, mapped to screens, tokens, stories, and criteria.

Every area either has useful linked files or an explicit `not_applicable` reason. Never fill a section with placeholders. If an external reference is promised but not available, continue independent product planning, record the missing artifact as an external dependency, and do not invent or silently substitute a design. Create native RIFF design only when the user authorizes it.

## Freeze and hand off

Both paths write or conservatively update `PROJECT.md` and `ROADMAP.yaml` after the applicable mode boundary. Run `node .riff-codex/bin/riff.mjs wave sync`, check that both artifacts parse, and write each phase's `EXPLAIN.simple.md` projection using `.riff-codex/references/dashboard.md`. Only the complete path creates `docs/specs/readiness.json` with the version 1 area manifest described in the discovery reference, runs the discovery snapshot, obtains an independent review of the complete dossier, applies corrections automatically, and runs the discovery check again. Review evidence is an attestation of the review, not proof that its claims are true.

The complete path stops after the dossier and readiness check. The light path stops after its shared-artifact sync and projections. Neither path activates or starts a wave from `start`; the user must separately invoke `$riff:wave`. Do not publish issues or external artifacts unless separately requested.

Use Astra Medium for product judgment and final acceptance, following `.riff-codex/references/model-routing.md`. Luna XHigh may perform a bounded mechanical inventory or validation with a clear contract. Keep native compaction, do not invoke nested `codex exec`, and preserve unrelated changes.
