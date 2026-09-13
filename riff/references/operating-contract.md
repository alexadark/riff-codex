# RIFF operating contract

This file is the canonical source for persistent state and wave behavior.

## Product artifacts

- `PROJECT.md` is the product contract. It records the shared vocabulary, users, outcomes, constraints, architecture, facts, preferences, assumptions, open questions, fog of war, and explicit exclusions. For a substantial project, `.riff-codex/references/project-framing.md` adds the optional detailed frame: user stories and observable criteria, entities and relationships, constraints and rights, motivated architecture and integration decisions, and a phase map connecting outcomes. Small applications, bounded APEX work, and `$riff:quick` stay lightweight.
- `taste.md`, applicable `taste/` topics and `references/taste/stacks/` preserve project conventions shared with Claude RIFF. Read [the taste contract](taste.md) for selective loading, production seeding, evidence-backed learning and frontend skill/visual acceptance requirements. Taste serves the product goal and does not create another state system or approval queue.
- `ROADMAP.yaml` is a shared product artifact. RIFF Codex creates a root containing `version`, `project`, `phases`, and `out_of_scope`, and also reads Claude RIFF roadmaps with root `phase-*` entries. Never convert an existing roadmap merely to change formats. When a skill makes an authorized change, preserve unknown fields, comments, key order, and the existing representation with a targeted edit.
- Roadmap phases are vertical tracer bullets with a result a user can demonstrate. Do not predict exact files, exhaustive tests, or detailed future implementation plans.
- Every phase has an explicit priority: `P0` for an immediate critical safety or release blocker, `P1` for a high-priority committed outcome, `P2` for normal planned work, and `P3` for a low-priority optional outcome. Never infer a default priority merely for display.
- `.riff-codex-state/state.json` is written only through the RIFF Codex CLI. `.riff-codex-state/events.ndjson` is the short append-only event stream. Claude's `.riff` and `.riff-state/` are foreign and must never be modified or replaced.

Claude RIFF and RIFF Codex may coexist in one project and share `PROJECT.md` and `ROADMAP.yaml`. Only one runtime may execute a phase at a time.

## Autonomy

`loop` is the default. RIFF resolves product and technical ambiguity without a human handoff by choosing the smallest reversible option that preserves the explicit product contract, current behavior, user data, least privilege, existing dependencies, and external systems. It records assumptions, avoids speculative scope, and continues automatically through dependency-ready work.

`guided` preserves confirmation at product decision boundaries, before shared artifacts are frozen, and between phases.

In `loop`, `awaiting_human`, `blocked`, and `parked` are never used for a product or technical decision. A wave may stop only for one of these recorded blocker kinds:

- `credentials-or-access`: required credentials or external access are missing.
- `third-party-verification`: required verification depends on a third party and cannot be completed.
- `destructive-target`: a destructive operation is authorized in principle but its exact target cannot be identified safely.
- `validation-failure`: a RIFF validation or review failed and its permitted correction did not produce acceptable evidence.

Waiting for Claude RIFF to release the shared roadmap is scheduling, not a decision handoff, and must not create `awaiting_human`. Completing the roadmap is a successful terminal condition.

## States and readiness

Valid phase states are `ready`, `active`, `completed`, `parked`, `blocked`, `awaiting_human`, and imported `skipped`. A `ready` phase is selectable only when every `depends_on` phase is terminal (`completed` or imported `skipped`). Automatic selection chooses the highest-priority ready phase, preserving roadmap order as the tie-breaker. A parked phase does not prevent independent ready phases from running. `blocked` means an external or global blocker, not an unmet roadmap dependency.

The dashboard presents those operational states using the fixed columns `Todo`, `In progress`, `Done`, `Blocked`, and `Skipped`: `ready` maps to `Todo`, `active` to `In progress`, `completed` to `Done`, and `parked`, `blocked`, or `awaiting_human` to `Blocked`. `Skipped` remains available for imported legacy roadmaps; RIFF Codex does not silently skip committed phases.

## Wave discipline

1. Read `PROJECT.md`, `ROADMAP.yaml`, current RIFF state, project `taste.md` when present, and only topic/stack references needed by the current boundary. Apply the taste contract for a missing production taste and for frontend skill routing.
2. Resume an active phase, honor an explicit phase, or select the highest-priority ready phase without bypassing dependencies.
3. Build the complete vertical outcome with one writer per worktree. Use read-only research or review subagents only when they add clear value. Give write ownership only when isolated explicitly.
4. Treat compiler, lint, and test feedback encountered during construction as normal development feedback. Once the candidate is coherent, validate only affected behavior once at the appropriate checkpoint and record the result. Hooks accumulate validation needs but never run a full suite or typecheck after each edit.
5. Stage the complete candidate, record its Git tree hash, then obtain a fresh functional review. Load the security reference and obtain a focused security review only for a sensitive boundary.
6. A concrete failure recorded by `wave validate` permits one targeted correction and one repeat of the failed check. Pre-validation development feedback does not consume this retry. Park the phase if the formal correction fails.
7. Commit the reviewed tree atomically, persist completion, then follow dependencies to the next ready phase automatically in `loop`; pause between phases in `guided`.
8. In `loop`, stop only when the roadmap is complete or one of the four permitted blocker kinds applies. In `guided`, preserve the requested confirmation boundaries.

In `loop`, RIFF automatically resumes a legacy parked, blocked, or awaiting-human phase whose reason is only a product or technical decision, recording the conservative choice. A permitted hard blocker resumes only after it is cleared. In `guided`, explicit user instruction may resume the phase. Resumption records the reason, activates the phase, and starts a fresh formal retry budget without bypassing validation or review gates.

Use [candidate evidence](evidence.md) for executed validation, independent review artifacts and generated screenshot reports. Before explicitly authorized final Git delivery, use `finish --check`; this does not itself publish anything.

Receipts are valid only for their recorded Git tree hash. Any candidate change requires staging again and issuing fresh receipts. Do not create a persistent plan unless the operation is exceptionally destructive, ambiguous, multi-system, or genuinely long-running.

## Bounded work and reporting

Use direct work for a tiny correction, explicit APEX for an independent bounded feature, and RIFF for dependent phases requiring persistent progress. Before APEX runs inside a RIFF project, inspect the roadmap and current phase. Work belonging to an active phase retains RIFF receipts and completion gates; an independent change need not create a phase or a second state system.

Review both whether the result satisfies the user's request and whether it follows relevant repository standards. Require observable evidence appropriate to the promised behavior; a build alone does not prove a live workflow. Keep receipts internal. The user-facing report gives the outcome, commit, checks, blocker and next phase. GitHub issues are optional projections created only by an explicit `$riff:issue` request, grouped by useful outcomes without microtasks or historical PR metadata. PR creation, extensive PR metadata and collaborator-specific delivery dossiers are not completion requirements. Follow explicit publication instructions separately.
