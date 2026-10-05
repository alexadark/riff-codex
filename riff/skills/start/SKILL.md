---
name: start
description: Plan a product before building it, from a light roadmap entry to a complete reviewed dossier, or turn a prototype into a production project. Use when the user invokes this skill or the former promote skill by name, or asks RIFF to define a project before building.
---

# Start a RIFF project

`riff` means `node .riff-cli/bin/riff.mjs`. The CLI checks the readiness manifest, ties the discovery review to the dossier's content, refuses to activate a phase of an enrolled project until `riff discovery check` passes, and refuses a promotion with unresolved active work or missing reviews.

## Goal

Leave the project with a plan the `wave` skill can build from, at the depth the request needs, then stop. Pick the path first:

- Complete dossier: the user explicitly asks for a full application plan, or plans a new application for production.
- Light path: scratch work, a bounded spike, a change for the `quick` skill, or an existing small application with one clear outcome. An explicit full-app request beats a convenient light reading.
- Promotion: the project is scratch-scoped and the user explicitly asks to make it a production project. An ordinary push, deployment, merge, audit or review request isn't a promotion.

A risk probe may use a small isolated prototype; it never becomes product code or a hidden phase.

## Done when

- `PROJECT.md` and `ROADMAP.yaml` are written or conservatively updated, and every phase has `done_when` (observable conditions in the running product) and `verify` (the checks that prove them), sized to the phase.
- `riff wave sync` passed and each phase has its `EXPLAIN.simple.md`.
- Complete path: the whole committed version is planned, each area of `docs/specs/readiness.json` lists useful files or a concrete `not_applicable` reason, a passing independent review covers the current dossier, and `riff discovery check` passes.
- Promotion: `riff promote --apply` succeeded and the scope reads production.
- No phase is active. Building starts only when the user invokes the `wave` skill.

## Verify

- `riff doctor` flags no phase without `done_when` or `verify`.
- The dossier review comes from `riff review run --type discovery`, whose reviewer reads the whole dossier, not a subset; record it with the command it prints. Fix its findings, snapshot again and get a new review, three failed rounds at most before recording a blocker. Its evidence attests what it checked; it doesn't prove the product claims.
- A design reference counts as received only at a verifiable local path or an immutable capture. Until then it stays `pending_external`, and the dossier can't pass.

## How to work

1. Run `riff doctor`, then read the repository, existing `PROJECT.md`, `ROADMAP.yaml`, specs, documentation and taste before asking anything. Settle technical facts from the repository, approved template, taste and stack instead of asking the user.
2. On the complete path or a promotion, establish or conservatively merge the project's `taste.md`, with the frontend direction and design skills for a UI product. On the light path, read existing taste without creating a production file set. Read only the topics that apply.
3. Interview the user about the product, whatever the autonomy mode: the mode governs waves, not product definition. Ask a few questions at a time, in the user's language, about what the sources didn't settle: who the users are and what problem they have, the main journeys and screens, the data and who may see or change it, what this version excludes, how success is judged, and the design reference. Challenge vague or contradictory answers, offer concrete options with a recommendation, and continue until you could write the stories without guessing. Never ask for technical facts the sources settle. On the light path, ask only what's needed to state the outcome.
4. When there is no codebase yet, only an idea, the interview also settles the tech stack: present the realistic options with their trade-offs and a recommendation, NowStack by default when it fits the product, and let the user choose. Read the stack index and the chosen stack's taste file, record the choice as a decision in the dossier, and let the first roadmap phase set it up.
5. Present the summary with its remaining assumptions and let the user confirm or correct it before freezing shared files. From there, write the plan without further questions; only a blocker kind from the operating contract stops the work.
6. Write the plan. `PROJECT.md` is the product synthesis and index, `ROADMAP.yaml` the canonical phase list; detail lives in existing project paths or `docs/specs/` and `docs/diagrams/` and is linked, not copied. Preserve existing specs and unrelated changes. Never write placeholders. If a promised design reference is missing, plan everything else, record it as an external dependency and never invent or substitute a design. Create a RIFF design only when the user authorizes it.
7. Complete path: following the discovery reference, write numbered stories with acceptance criteria, journeys and screens with their states, responsive ASCII wireframes, the data model, the architecture and API contracts, Mermaid diagrams (architecture, database, critical sequences, states), the design handoff, risks and decisions, covering the twelve readiness areas. Run `riff discovery snapshot`, get the review, record it with `riff discovery review --evidence FILE`, fix and repeat until it passes, then run `riff discovery check`.
8. Promotion: run `riff promote` to see the scope and stop if it's already production. Set production boundaries in `PROJECT.md`, `ROADMAP.yaml` and `taste.md`, keeping existing decisions, and resolve active phases and blockers. Stage the candidate, get fresh independent architecture, roadmap and functional reviews, plus security for a sensitive project, then run `riff promote --apply --architecture FILE --roadmap FILE --functional FILE [--security FILE]` and check the scope and `INCIDENTS.md`.

A request for model advice alone stops before discovery; optional advice never switches the primary model or adds a pause in `loop` mode.

Never publish issues or external artifacts unless asked, or relaunch your own host to do the work. Promotion changes the RIFF scope only: it never authorizes a push, merge, deployment or publication, and a later authorized Git finalization runs `riff finish --check` first.

Report the path taken, the files written, the check results, what remains unverified outside the repository, and that building starts with the `wave` skill.

## References

Read when the step needs them, under `.riff-cli/references/`: `discovery.md` (dossier quality bar, design handoff states, readiness manifest, review lifecycle), `project-framing.md` (content of `PROJECT.md` and `ROADMAP.yaml`, light path), `operating-contract.md` (modes, blocker kinds, phase contract), `dashboard.md` (`EXPLAIN.simple.md`), `evidence.md` (promotion review artifacts), `security.md`, `model-routing.md`, `taste.md`, `taste/frontend.md` and `taste/stacks/INDEX.md`.
