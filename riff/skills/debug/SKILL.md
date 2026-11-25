---
name: debug
description: Diagnose and fix a concrete failure, including a live production incident. Use when the user invokes this skill by name, or for a reproducible bug or a failing check.
---

# Debug a concrete failure

`riff` means `node .riff-cli/bin/riff.mjs`. A bug can't wait for RIFF: without RIFF state this skill runs in degraded mode (see below). As a subagent, hand the state commands back to the main agent (operating contract, "Subagents and workers"). A blocked tool call or commit comes from a RIFF hook (operating contract, "When a RIFF hook blocks").

## Goal

Find the smallest supported cause of the reported failure and fix it, without turning the fix into hardening, compatibility work or an edge-case matrix.

## Done when

- The reported failure is reproduced, its cause is explained with evidence, and a minimal fix is in place when the fix is authorized. A bug report or a request to repair authorizes the fix; only a destructive or external action (data deletion, production change, publication, a message to someone) needs its own approval.
- The failed behavior passes once. A narrow regression check exists only if this case needs one. When there is one, it fails on the code before the fix, shown in the evidence, or the reason it can't be shown is recorded (see Verify).
- Observations are triaged: confirmed in-scope problems fixed, decisions recorded with `riff observations review` (by the main agent, when RIFF state exists), nothing unverified marked resolved, no technical judgment handed to the user.
- Inside an active wave, validation and review evidence went through the wave commands.
- A first occurrence keeps this narrow fix; if it teaches something reusable, it left a verified prevention rule in the project taste, merged before final validation.
- An error already seen (`riff lesson list`, `INCIDENTS.md`, or the history of the code) got the strongest check that stops it, in this order: architecture, types, lint or CI, test, and a taste lesson alone last. The reason each stronger rung was passed over is recorded with `riff lesson record` (format in `learning.md`). One check for this error, not hardening around it.

## Verify

Re-run the failing behavior on the fix. For a UI failure, check the rendered screen in a real browser with the relevant design skills from the frontend taste.

For a regression check, stage the fix and the check, then run `riff lesson prove --file FILE --check '["node","--test","FILE"]' --shows "<failure text>"`: RIFF runs it on the code before the fix (`--before REF`, default `HEAD`), where it must fail with that text, and on the candidate, where it must pass. In an active phase the proof goes to the reviewer. When the old code can't be run, `riff lesson prove --file FILE --cannot "<reason>"` records why. A check recorded by `riff lesson record` is proved there already.

Use the strongest evidence available, in this order: the real browser with screenshots; then the DOM, an HTTP response or JSON CLI output; then logs. When the stronger level is impossible (locked screen, no browser, no access), use the next one and name the level and the reason in the report; never present it as a browser check.

## Regression with several symptoms

When one change broke several things, or the symptoms may share a cause:

1. List each symptom with its reproduction, its evidence and its status (reproduced, fixed, verified).
2. Find the change that introduced it: `git bisect` with a scripted check when one exists, otherwise a keep/revert table commit by commit.
3. Separate the root cause from secondary bugs it exposed; don't stop at the first plausible cause.
4. Fix what protects data and users first, then the rest. Each fix gets its own verification against the symptoms it covers, and every symptom is re-run at the end.

## Delivery

Fix on a dedicated branch, in its own worktree when other work shares the checkout, with one commit per fix. Merge, push and deployment follow the project's delivery policy (`riff delivery`, `git-delivery.md`) and the host's instructions; never claim one that didn't happen.

## Without RIFF state

When `.riff-cli` or `.riff-data/state.json` is missing, start the reply with one line: "RIFF isn't set up in this checkout: debugging in degraded mode, without RIFF state, receipts, observation triage or hook checks." Then debug normally, with these limits:

- Your own checks are the only guardrails: reproduce, fix and re-run the failing behavior as above.
- Keep evidence in the report, or in a folder the brief names; don't create tracked files for it unless asked.
- Skip `riff observations review`, `riff incident log` and `riff lesson`; list in the report what they would have recorded. Run the regression check on the old code by hand (a throwaway worktree at the commit before the fix) and quote its failure.
- Don't install or repair RIFF and don't touch repository plumbing (Git hooks, `core.hooksPath`, `.git/info/exclude`, `.claude/settings.local.json`, `.codex/hooks.json`). Bringing the project into RIFF is a separate `onboard`, after its prerequisite check.

## Production incident

When users or data are affected in production right now, protect people and data first:

- Establish the verified impact, affected users or data, current symptoms and ownership. Preserve evidence in the RIFF state folder (without RIFF state: in the report or the folder the brief names) without exposing secrets.
- Recommend the smallest safe, reversible containment. Ask before a destructive or external change that isn't already authorized. Read the security reference at a security boundary.
- Don't resume normal waves while the incident is unstable.
- Once it is stable, log the confirmed impact, cause and prevention with `riff incident log --evidence FILE` (format in the evidence reference). `INCIDENTS.md` is append-only and keyed by incident id. Review it for recurring causes only when asked.

## References

Read when the step needs them, under `.riff-cli/references/`: `taste.md` and `taste/frontend.md`, `learning.md`, `dashboard.md` (observation triage), `security.md`, `evidence.md`.
