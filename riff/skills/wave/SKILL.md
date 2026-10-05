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
- The improvement pass is recorded with `riff improve record`: zero to three proposals for the project or RIFF.
- The reviewed tree is committed, `riff wave complete <phase> --commit HEAD` succeeded and `EXPLAIN-POST.simple.md` is written.

After the last phase, the connected journeys of the whole version are verified, a delivery review from `riff review run --type delivery` is recorded with `riff finish --review FILE`, and `riff finish --check` passes. Fix in-scope defects through an explicit correction phase.

## Verify

- Run each `verify` item. Size the tests to the change: the changed behavior and its regression boundary, not an exhaustive matrix. Reuse checks that already passed on the same candidate.
- For UI work, exercise the journey in a real browser at desktop and narrow widths and attach screenshots to the verification manifest. A build, a DOM snapshot or an HTTP 200 doesn't prove a screen works.
- Verify the assembled result, not only subagent outputs.
- Reviews come from `riff review run --type functional|security`, which runs the configured reviewer (another model family when available) read-only on the frozen candidate and writes the artifact; record it with the command it prints. They check product criteria, regressions, reuse, design fidelity and observations, and can run in parallel. Only if the bridge reports that no reviewer could run, use a fresh native subagent that didn't write the code and say so in the summary.
- A security finding never stops the wave: correct it and review again. Defer to `expert_review` only what needs a human security expert's judgment rather than a code fix; apply and document the most conservative interim decision; those findings never block delivery and `riff finish --check` lists them for the final report.

## How to work

1. Run `riff wave sync`, then `riff wave resume` or `riff wave select [phase]`, then `riff wave context`. On resume, check the checkpoint against current files and keep uncommitted work.
2. Establish the evolution's integration branch before building.
3. Read only what the phase needs: its stories, criteria and contracts linked from `PROJECT.md`, the project taste and relevant topics, applicable lessons, and the security reference for a sensitive phase. Finish missing planning or design before building.
4. Build the whole vertical outcome. Reuse existing components and services and keep behavior outside the phase intact. Hand substantial independent packages to subagents with their profile's model and effort; unless advice is off, run `riff model-advice plan --input -` first. Concurrent writers use separate worktrees; you own integration and RIFF state.
5. Before freezing the candidate, merge proven lessons into taste and triage observations yourself: fix confirmed in-scope problems, record decisions with `riff observations review`, never mark an unverified finding resolved.
6. Validate, review, record the improvement pass, run `riff wave checkpoint <phase> --summary ... --next ...`, commit, complete.
7. Open or update the draft PR only when publication is authorized; otherwise continue locally. Merge and deployment are separate actions.

In `loop` mode, never stop for a product or technical decision or to ask for a test: take the smallest reversible option, record the assumption and continue. Stop only with a CLI blocker kind. In `guided` mode, pause between phases. A request for model advice alone stops before any phase work.

Never relaunch your own host to do the work, create a scheduler, or publish GitHub issues without the `issue` skill.

Report the outcome, commit, checks, PR URL or local-only status, and any real blocker.

## References

Read when the step needs them, under `.riff-cli/references/`: `operating-contract.md` (states, modes, blocker kinds), `execution.md` (context, recovery, delegation, worktrees, whole-version verification), `evidence.md` (validation, browser evidence, review artifacts), `git-delivery.md`, `model-routing.md`, `learning.md` (lessons and improvement proposals), `dashboard.md` (observation triage), `taste.md` and `taste/frontend.md`.
