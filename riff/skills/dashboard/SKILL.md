---
name: dashboard
description: Open or summarize the RIFF project dashboard. Use when the user invokes this skill by name or asks for a visual view of the roadmap and wave state.
---

# Show the RIFF dashboard

`riff` means `node .riff-cli/bin/riff.mjs`. The dashboard reads the projects' saved state and never calls a model or an agent CLI. Without RIFF state, answer in one sentence: RIFF isn't set up in this checkout, then name the next step (`onboard` for existing code, `start` for a new product); don't show a CLI error. In a linked worktree without its own state, run the command from the main checkout, `$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")`, read-only, and say whose state you report.

## Goal

Show the user the roadmap and wave state, visually or as a short summary, without changing them.

## Done when

- Visual view: `riff dashboard` registered the project and opened the shared local dashboard of RIFF projects, including those of the original RIFF framework.
- Summary of the current project only: `riff dashboard --snapshot` ran and you explained stale receipts, parked phases, security findings and any action the user must take, in plain language.

## Verify

A summary uses the dashboard's columns, `Todo`, `In progress`, `Done`, `Blocked` and `Skipped`, filled from the current `.riff-data/state.json` rather than the roadmap's static status, and shows a priority only when the roadmap declares one.

## How to work

Never change the roadmap or the wave state from the dashboard. The user may record observation decisions through its triage form; `.riff-cli/references/dashboard.md` describes their statuses, history and reopening.
