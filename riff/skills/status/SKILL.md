---
name: status
description: Report concise RIFF project and wave status from persistent state. Use when the user invokes $riff:status or asks what RIFF is doing next.
---

# Report RIFF status

Run `node .riff/bin/riff.mjs status`. If more detail is requested, read the dashboard snapshot and recent `.riff-state/events.ndjson` entries.

Report the active wave, completed count, next ready phase, parked or blocked work, stale evidence, and any human action. Do not advance the roadmap.
