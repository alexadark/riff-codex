---
name: debug
description: Diagnose and fix a concrete failure, including a live production incident. Use when the user invokes this skill or the former incident skill, or for a reproducible bug or a failing check.
---

# Debug a concrete failure

`riff` means `node .riff-cli/bin/riff.mjs`.

## Goal

Find the smallest supported cause of the reported failure and fix it, without turning the fix into hardening, compatibility work or an edge-case matrix.

## Done when

- The reported failure is reproduced, its cause is explained with evidence, and a minimal fix is in place when the fix is authorized.
- The failed behavior passes once. A narrow regression check exists only if this case needs one.
- Observations are triaged: confirmed in-scope problems fixed, decisions recorded with `riff observations review`, nothing unverified marked resolved, no technical judgment handed to the user.
- Inside an active wave, validation and review evidence went through the wave commands.
- A failure that teaches something reusable left a verified prevention rule in the project taste, merged before final validation.

## Verify

Re-run the failing behavior on the fix. For a UI failure, check the rendered screen in a real browser with the relevant design skills from the frontend taste.

## Production incident

When users or data are affected in production right now, protect people and data first:

- Establish the verified impact, affected users or data, current symptoms and ownership. Preserve evidence in the RIFF state folder without exposing secrets.
- Recommend the smallest safe, reversible containment. Ask before a destructive or external change that isn't already authorized. Read the security reference at a security boundary.
- Don't resume normal waves while the incident is unstable.
- Once it is stable, log the confirmed impact, cause and prevention with `riff incident log --evidence FILE` (format in the evidence reference). `INCIDENTS.md` is append-only and keyed by incident id. Review it for recurring causes only when asked.

## References

Read when the step needs them, under `.riff-cli/references/`: `taste.md` and `taste/frontend.md`, `learning.md`, `dashboard.md` (observation triage), `security.md`, `evidence.md`.
