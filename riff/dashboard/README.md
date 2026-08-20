# RIFF Dashboard

The RIFF dashboard is a local, independent, read-only application shared by legacy RIFF and RIFF Codex projects.
It keeps the original multi-project design, project selector, kanban, phase details, plan previews, UX runs, and live refresh.

It doesn't call Claude, Codex, OpenAI, Anthropic, or any other model SDK or agent CLI.
RIFF workflows produce the plain-language explanations before and after a phase; the dashboard only reads them.

## Run

From any initialized RIFF Codex project:

```bash
riff-codex dashboard
```

The command registers the current project in `~/.config/riff-dashboard/registry.json`, installs the dashboard's small Bun dependencies once, reuses an existing dashboard process when available, and opens `http://127.0.0.1:4000`.

The dashboard also reads the legacy RIFF project list from the old framework profile without modifying it.
Projects added or removed in the UI are stored only in the shared dashboard registry.

For dashboard development:

```bash
cd riff/dashboard
bun install
bun run start
```

## Project formats

Legacy RIFF projects are read from:

- `ROADMAP.yaml`
- `STATE.md`
- `.planning/phases/**/EXPLAIN*.md`
- `.uxtest/runs/**`

RIFF Codex projects are read from:

- `ROADMAP.yaml`
- `.riff-state/state.json`
- `.riff-state/events.ndjson`
- `.riff-state/dashboard/phases/<id>-<slug>/EXPLAIN.simple.md`
- `.riff-state/dashboard/phases/<id>-<slug>/EXPLAIN-POST.simple.md`

The Codex state view includes the active wave, next ready phase, last commit and validation, functional and security reviews, security findings in plain language, required human action, recent events, and recorded model routing.

## Producer contract

`$riff:start` writes pre-phase explanations when discovery is confirmed.
`$riff:wave` writes the post-phase explanation after completion.
The canonical contract is [`../references/dashboard.md`](../references/dashboard.md).

If an explanation isn't available yet, the roadmap outcome remains visible and the dashboard tells the user to run RIFF start or wave.
The compatibility generation endpoint returns HTTP 409 and never invokes a model.

## Requirements

- Bun 1.1 or newer
- A modern browser

No AI SDK, provider credentials, or agent CLI is required by the dashboard.
