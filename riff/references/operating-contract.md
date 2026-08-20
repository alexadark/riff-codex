# RIFF operating contract

This file is the canonical source for persistent state and wave behavior.

## Product artifacts

- `PROJECT.md` is the product contract. It records the shared vocabulary, users, outcomes, constraints, architecture, facts, preferences, assumptions, open questions, fog of war, and explicit exclusions.
- `ROADMAP.yaml` is JSON-formatted YAML. Its root contains `version`, `project`, `phases`, and `out_of_scope`. Each phase contains `id`, `title`, `outcome`, `demo`, `depends_on`, `blocking_edges`, `risks`, `sensitive`, and `status`.
- Roadmap phases are vertical tracer bullets with a result a user can demonstrate. Do not predict exact files, exhaustive tests, or detailed future implementation plans.
- `.riff-state/state.json` is written only through the RIFF CLI. `.riff-state/events.ndjson` is the short append-only event stream.

## States and readiness

Valid phase states are `ready`, `active`, `completed`, `parked`, `blocked`, and `awaiting_human`. A `ready` phase is selectable only when every `depends_on` phase is `completed`. A parked phase does not prevent independent ready phases from running. `blocked` means an external or global blocker, not an unmet roadmap dependency.

## Wave discipline

1. Read only `PROJECT.md`, `ROADMAP.yaml`, current RIFF state, and references needed by the current boundary.
2. Resume an active phase, honor an explicit phase, or select the first ready phase.
3. Build the complete vertical outcome with one writer per worktree. Use read-only research or review subagents only when they add clear value. Give write ownership only when isolated explicitly.
4. Validate only affected behavior once at the appropriate checkpoint. Hooks accumulate validation needs but never run a full suite or typecheck after each edit.
5. Stage the complete candidate, record its Git tree hash, then obtain a fresh functional review. Load the security reference and obtain a focused security review only for a sensitive boundary.
6. A concrete failure permits one targeted correction and one repeat of the failed check. Park the phase if that correction fails.
7. Commit the reviewed tree atomically, persist completion, then continue with the next ready phase.
8. Stop only when the roadmap is complete or a genuine global blocker needs the user.

Receipts are valid only for their recorded Git tree hash. Any candidate change requires staging again and issuing fresh receipts. Do not create a persistent plan unless the operation is exceptionally destructive, ambiguous, multi-system, or genuinely long-running.
