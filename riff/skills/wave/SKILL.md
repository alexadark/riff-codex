---
name: wave
description: Build or resume RIFF roadmap phases until each is verified and committed. Use when the user invokes this skill by name, names a RIFF phase or asks to continue the build.
---

# Run a RIFF wave

`riff` means `node .riff-cli/bin/riff.mjs`. The CLI enforces phase order, executed validation, review receipts, retries and completion; when it refuses a step, its message names what is missing.

## Goal

Deliver the selected phase as a complete outcome a user can demonstrate, then continue with the next ready phase until the roadmap is done or a recorded blocker stops the wave.

## Done when, for each phase

- Every `done_when` item from `riff wave context` is true in the running product. If the phase has none, derive them from `outcome` and `demo` and state them in the checkpoint.
- `riff wave validate --run` passed on the staged candidate, and `riff wave review` recorded a passing functional review on that same candidate, plus security for a sensitive phase.
- The reviewed tree is committed, `riff wave complete <phase> --commit HEAD` succeeded and a short `EXPLAIN-POST.simple.md` is written.

On the last phase of the version, before completing it, record one improvement pass with `riff improve record`: zero to three proposals for the project or RIFF, drawn from the whole version. After the last phase, the connected journeys of the whole version are verified, a delivery review from `riff review run --type delivery` is recorded with `riff finish --review FILE`, and `riff finish --check` passes. Fix in-scope defects through an explicit correction phase.

## Verify

- Run each `verify` item. Size the tests to the change under `references/taste/testing.md`: at most five new tests per phase, only for costly behavior or a bug already seen, prune low-value tests in touched files, run related tests while building and the full suite once on the final candidate. Reuse checks that already passed on the same candidate.
- `riff wave validate <phase> --run --command '["npm","test"]' --paths '["src","test"]'`: the command is a JSON argv (no shell) and must finish within 60 seconds. After a correction, `riff wave validate <phase> --rerun` repeats it on the restaged paths.
- For UI work, exercise the journey in a real browser at desktop and narrow widths and attach screenshots to the verification manifest. A build, a DOM snapshot or an HTTP 200 doesn't prove a screen works.
- Verify the assembled result, not only subagent outputs.
- Reviews come from `riff review run`, which runs the configured reviewer (another model family when available) read-only on the frozen candidate and writes the artifact; record each with the command it prints. For a sensitive phase run both in one call, `riff review run --type functional,security`; for a phase batch, `--phase a,b` reviews every phase at once. The CLI runs them in parallel, bounds each with `--timeout-minutes` (default 25) and returns when all are done. Never background a review and poll for it, and never wait on `pgrep -f` or `ps | grep` (they match the waiting shell itself); see `operating-contract.md`. Reviews check product criteria, regressions, reuse, design fidelity and observations. Only if the bridge reports that no reviewer could run, use a fresh native subagent that didn't write the code, say so in the summary, and give its artifact `"reviewedBy": "native-subagent"` with a `"fallbackReason"`.
- Record each tradeoff with `riff wave decision <phase> --note ...` when you make it; reviewers receive these decisions. Only HIGH and CRITICAL findings block. Fix them; record a MEDIUM or lower finding you choose not to fix with `riff wave risk` instead of starting another round. From the 2nd round the reviewer only re-checks the earlier findings and the change since. After 2 failed rounds of one type, `review run` refuses: record what is left with `riff wave risk`, park with `--kind validation-failure` and a plain summary of the competing contracts, and wait for the owner (see `evidence.md`). Never resume such a phase yourself. The owner either resumes it for one more round or stops the rounds; only on that explicit instruction run `riff wave complete <phase> --commit HEAD --accept-risks --reason "<owner decision, quoted>"`, which completes it with the recorded residual risks so dependent phases can start. Never use `--accept-risks` on your own, in `loop` mode included.
- A security finding does not park the phase by itself: correct it and review again, within the same round limit. Defer to `expert_review` only what needs a human security expert's judgment rather than a code fix; apply and document the most conservative interim decision; those findings never block delivery and `riff finish --check` lists them for the final report.

## How to work

1. Run `riff wave sync`, then `riff wave resume`, or `riff wave select --parallel` to see which ready phases can run together, then `riff wave context`. When several phases fit beside each other, run them as one batch following the operating contract: one subagent per phase in its own worktree, one shared candidate, all reviews at once with `riff review run --phase a,b`. On resume, check the checkpoint against current files and keep uncommitted work.
2. Establish the evolution's integration branch before building.
3. Read only what the phase needs: its stories, criteria and contracts linked from `PROJECT.md`, the project taste and relevant topics, applicable lessons, and the security reference for a sensitive phase. Finish missing planning or design before building.
4. Build the whole vertical outcome. Reuse existing components and services and keep behavior outside the phase intact. Delegate by default: explore separate modules in parallel, settle shared contracts yourself, then hand each independent package to a subagent from the table in `references/model-routing.md`, all launched in one message so they run at once. Concurrent writers use separate worktrees; you own integration and RIFF state, and you verify the assembled result.
5. Before freezing the candidate, merge proven lessons into taste and fix pending HIGH or CRITICAL observations; they block completion. Lower ones stay listed in the dashboard.
6. Validate, review, commit, complete, and write the short `EXPLAIN-POST.simple.md`. Run `riff wave checkpoint <phase> --summary ... --next ...` only when you stop before completion.
7. Open or update the draft PR only when publication is authorized; otherwise continue locally. Merge and deployment follow the standing merge authorization in `references/git-delivery.md`: once final gates and required GitHub checks pass, merge into the target base and report the deploy.

In `loop` mode, never stop for a product or technical decision or to ask for a test: take the smallest reversible option, record the assumption and continue. Stop only with a CLI blocker kind. In `guided` mode, pause between phases. Model advice (`riff model-advice`) runs only on an explicit request; a request for advice alone stops before any phase work.

Never relaunch your own host to do the work, create a scheduler, or publish GitHub issues without the `issue` skill.

Report the outcome, commit, checks, PR URL or local-only status, and any real blocker.

End every wave, checkpoint and final report with a TL;DR, without being asked:
- What was done, in two or three plain sentences a non-developer understands. No phase IDs, observation IDs, receipts, candidate hashes or RIFF terms.
- One recommendation: the next thing worth doing and why.
- What the owner must do personally, as concrete actions (who to contact, what to click or test, what to decide, by when if it matters), or "Nothing for you right now." Leave out anything the agent can do itself.

## References

Read when the step needs them, under `.riff-cli/references/`: `operating-contract.md` (states, modes, blocker kinds, delegation, worktrees, recovery, whole-version verification), `evidence.md` (validation, browser evidence, review artifacts), `git-delivery.md`, `model-routing.md` (subagent table), `learning.md` (lessons and improvement proposals), `dashboard.md` (observation triage), `taste.md` and `taste/frontend.md`.
