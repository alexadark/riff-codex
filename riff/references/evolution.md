# Product evolution contract

`$riff:evolve` turns an authorized change to an existing application into a coherent, verifiable plan. It covers both product judgment and the consequences for existing behavior. [Discovery](discovery.md) owns dossier content, design evidence, review, and readiness. [The operating contract](operating-contract.md) owns phase states and execution. This reference adds no separate state or backlog.

## Prerequisites and scope

The brownfield path is explicit: install RIFF, `$riff:map`, `$riff:onboard`, `$riff:evolve`, then `$riff:wave`. Installation exposes commands; map describes the system; onboard establishes the product baseline; evolve plans changes; wave builds them. An already onboarded RIFF application can enter evolve directly. A saved map is useful evidence, not a mandatory freshness certificate or a reason to remap the entire repository.

Require an installed CLI, initialized state, and existing `PROJECT.md` and `ROADMAP.yaml`. Run doctor and status through the CLI. A missing prerequisite returns its explicit next step without creating artifacts or executing another command's work. A missing installation is not repaired inside evolve. Failed RIFF validation follows the operating contract; do not work around it by editing state files.

Classify the user's intent before writing. An exploratory question or a collaborator's unaccepted suggestion can end with a recommendation and no edits. A request to plan a change authorizes targeted product artifacts under the configured autonomy mode. A request only to append one already-understood independent outcome belongs to `$riff:add-phase`; initial product definition belongs to `$riff:start`. Evolve never starts implementation.

## Baseline and product decisions

Read existing product sources, relevant specs, project taste, current CLI status, and a reusable `.riff-codex-state/MAP.md` if available. Check the code and existing tests around the affected paths, including externally visible contracts. Reconcile relevant document drift with evidence. Separate implemented capabilities from verified behavior, user preferences, assumptions, and unavailable external evidence.

Identify the person affected, present problem, desired observable outcome, and smallest useful change. For a batch of requests, group shared outcomes, expose incompatible demands, and prioritize the committed boundary. Do not assume every meeting suggestion must become a phase. Search current phases and criteria first; an already-covered request references that work and creates no duplicate.

Explain consequential alternatives and their practical costs. In loop, make conservative product and technical decisions within the authorized scope, record assumptions, and continue. In guided, ask only unresolved questions that change the product boundary and confirm before freezing it. Explicitly invited discussion can challenge the user's proposed solution; it does not authorize expanding product scope or adding routine approval steps.

## Change analysis

For each material change, connect current behavior to target behavior, evidence, affected stories or criteria, and verification. Cover only relevant areas:

- journeys, screens, error/empty/recovery states, and approved design;
- existing data, lifecycle, migrations and reversibility;
- identity, permissions, tenancy, and private information;
- integration contracts and external effects;
- operational constraints and observable regression checks.

State what existing users retain. Distinguish a necessary migration from authorization to execute one: evolve plans only. Preserve approved design references and link affected additions under the discovery design contract. Missing promised design stays an external dependency; do not claim readiness or invent a substitute. Do not add unrelated refactoring, exhaustive audits, or speculative architecture.

Save useful change analysis in the project's existing spec structure, for example `docs/specs/evolutions/<change>.md`, linked from `PROJECT.md`. It records decisions and old-to-new phase mapping, not a duplicate task list. Existing product and roadmap files remain authoritative. An exploration needs no saved file unless requested.

## Roadmap edits and active work

Inspect current state through the CLI before any live edit. Preserve YAML representation, comments, key order, unknown fields, and stable story/criterion/phase IDs. Never renumber history. Every new phase needs a demonstrable vertical outcome, justified P0-P3 priority, real dependencies, exclusions, and new plus regression criteria.

Use these existing lifecycle rules:

| Existing work | Allowed evolution |
| --- | --- |
| Completed or imported skipped phase | Preserve its definition, status, and evidence. Add a new phase to change delivered behavior. |
| Active phase | Preserve its contract. Keep conflicting proposals outside live product artifacts until a safe execution boundary. |
| Ready phase with no execution history | Revise it in place when it is still the same outcome; otherwise replace it with new stable IDs and record the mapping. |
| Parked, blocked, awaiting-human, or any phase with execution evidence | Preserve it. Reuse the existing execution lifecycle to resolve it before retargeting its work. |

An obsolete, never-started ready phase may be removed only after all dependencies and other live references are updated, its replacement or deferral is explained in the change analysis, and CLI sync accepts the resulting graph. Do not recycle its ID. A deferral beyond the committed version belongs in existing exclusions or later-scope notes with a reason; it must not remain a selectable low-priority phase. Within-version sequencing uses real dependencies. Do not invent `deferred` or `superseded` statuses, mark work completed, or use imported skipped as a cancellation shortcut. Sync preserves existing runtime statuses regardless of roadmap status edits.

The CLI rejects changes to stored normalized contract fields for active and terminal phases and refuses removal of phases with execution history. Unknown roadmap fields and supporting acceptance criteria still require semantic review; sync is not a complete product-diff validator.

If an active phase or another runtime is executing against the affected product contract, do not modify its supporting specs, shared readiness digest, or dependencies underneath it. Continue independent analysis and keep the conflicting proposal outside the live dossier. Report the owning phase and exact scheduling dependency. This is scheduling, not an awaiting-human product decision. Resume planning after that execution reaches a safe boundary, reconcile the baseline again, and only then apply and verify the change. Do not automatically interrupt, park, or rewrite another task. A draft is not ready for wave activation.

For an enrolled project, the readiness digest covers the shared dossier, including the roadmap. Even an otherwise independent addition changes that digest: keep proposed dossier edits outside the live manifest while a wave is active, then apply them at the safe boundary. A draft must not be added to the manifest as if it were already committed scope.

## Readiness and handoff

An enrolled project keeps its enrollment. Update affected source files and story mappings, and list every new supporting document needed for the review in the existing readiness manifest. Reuse unchanged specifications. Follow discovery snapshot → independent discovery review → discovery check for the revised dossier. A fresh review judges the coherence of the revised committed version, including the affected existing behavior; a structural digest check alone is insufficient.

A legacy onboarded application with a bounded request does not silently acquire a full-app dossier requirement. Record the scoped change, impact, criteria, and phase mapping, inspect their coherence, and pass `wave sync`. Report this as light planning verification. An explicit request to plan the complete next application version uses the full discovery contract and explicitly establishes its manifest. Multiple related requests alone do not require documenting unrelated parts of the application in detail; sufficient impact coverage is still required.

Apply targeted artifact edits, run `node .riff-codex/bin/riff.mjs wave sync`, and refresh only affected `EXPLAIN.simple.md` projections following [dashboard](dashboard.md). For enrolled or newly complete dossiers, run the shared review/check lifecycle on the final content. Failed sync or discovery validation means the plan is not ready; correct the scoped issue under the existing retry rules. Never manually repair derived state.

End with a concise change summary, assumptions, phase mapping, checks actually passed, external dependencies or scheduling conflicts, and the next wave invocation when ready. Do not activate phases, create product implementation, publish issues, or deploy. Completed phase receipts stay historical evidence; the revised plan requires current planning evidence.
