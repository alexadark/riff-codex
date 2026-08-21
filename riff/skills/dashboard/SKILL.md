---
name: dashboard
description: Open or summarize the read-only RIFF project dashboard. Use when the user invokes $riff:dashboard or asks for a visual view of roadmap and wave state.
---

# Show the RIFF dashboard

Run `node .riff/bin/riff.mjs dashboard` to register the current project and open the shared local dashboard containing legacy RIFF and RIFF Codex projects. Use `--snapshot` when a terminal summary of only the current project is enough.

The dashboard reads producer artifacts and never calls a model or agent CLI. Explain stale receipts, parked phases, security findings, and required human action in plain language. Do not mutate roadmap or wave state from the dashboard.
