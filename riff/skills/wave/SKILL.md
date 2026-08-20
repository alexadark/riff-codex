---
name: wave
description: Execute or resume RIFF roadmap phases as autonomous vertical waves. Use when the user invokes $riff:wave, requests a specific RIFF phase, or asks RIFF to continue building.
---

# Run an autonomous wave loop

Read `.riff/references/operating-contract.md`. Read `.riff/references/security.md` only when the selected phase is sensitive. Use `.riff/references/model-routing.md` only if delegation is useful.

1. Run `node .riff/bin/riff.mjs wave sync`, then `wave resume` or `wave select [phase-id]`. Activate the selected phase.
2. Build its complete demonstrable outcome. Keep one writer per worktree. Research and review subagents are read-only unless isolated ownership is explicit.
3. Validate only affected behavior once. Record it with `wave validate`. After a concrete failure, use `wave retry` for one targeted correction and repeat only the failed check. Park the phase if it still fails.
4. Perform a fresh functional review. For a sensitive boundary, perform a focused security review in plain language. A credible HIGH or CRITICAL finding must use `wave park`.
5. Stage the complete candidate before recording receipts. Record functional and, when required, security receipts with `wave review`. Any later candidate change invalidates them.
6. Create one atomic commit. Run `wave complete <phase> --commit HEAD`; this verifies the commit tree matches the receipts.
7. Continue automatically with the next ready independent phase. Stop only when the roadmap is complete or a genuine global blocker requires the user. Use `await`, `block`, or `park` with a concrete reason.

Never invoke nested `codex exec`, create a scheduler, or use a public `next` command.
