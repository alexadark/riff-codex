---
name: status
description: Report where a RIFF project stands from its saved state, as a short summary or the visual dashboard. Use when the user invokes this skill by name, asks what RIFF is doing or will do next, or asks for the dashboard or a visual view of the roadmap and wave state.
---

# Report RIFF status

`riff` means `node .riff-cli/bin/riff.mjs`. `riff status` and the dashboard only read the state; the dashboard never calls a model or an agent CLI. Without RIFF state, answer in one sentence: RIFF isn't set up in this checkout, then name the next step (`onboard` for existing code, `start` for a new product); don't show a CLI error. In a linked worktree without its own state, run the command from the main checkout, `$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")`, read-only, and say whose state you report.

## Goal

Tell the user where the project stands, in a few plain sentences or in the visual dashboard when they ask for it, without changing anything.

## Done when

- Summary: the report covers the active phase, the completed count, the next ready phase, parked or blocked work, stale or invalid reviews, pending findings and any action the user must take. Say "none" where nothing applies.
- Visual view, when the user asks for the dashboard or a visual view: `riff dashboard` registered the project and opened the shared local dashboard of RIFF projects, including those of the original RIFF framework.

## Verify

Report only what the commands and files show, never progress remembered from the conversation. A summary uses the dashboard's columns, `Todo`, `In progress`, `Done`, `Blocked` and `Skipped`, filled from the current `.riff-data/state.json` rather than the roadmap's static status, and shows a priority only when the roadmap declares one.

## How to work

1. Run `riff status`; read `riff status --json` for phase statuses, review validity and pending findings.
2. When the user wants more detail, read `riff dashboard --snapshot` and the recent entries of `.riff-data/events.ndjson`, and explain stale receipts, parked phases, security findings and any action the user must take in plain language.
3. Never select, activate or complete a phase, and never edit the roadmap or the state. The user may record observation decisions through the dashboard's triage form; `.riff-cli/references/dashboard.md` describes their statuses, history and reopening.
