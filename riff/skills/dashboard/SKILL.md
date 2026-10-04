---
name: dashboard
description: Open or summarize the RIFF project dashboard. Use when the user invokes this skill by name or asks for a visual view of roadmap and wave state.
---

# Show the RIFF dashboard

Run `node .riff-cli/bin/riff.mjs dashboard` to register the current project and open the shared local dashboard containing Claude RIFF and RIFF Codex projects. Use `--snapshot` when a terminal summary of only the current project is enough.

The dashboard reads producer artifacts and never calls a model or agent CLI. Explain stale receipts, parked phases, security findings, and required human action in plain language. Do not mutate roadmap or wave state from the dashboard. Observation decisions may be saved through its triage form; use `.riff-cli/references/dashboard.md` for statuses, history and reopening.

Use the fixed phase columns `Todo`, `In progress`, `Done`, `Blocked`, and `Skipped`. For RIFF Codex projects, render the current `.riff-data/state.json` status rather than the static roadmap status, and show a priority badge only when the roadmap declares one explicitly.
