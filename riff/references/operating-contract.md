# RIFF operating contract

The canonical source for persistent state, wave behavior, delegation and recovery. [Evidence](evidence.md) holds the artifact formats, [Git delivery](git-delivery.md) the branch and PR rules, [model routing](model-routing.md) the subagent choice.

## Product artifacts

- `PROJECT.md` is the product contract and dossier index: vocabulary, users, outcomes, constraints, decisions, assumptions, exclusions. It links detailed contracts instead of copying them. A production `start` follows [discovery](discovery.md); scratch work and the `quick` skill stay light.
- `ROADMAP.yaml` is the canonical phase list, shared with the original RIFF framework (which uses root `phase-*` entries; read both, never convert formats). Edit it with targeted changes that keep unknown fields, comments and key order.
- A phase is a vertical outcome a user can demonstrate. It has a priority (`P0` critical blocker, `P1` committed, `P2` normal, `P3` optional), `done_when` (observable conditions in the running product) and `verify` (the checks that prove them). `wave context` hands both over unchanged; `doctor` flags phases without them. Don't predict files or detailed implementation plans.
- A phase may list `owns`: the directories or files only it changes. Phases with `owns` that don't overlap can run in one batch (see below). Shared ground (database schema and migrations, design system, shared types, package manifests) belongs to no phase's `owns`; a phase that changes it either lists it, and then runs alone, or depends on the phase that does.
- `docs/specs/readiness.json` enrolls a project in the complete discovery contract: `discovery check` must pass before a phase activates, a revised dossier needs a new review, and removing the manifest doesn't remove the gate.
- `taste.md` and its topics hold project conventions under [the taste contract](taste.md).
- `.riff-data/state.json` is written only through the CLI; `.riff-data/events.ndjson` is the append-only event stream. The original framework's `.riff` and `.riff-state/` are foreign: never modify them. Only one runtime executes phases at a time.

## Autonomy and blockers

`loop` is the default and governs waves; the `start` and `evolve` skills interview the user in any mode. In `loop`, resolve product and technical ambiguity yourself with the smallest reversible option that preserves the product contract, current behavior, user data, least privilege and external systems; record the assumption and continue through dependency-ready work. A wave stops only for one of these recorded blocker kinds:

- `credentials-or-access`: required credentials or external access are missing.
- `third-party-verification`: a required verification depends on a third party and can't be completed.
- `destructive-target`: a destructive operation is authorized in principle but its exact target can't be identified safely.
- `validation-failure`: a validation or review failed and the permitted correction didn't produce acceptable evidence, or review rounds of one type reached the failed-round limit (default 2) without converging. Park with a summary of the competing contracts so the human can choose. Only the owner resumes a phase parked at the round limit, or completes it with accepted residual risks (`riff wave complete <phase> --commit HEAD --accept-risks --reason "<owner decision>"`, see [evidence](evidence.md)). The agent never runs that completion on its own initiative, in `loop` mode included: only on the owner's explicit instruction, quoting the decision in `--reason`.

`guided` keeps confirmation at product decisions, before freezing shared artifacts, and between phases. A missing promised design is an external dependency: plan everything else, never invent or substitute it unless authorized. In `loop`, a legacy parked or blocked phase whose reason is only a decision resumes automatically with a conservative choice. A phase parked at the review round limit never resumes automatically.

## States and selection

Phase states: `ready`, `active`, `completed`, `parked`, `blocked`, `awaiting_human`, imported `skipped`. A `ready` phase is selectable when every `depends_on` phase is `completed` or `skipped`; selection takes the highest priority, roadmap order breaking ties. `blocked` means an external blocker, not an unmet dependency. The dashboard maps them to Todo, In progress, Done, Blocked and Skipped.

## Wave discipline

1. Read `wave context`, the `PROJECT.md` index, the phase, and only the linked contracts, taste topics and design references the outcome needs. Search for existing components, services and behavior before creating any.
2. Build the complete vertical outcome, delegating independent packages (see below). Compiler, lint and test feedback during construction is normal development feedback.
3. Once the candidate is coherent, stage it; `git write-tree` is its identity. Validate affected behavior once with `wave validate --run`, then get the functional review, plus security for a sensitive boundary. Run both reviews in parallel on the same frozen candidate, and keep working on something that doesn't touch the candidate meanwhile.
4. A concrete validation or review failure permits one targeted correction and one repeat. Name the failure, the cause, the change and the check that distinguishes success. Re-running an unchanged candidate, reopening a review for a better opinion or switching model is not progress and doesn't reset the budget. Park the phase if the correction fails. Record a tradeoff with `wave decision` so later reviews judge it instead of reversing it, and a MEDIUM you choose not to fix with `wave risk` (see [review rounds](evidence.md#review-rounds-decisions-and-convergence)).
5. Triage observations, commit the reviewed tree, complete. Receipts are valid only for their recorded tree: any later change needs fresh affected evidence.
6. Continue with the next ready phase in `loop`; pause in `guided`.

## Phase batches

Independent phases run together instead of one after another:

1. `riff wave select --parallel` lists the batch: the active phases, then the ready phases in priority order whose `owns` don't overlap. A phase without `owns` always runs alone. Activate each with `wave activate <id>`; the CLI refuses a phase that overlaps an active one.
2. Settle anything shared first. Then launch one subagent per phase, in one message, each in its own worktree from the same committed baseline, with its phase contract and owned paths. Each builds and tests its phase and commits on its branch; none touches RIFF state.
3. Integrate every branch into the integration checkout without committing, stage everything: the batch shares one candidate.
4. Run `wave validate <id> --run` for each phase with its own `verify` check; `--paths` covers the files the batch changed. Then run all reviews at once: `riff review run --phase a,b --type functional` (add `security` for sensitive phases, separately if only some are). Each reviewer sees its phase's owned paths and is told about the others.
5. A failure is corrected within the failing phase's budget. The corrected candidate is a new tree, so every phase of the batch needs fresh validation and review; the failed one gets a recheck round.
6. Make one commit, then `wave complete <id> --commit HEAD` for each.

A batch never mixes in a phase that depends on another member, and its members never share owned paths. When integration shows two phases colliding after all, finish them one after another.

## Delegation and worktrees

Delegate by default. When a phase contains independent packages with settled contracts, hand each to a subagent from the [routing table](model-routing.md) instead of writing them yourself. Exploration of separate modules always runs in parallel, read-only. You keep product decisions, architecture, shared contracts, integration, RIFF state and final judgment.

- Settle shared schema, API and component contracts first, under one owner; parallelize what depends on them afterwards.
- Each concurrent writer gets its own Git worktree and branch from a committed baseline that contains the contracts it needs: the phase's integration branch, never `main` by default (a worktree from HEAD lacks uncommitted integration changes). Resolve symlinks first so nobody writes into another checkout.
- Database migrations stay with the integrator: workers don't add migration files or regenerate snapshots, so two of them can't collide in the migration journal.
- Worktrees don't isolate databases, ports, caches or credentials: give writers separate test resources or serialize that work.
- A worker brief names the outcome, worktree path, owned files, contracts, exclusions, acceptance criteria, commands and expected evidence; send the smallest sufficient context.
- Workers return commits or patches with observed checks and open questions. They never activate phases, touch RIFF state, publish or claim the phase complete. Integrate them one at a time, resolve semantic conflicts, then verify the assembled journey: passing worker checks never prove the phase.
- Remove clean task-owned worktrees after integration; keep any with unresolved work.

RIFF state stays per checkout: a worktree that runs a whole phase works on a copy of `.riff-data` (a symlinked state directory is refused). When that phase is done, merge its branch, then bring its record back from the main checkout with `riff state import --from <worktree path> --phase <id>` (try `--dry-run` first). It merges the phase record, findings, improvements, observation decisions, receipts, evidence and validation report; it refuses another repository, an active-phase clash and overwriting a phase already terminal here, and keeps this checkout's plan fields.

## Waiting on long jobs

Never write a wait loop around `pgrep -f`, `ps | grep` or a similar process search: the pattern also matches the waiting shell's own command line, so the loop waits on itself. Agents have sat idle for 40 to 60 minutes this way.

- Reviews: one bounded call, `riff review run --type functional,security`. The CLI runs them in parallel, stops each after `--timeout-minutes` (default 25, or `reviewers.runTimeoutMinutes`), waits for all and prints every record command. Never background a review and poll for it.
- Any other long job: wrap it in `timeout`, start it in the background, keep its PID and `wait "$PID"`, or wait for a file the job writes when it ends. Example: `timeout 20m npm run e2e > .riff-data/e2e.log 2>&1 & pid=$!; wait "$pid"; echo "exit $?"`.
- Another session's validation: don't wait. RIFF refuses concurrent state writes with "RIFF is busy"; retry after it finishes.

## Context and recovery

Use the host's native compaction; never claim to clear context, relaunch your own host or create a scheduler. The one exception is `riff review run`, which calls another host's CLI read-only for the reviewer role.

Before an interruption (you stop with the phase still active), run `wave checkpoint <phase> --summary ... --next ...` with the verified outcome, decisions, remaining risk and next action. After compaction or in a new session, run `wave resume` and check the checkpoint against current files and evidence before trusting it; preserve the worktree and index. A new session must be able to continue from artifacts, state and evidence alone.

## Behavior to preserve

Reuse existing components and services; extend an abstraction only when its contract fits. Never drop features, weaken criteria, delete a failing regression test or loosen authorization to make a phase pass.

## Whole-version verification

After the last phase, verify the full-version criteria and connected journeys (authorization, data lifecycle, integration failure and recovery, design consistency, regressions), reusing phase evidence that covers the same final candidate. Never infer production behavior from a local or sandbox result. Get an independent `delivery` review, record it with `finish --review FILE` and pass `finish --check`. A defect found here goes through an in-scope correction phase (`add-phase`), preserving completed history; new product scope still needs the user.

## Observations at completion

Fix pending HIGH and CRITICAL observations before every phase completion and after final verification; they can't be deferred past a completion gate. Lower observations stay listed in the dashboard and need no triage note to complete a phase; fix them when cheap and in scope, following [observation triage](dashboard.md#end-of-work-observation-triage). The user doesn't judge technical validity. The only exception is `expert_review`, for a finding that needs a human security expert: apply a conservative interim decision, continue, and `finish --check` lists it (see [security](security.md)).

## Reporting

Report the outcome, commit, checks, PR URL or local-only status, blocker and next phase, ending with the TL;DR described in the wave skill; keep receipts internal. GitHub issues exist only through the `issue` skill. Use direct work for a tiny fix and the `quick` skill for a bounded change; RIFF phases are for dependent work that needs persistent progress.
