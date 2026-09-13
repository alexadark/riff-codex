---
name: wave
description: Execute or resume RIFF roadmap phases as autonomous vertical waves. Use when the user invokes $riff:wave, requests a specific RIFF phase, or asks RIFF to continue building.
---

# Run a RIFF wave

Read `.riff-codex/references/taste.md`, the project taste index and only the relevant topics/stack rules. For frontend work, apply `.riff-codex/references/taste/frontend.md`, use the required relevant design skills and obtain rendered browser evidence before visual acceptance. Persist proven reusable conventions before final validation and review; do not create a taste approval queue.

Read `.riff-codex/references/operating-contract.md` and `.riff-codex/references/model-routing.md`. They own autonomy, readiness, review, retry and stop rules. For a large project, load `.riff-codex/references/project-framing.md` and reuse the selected phase's existing stories, criteria, data boundaries, rights, integrations, decisions, and answers before deepening the phase. Load the security reference only for a sensitive phase.

1. Run `node .riff-codex/bin/riff.mjs wave sync`, then `wave resume` or `wave select [phase-id]`; activate the selected phase without bypassing dependencies.
2. Implement the complete demonstrable outcome under the operating contract. Respect one writer per worktree and explicit task boundaries.
3. Record scoped validation with `wave validate`. Use `wave retry` only for its recorded formal failure, under the contract's retry limit.
4. Stage the complete candidate and record fresh functional and required security receipts with `wave review`. Candidate changes invalidate receipts; credible HIGH or CRITICAL security findings require `wave park`.
5. Commit the reviewed tree and run `wave complete <phase> --commit HEAD`. Write `EXPLAIN-POST.simple.md` following the dashboard reference.
6. Continue dependency-ready work in `loop`; pause at the contract's boundaries in `guided`. Report the outcome, commit, checks, blocker and next phase plainly. A PR or collaborator metadata dossier is not required.

Never invoke nested `codex exec`, create a scheduler, publish GitHub issues without an explicit `$riff:issue` request, or use a public `next` command.
