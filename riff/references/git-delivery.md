# Git branch and pull request delivery

This is the shared agent workflow for `wave` and `quick`. The agent performs Git and GitHub operations with the available tools; `finish --check` remains a local verifier, not a publication command. [Operating](operating-contract.md) and [evidence](evidence.md) retain phase validation, review and retry authority.

## One branch and PR per coherent change

Use one integration branch and one PR for the agreed evolution or initial version, including all its phases and successive wave invocations. A standalone quick change gets its own branch and PR. Do not create a PR per internal phase or add unrelated work to an existing PR. Evolve only plans; wave establishes the delivery branch before implementation.

Inspect the current branch, worktree, staged paths, remotes, upstream and existing PRs first. Reuse the branch that demonstrably belongs to this change. Otherwise create a `codex/<change>` branch from the verified intended baseline, respecting a user-specified name or starting state. Preserve unrelated work; use an isolated worktree when branch switching would mix concurrent changes. Do not switch another writer's checkout or copy foreign RIFF state. Follow the execution contract for worktree integration.

Resolve the actual repository, remote and target base from explicit instructions or verified repository configuration and GitHub metadata. Never assume `origin` or `main`, create a missing remote, or publish to a fork merely because it is available. Inspect the complete base-to-head diff and commit range for unrelated work before publication. A legacy wave already committed on the base needs a verified task-only branch and diff before it can be delivered; do not reset the user's base or manufacture a trustworthy range.

Record the agreed change scope and phase IDs, branch, repository/remote, target base and known PR URL in the existing wave checkpoint summary/next fields through the CLI. For quick work, report these in the task handoff. Preserve this context on resume; do not add a parallel delivery database or write RIFF state directly. A checkpoint is context, not proof of current GitHub state.

## Authorization and draft publication

An ordinary implementation request authorizes local work and commits. Respect existing explicit delivery authorization for the same change and target; do not ask again separately for push and PR creation. Honor local-only, no-push and other explicit limits. Without publication authorization, continue all local dependency-ready work, prepare the final branch and concise PR description, and report it as ready locally. Ask for publication only when that concrete result is ready; do not interrupt the loop after its first phase for this purpose. Never infer merge or deployment authorization from permission to open a PR.

After the first completed phase with passing required validation and reviews, publish the verified committed head and open a draft PR when authorized. Each later completed phase pushes to that same branch and updates the same PR. Never publish an unreviewed intermediate candidate. A standalone quick change may open a ready PR after its bounded checks and functional review; unrelated roadmap phases do not become quick acceptance criteria.

For every publish or resume:

1. Reconcile current local and remote heads, target base, and PR identity. Query all PR states for the exact repository/head branch and verify base and head repository. Reuse exactly one matching open PR; conflicting, duplicate or closed identities require reconciliation before any new publication. If the PR was merged, verify the merge and scope before assigning new work to a fresh branch. Never automatically reopen a closed PR.
2. Use a normal push of the explicit branch to the verified remote, never force-push. If the remote has unexpected commits or the base changed, inspect and reconcile without rewriting user history; refresh affected checks and reviews when the candidate changes. A retry after an uncertain push first checks the remote head.
3. Re-query before creating a PR, including after a timeout or uncertain creation result. Use a concise behavior-focused title and description with the change, checks, remaining work while draft, and material limitations. With `gh`, use explicit repository, head and base arguments and `--body-file` for multiline text. Preserve collaborator-authored description content when updating it.
4. Read the resulting PR back and verify its repository, head/base, remote head commit, URL, state and draft status. Only then report publication success. Distinguish local validation from GitHub checks; pending or failing remote checks are not passing checks.

The first draft does not need `finish --check`: unfinished phases are expected. At the end of the committed version, complete whole-version verification, required independent delivery review, and `finish --check` before marking the PR ready for review. Do not narrow, skip or remove pending roadmap phases to pass this gate. If a PR covers only a subset while other committed version work remains, keep it draft and report the remaining gate. A changed final candidate needs fresh affected evidence before readiness.

## Continuation and completion

Creating or updating a PR never adds a wave pause. In `loop`, continue dependency-ready phases on the same branch. In `guided`, retain the existing between-phase and product-decision pauses. There is no separate stop-at-PR preference.

When the agreed work and final gates are complete, report the PR as ready for review, with its verified URL and checks. An open PR is not a merge or deployment. Without merge authorization, leave it open. Continue independent authorized work on a separate scoped branch when available. Phases within this PR can depend on its earlier local commits without waiting for a merge. Work that actually requires an earlier PR to be integrated into the target base waits for that integration; do not confuse a completed phase with a merged PR, bypass the dependency, or manufacture a new phase status. This is a delivery scheduling boundary, not a product-decision blocker.

Missing publication access blocks only the external operation; preserve commits and continue independent local work. Report unavailable access or external verification using the existing blocker vocabulary where applicable. Do not undo a completed phase because publication failed, reset its retry budget, or rerun unchanged passing checks merely to retry GitHub delivery. On resume, reconcile Git and PR identity before continuing.
