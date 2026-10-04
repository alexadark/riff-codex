---
name: add-phase
description: Add one justified vertical phase to an existing RIFF roadmap. Use when the user invokes this skill by name or approves a newly discovered product outcome, or when a wave needs a correction phase.
---

# Add a roadmap phase

`riff` means `node .riff-cli/bin/riff.mjs`. The CLI refuses to change or remove a phase with execution history, keeps a second phase from becoming active, and, for an enrolled project, refuses to activate work until the revised dossier has a fresh passing review.

## Goal

Add one already understood, independent outcome to the roadmap as one phase the `wave` skill can build. A request that needs product reconsideration, impact analysis across existing behavior or several interacting roadmap changes belongs to the `evolve` skill; never reduce it to a blind append.

## Done when

- The outcome is in product scope and no existing phase already covers it.
- One vertical, demonstrable phase is added with `done_when`, `verify`, an explicit P0 to P3 priority justified for this phase rather than copied from its neighbors, and only real dependencies, blocking edges, risks, sensitivity and exclusions.
- `riff wave sync` passed and you reported when the phase becomes ready.
- Enrolled project: the dossier's story-to-phase mapping and affected references are updated, a fresh independent review covers the revised digest and `riff discovery check` passes before further work is activated.

## Verify

- `riff doctor` flags no phase without `done_when` or `verify`.
- The roadmap keeps its format, comments, key order and unknown fields: a targeted edit, never a conversion between top-level `phase-*` entries and a `phases` array, never a renumbering of completed phases.

## How to work

1. Read `PROJECT.md`, `ROADMAP.yaml`, `riff status` and the configured mode. On a large project, read the project-framing reference and reuse its stories, criteria, data boundaries, rights, integrations, decisions and earlier answers.
2. When the user invoked the skill and the outcome, priority or criteria are unclear, ask one to three short questions with a recommendation, in either mode. When a wave adds a correction phase, ask nothing.
3. If the outcome would widen the product contract without the user's explicit authorization, keep the existing scope and report that no phase was added; never create `awaiting_human` for it.
4. On a large project, connect the phase to the stories and criteria it advances and detail only the data, permission, integration, recovery and validation boundaries useful now. Name independent work packages inside the phase, but don't plan file by file or activate anything.
5. A defect found by whole-version verification becomes an in-scope correction phase without another product approval; completed phases and their receipts stay untouched.

Stop only for a blocker kind from the operating contract, never for a product or technical choice. `guided` mode keeps its confirmations.

## References

Read when the step needs them, under `.riff-cli/references/`: `project-framing.md`, `evolution.md` (when the request is larger than one phase), `discovery.md` (enrolled dossier review), `operating-contract.md` (modes, blocker kinds, phase contract).
