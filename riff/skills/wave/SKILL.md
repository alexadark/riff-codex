---
name: wave
description: Execute or resume RIFF roadmap phases as autonomous vertical waves. Use when the user invokes $riff:wave, requests a specific RIFF phase, or asks RIFF to continue building.
---

# Run an autonomous wave loop

Read `.riff-codex/references/operating-contract.md` and `.riff-codex/references/model-routing.md`. Read `.riff-codex/references/security.md` only when the selected phase is sensitive.

Apply the configured autonomy mode throughout the wave. In default `loop` mode, resolve product and technical ambiguity with the smallest reversible choice that preserves the product contract, existing behavior, data, permissions, and external systems. Record the assumption and continue without asking. In `guided` mode, keep confirmation at product decision boundaries and between phases.

1. Run `node .riff-codex/bin/riff.mjs wave sync`, then `wave resume` or `wave select [phase-id]`. The CLI selects the highest-priority ready phase in roadmap order and never bypasses dependencies. Activate it. If Claude RIFF is currently executing a shared roadmap phase, wait without creating an `awaiting_human` decision handoff.
2. Build its complete demonstrable outcome. Keep one writer per worktree. Research and review subagents are read-only unless isolated ownership is explicit. When the phase itself is a cross-surface design system or major visual redesign, apply the root Sol XHigh exception from the model-routing reference.
3. Treat compiler, lint, and test feedback encountered while building as normal development feedback. Once the candidate is coherent, validate only affected behavior once and record it with `wave validate`. Use `wave retry` only after `wave validate` recorded a concrete failure for this phase. Apply one targeted correction and repeat only the failed check. Park the phase if that formal retry still fails.
4. Perform a fresh functional review. For a sensitive boundary, perform a focused security review in plain language. A credible HIGH or CRITICAL finding must use `wave park`.
5. Stage the complete candidate before recording receipts. Record functional and, when required, security receipts with `wave review`. Any later candidate change invalidates them.
6. Create one atomic commit. Run `wave complete <phase> --commit HEAD`; this verifies the commit tree matches the receipts. Write its `EXPLAIN-POST.simple.md` projection using `.riff-codex/references/dashboard.md`.
7. In `loop`, continue automatically with the next ready independent phase. Do not use `await`, `block`, or `park` for a product or technical decision. The only permitted stops are missing credentials or external access (`--kind credentials-or-access`), impossible third-party verification (`--kind third-party-verification`), an unidentifiable destructive target (`--kind destructive-target`), or a failed RIFF validation or review (`--kind validation-failure`). Always give a concrete reason. In `guided`, pause between phases and retain the existing confirmation flow.

In `loop`, automatically resume a legacy parked, blocked, or awaiting-human phase when its reason is only a product or technical choice, recording the conservative decision with `wave resume <phase> --reason "..."`. Resume a permitted hard blocker only after it is actually cleared. In `guided`, wait for explicit user authorization. Resumption starts a fresh formal retry budget and never weakens validation or review gates.

Never invoke nested `codex exec`, create a scheduler, or use a public `next` command.
