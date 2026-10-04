---
name: status
description: Report where a RIFF project stands from its saved state. Use when the user invokes this skill by name or asks what RIFF is doing or will do next.
---

# Report RIFF status

`riff` means `node .riff-cli/bin/riff.mjs`. `riff status` only reads the state.

## Goal

Tell the user in a few plain sentences where the project stands, without changing anything.

## Done when

The report covers the active phase, the completed count, the next ready phase, parked or blocked work, stale or invalid reviews, pending findings and any action the user must take. Say "none" where nothing applies.

## Verify

Report only what the commands and files show, never progress remembered from the conversation.

## How to work

1. Run `riff status`; read `riff status --json` for phase statuses, review validity and pending findings.
2. When the user wants more detail, read `riff dashboard --snapshot` and the recent entries of `.riff-data/events.ndjson`.
3. Never select, activate or complete a phase, and never edit the roadmap or the state.
