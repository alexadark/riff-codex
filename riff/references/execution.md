# Autonomous execution, context and delegation

Use this contract during waves. [Operating contract](operating-contract.md) owns phase state, retry limits and completion gates; [model routing](model-routing.md) owns model selection. There is one active phase, one integration owner, and no external execution loop.

## Phase context and durable recovery

At each phase boundary, read `wave context [phase-id]`, the `PROJECT.md` index, the selected roadmap phase and only the linked stories, acceptance criteria, data/API contracts, taste topics and design references needed for that outcome. Discover existing components, types, services and tests before assigning implementation. Search for behavior as well as names; one unsuccessful search does not prove that code is absent.

Use native Codex compaction. A focused read does not remove old messages or create a fresh context. RIFF must never claim to clear its own conversation, force a context reset at a phase boundary, or survive a stopped Codex execution through an automatic relaunch. Do not invoke nested `codex exec` or introduce a scheduler. Native independent review agents can use a fresh, bounded context without moving the main task.

Before completion or an interruption, record a checkpoint through the CLI:

```sh
node .riff-codex/bin/riff.mjs wave checkpoint phase-id --summary "Verified outcome, decisions and remaining risk" --next "Next action and references to consult"
node .riff-codex/bin/riff.mjs wave context phase-id
```

The checkpoint includes the candidate identity and technical evidence pointers. Its prose should reference durable decisions, explain any incomplete work, name the intended next action and preserve relevant environment/target distinctions without secrets. Document substantive decisions in the project dossier; a checkpoint is a recovery aid, not a replacement specification. For enrolled projects, completion requires a checkpoint for the current candidate.

After compaction or a new session, use `wave resume` and inspect current files and evidence before trusting a checkpoint. Stale checkpoints are clues, not proof; preserve the worktree and index and reconcile changed facts. A new session must be able to continue from project artifacts, CLI state and evidence without access to the old chat. If those sources are insufficient, reconstruct the missing facts from code and verified evidence rather than inventing history.

## Useful parallelism

Planning may identify independent work packages within a phase. Confirm independence against the actual checkout before delegating. Do not turn every phase into a mandatory multi-agent exercise or execute multiple roadmap phases at once.

- Parallel read-only exploration is useful for separate modules or integrations.
- Parallel implementation is useful only after shared contracts are settled and changes have distinct ownership. Keep tightly coupled schema, API and shared component changes under one owner until their interfaces are stable.
- Functional and security reviews may run concurrently against the same frozen integrated candidate. A reviewer does not edit the candidate while another reviews it.
- Run independent checks concurrently only when their resources are isolated. Integrated journey checks follow integration.

Before substantial delegation, apply the available `efficient-delegation` instructions and RIFF model routing. The primary agent keeps product decisions, architecture, immediate blockers, integration and final judgment. Give each worker the outcome, repository/worktree path, owned files or module, contracts, explicit exclusions, acceptance criteria, available commands and required evidence. Send the smallest sufficient context; do not copy the entire conversation when a bounded handoff suffices.

### Worktree ownership

Use a separate Git worktree and branch for each concurrent implementation writer. Read-only reviewers can share the integration checkout while its candidate remains frozen. Sequential work by one writer needs no extra worktree.

Inspect the worktree baseline and preserve unrelated changes. Use the user's requested starting state; otherwise use a verified committed baseline containing the required contracts. A worktree from HEAD does not contain uncommitted integration changes: integrate or explicitly transfer required contracts before dispatch rather than assume they are present. Resolve project and skill symlinks before edits so a worker cannot write through a link into another checkout or managed source.

Worktrees do not isolate databases, ports, caches, generated shared outputs, cloud accounts or credentials. Allocate separate mutable test resources when needed; otherwise serialize that work. Workers do not activate phases, modify the integration checkout's RIFF state, publish, or claim the whole phase completed.

Workers return bounded commits or patches, observed checks, remaining uncertainties and conflicts. The primary agent reviews and integrates them one at a time, resolves semantic conflicts, verifies the assembled user journey and obtains fresh candidate-bound reviews. Passing worker checks alone never prove the assembled phase. Preserve worktrees with unresolved or uncommitted work; remove only known task-owned clean temporary worktrees after integration when appropriate.

## Preserve behavior and detect lack of progress

Reuse appropriate existing components and services. Extend an existing abstraction when its contract fits; do not duplicate it, silently change other consumers, or force unrelated behavior into it. Document a concrete reason when a distinct component is necessary. Do not drop features, weaken criteria, remove a failing regression test, or loosen authorization to make a phase pass.

Before a retry, name the failure, the evidence supporting a cause, the corrective change and the check that can distinguish success from the same failure. Repeating the same failed command on an unchanged candidate, reopening a review only to obtain a favorable opinion, or renaming a task is not progress. The CLI rejects repeated failed checks/reviews on the same enrolled candidate under its supported comparison; the agent must also recognize semantic repetition. A genuine external transient may be diagnosed separately, but must not be disguised as a code correction.

Keep the existing single formal correction budget. Normal feedback while constructing the first coherent candidate remains development feedback. After formal validation/review, a correction needs a changed, re-staged candidate and affected fresh evidence. Escalate diagnosis under the model-routing contract when useful; do not reset the retry budget merely by resuming, changing models or creating a worktree. Stop with a recorded validation failure if the permitted correction cannot establish the required behavior.

## Whole-version verification

Once every committed phase is complete, check the full-version acceptance criteria and connected journeys, including relevant authorization, data lifecycle, integration failure/recovery, design consistency and regression boundaries. Reuse intact phase evidence when it actually covers the same final candidate and target; perform the remaining cross-phase checks. Never infer production behavior from a local or sandbox result.

The agent executes these checks and handles corrections; the user is not the tester or a routine approval gate. A final independent reviewer inspects the observed results, final code, product criteria and pending observations. Record a `delivery` review with `finish --review FILE`, then run `finish --check` for enrolled projects; see [evidence](evidence.md). The receipt is an integrity-checked attestation, not automatic proof that a journey was exercised.

If integration verification reveals a defect after phases have completed, preserve their historical receipts. Add a justified in-scope correction phase under `add-phase`, update affected dossier contracts, renew discovery review if its digest changed, then use the normal validation/review/completion path. Recheck only impacted final scenarios after correction. New product scope still needs user authorization. A required external design, credential or third-party verification that is unavailable remains a real blocker; do not invent success or silently narrow the version.

Follow [Git delivery](git-delivery.md) to mark the verified evolution PR ready for review after final gates pass. Creating or updating its draft during earlier phases does not interrupt loop execution. GitHub publication, merge and deployment status must be verified separately from local evidence.
