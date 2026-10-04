---
name: status
description: Report concise RIFF project and wave status from persistent state. Use when the user invokes this skill by name or asks what RIFF is doing next.
---

# Report RIFF status

Run `node .riff-cli/bin/riff.mjs status`. If more detail is requested, read the dashboard snapshot and recent `.riff-data/events.ndjson` entries.

Report the active wave, completed count, next ready phase, parked or blocked work, stale evidence, and any human action. Do not advance the roadmap.
