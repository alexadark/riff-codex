---
name: debug
description: Diagnose and fix a concrete failure, including a live production incident. Use when the user invokes this skill by name, or for a reproducible bug or a failing check.
---

# Debug a concrete failure

`riff` means `node .riff-cli/bin/riff.mjs`. A bug can't wait for RIFF: without RIFF state this skill runs in degraded mode (see below). As a subagent, hand the state commands back to the main agent (operating contract, "Subagents and workers").

## Goal

Find the smallest supported cause of the reported failure and fix it, without turning the fix into hardening, compatibility work or an edge-case matrix.

## Done when

- The reported failure is reproduced, its cause is explained with evidence, and a minimal fix is in place when the fix is authorized. A bug report or a request to repair authorizes the fix; only a destructive or external action (data deletion, production change, publication, a message to someone) needs its own approval.
- The failed behavior passes once. A narrow regression check exists only if this case needs one.
- Observations are triaged: confirmed in-scope problems fixed, decisions recorded with `riff observations review` (by the main agent, when RIFF state exists), nothing unverified marked resolved, no technical judgment handed to the user.
- Inside an active wave, validation and review evidence went through the wave commands.
- A failure that teaches something reusable left a verified prevention rule in the project taste, merged before final validation.

## Verify

Re-run the failing behavior on the fix. For a UI failure, check the rendered screen in a real browser with the relevant design skills from the frontend taste.

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
- Skip `riff observations review` and `riff incident log`; list in the report what they would have recorded.
- Don't install or repair RIFF and don't touch repository plumbing (Git hooks, `core.hooksPath`, `.git/info/exclude`, `.claude/settings.local.json`, `.codex/hooks.json`). Bringing the project into RIFF is a separate `onboard`, after its prerequisite check.

## Production incident

When users or data are affected in production right now, protect people and data first:

- Establish the verified impact, affected users or data, current symptoms and ownership. Preserve evidence in the RIFF state folder (without RIFF state: in the report or the folder the brief names) without exposing secrets.
- Recommend the smallest safe, reversible containment. Ask before a destructive or external change that isn't already authorized. Read the security reference at a security boundary.
- Don't resume normal waves while the incident is unstable.
- Once it is stable, log the confirmed impact, cause and prevention with `riff incident log --evidence FILE` (format in the evidence reference). `INCIDENTS.md` is append-only and keyed by incident id. Review it for recurring causes only when asked.

## References

Read when the step needs them, under `.riff-cli/references/`: `taste.md` and `taste/frontend.md`, `learning.md`, `dashboard.md` (observation triage), `security.md`, `evidence.md`.
