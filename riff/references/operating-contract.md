# RIFF operating contract

This file is the canonical source for persistent state and wave behavior.

## Product artifacts

- `PROJECT.md` is the product contract. It records the shared vocabulary, users, outcomes, constraints, architecture, facts, preferences, assumptions, open questions, fog of war, and explicit exclusions.
- `ROADMAP.yaml` is JSON-formatted YAML. Its root contains `version`, `project`, `phases`, and `out_of_scope`. Each phase contains `id`, `title`, `outcome`, `demo`, `priority`, `depends_on`, `blocking_edges`, `risks`, `sensitive`, `exclusions`, and `status`.
- Roadmap phases are vertical tracer bullets with a result a user can demonstrate. Do not predict exact files, exhaustive tests, or detailed future implementation plans.
- Every phase has an explicit priority: `P0` for an immediate critical safety or release blocker, `P1` for a high-priority committed outcome, `P2` for normal planned work, and `P3` for a low-priority optional outcome. Never infer a default priority merely for display.
- `.riff-state/state.json` is written only through the RIFF CLI. `.riff-state/events.ndjson` is the short append-only event stream.

## States and readiness

Valid phase states are `ready`, `active`, `completed`, `parked`, `blocked`, and `awaiting_human`. A `ready` phase is selectable only when every `depends_on` phase is `completed`. A parked phase does not prevent independent ready phases from running. `blocked` means an external or global blocker, not an unmet roadmap dependency.

The dashboard presents those operational states using the fixed columns `Todo`, `In progress`, `Done`, `Blocked`, and `Skipped`: `ready` maps to `Todo`, `active` to `In progress`, `completed` to `Done`, and `parked`, `blocked`, or `awaiting_human` to `Blocked`. `Skipped` remains available for imported legacy roadmaps; RIFF Codex does not silently skip committed phases.

## Wave discipline

1. Read only `PROJECT.md`, `ROADMAP.yaml`, current RIFF state, and references needed by the current boundary.
2. Resume an active phase, honor an explicit phase, or select the first ready phase.
3. Build the complete vertical outcome with one writer per worktree. Use read-only research or review subagents only when they add clear value. Give write ownership only when isolated explicitly.
4. Treat compiler, lint, and test feedback encountered during construction as normal development feedback. Once the candidate is coherent, validate only affected behavior once at the appropriate checkpoint and record the result. Hooks accumulate validation needs but never run a full suite or typecheck after each edit.
5. Stage the complete candidate, record its Git tree hash, then obtain a fresh functional review. Load the security reference and obtain a focused security review only for a sensitive boundary.
6. A concrete failure recorded by `wave validate` permits one targeted correction and one repeat of the failed check. Pre-validation development feedback does not consume this retry. Park the phase if the formal correction fails.
7. Commit the reviewed tree atomically, persist completion, then continue with the next ready phase.
8. Stop only when the roadmap is complete or a genuine global blocker needs the user.

An explicit user instruction may resume a parked, blocked, or awaiting-human phase. Resumption records the reason, activates the phase, and starts a fresh formal retry budget without bypassing validation or review gates.

Receipts are valid only for their recorded Git tree hash. Any candidate change requires staging again and issuing fresh receipts. Do not create a persistent plan unless the operation is exceptionally destructive, ambiguous, multi-system, or genuinely long-running.
