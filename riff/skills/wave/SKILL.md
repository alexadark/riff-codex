---
name: wave
description: Execute or resume RIFF roadmap phases as autonomous vertical waves. Use when the user invokes $riff:wave, requests a specific RIFF phase, or asks RIFF to continue building.
---

# Run a RIFF wave

Read `.riff-codex/references/taste.md`, the project taste index and only the relevant topics/stack rules. For frontend work, apply `.riff-codex/references/taste/frontend.md`, use the required relevant design skills and obtain rendered browser evidence before visual acceptance. Persist proven reusable conventions before final validation and review; do not create a taste approval queue.

Read `.riff-codex/references/operating-contract.md` and `.riff-codex/references/model-routing.md`. They own autonomy, readiness, review, retry and stop rules. For a large project, load `.riff-codex/references/project-framing.md` and reuse the selected phase's existing stories, criteria, data boundaries, rights, integrations, decisions, and answers before deepening the phase. Load the security reference only for a sensitive phase.

1. Run `node .riff-codex/bin/riff.mjs wave sync`, then `wave resume` or `wave select [phase-id]`; activate the selected phase without bypassing dependencies. Follow `.riff-codex/references/learning.md` to reuse applicable lessons. On recovery, preserve working files and the index; inspect the resume result before doing work. A previously committed, fully verified phase may already have been completed by recovery.
2. Implement the complete demonstrable outcome under the operating contract. Respect one writer per worktree and explicit task boundaries.
3. Merge any proven reusable lesson under the learning contract before freezing the candidate. Read `.riff-codex/references/evidence.md`. Stage the complete candidate, then execute scoped validation with `wave validate --run` and explicit paths. For changed UI journeys, capture real screenshots and attach the verification manifest; link the generated HTML report in the result. A `smoke_test: true` phase requires recorded passing journey evidence; reuse checks already observed for the same candidate and target. Use `wave retry` only for its recorded formal failure, under the contract's retry limit.
4. Stage the complete candidate and record fresh functional and required security receipts with `wave review`. Candidate changes invalidate receipts; the security review command parks credible HIGH or CRITICAL findings automatically.
5. Commit the reviewed tree and run `wave complete <phase> --commit HEAD`. Write `EXPLAIN-POST.simple.md` following the dashboard reference.
6. Continue dependency-ready work in `loop`; pause at the contract's boundaries in `guided`. Report the outcome, commit, checks, blocker and next phase plainly. A PR or collaborator metadata dossier is not required.

Before finishing, perform agent-owned observation triage under `.riff-codex/references/dashboard.md#end-of-work-observation-triage`. Inspect current code and evidence, repair confirmed in-scope problems, and record justified decisions through `observations review`. Do not delegate technical validity judgments to the user or mark unverified findings resolved.

Never invoke nested `codex exec`, create a scheduler, publish GitHub issues without an explicit `$riff:issue` request, or use a public `next` command.
