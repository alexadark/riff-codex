# RIFF for Codex

RIFF V0.1 is a small Codex-native product workflow. Codex still reasons, plans, uses tools, delegates, reviews, and implements. RIFF supplies a product contract, a vertical roadmap, deterministic project state, focused safety hooks, model routing, and a read-only dashboard.

## Permanent, symlinked installation

Keep this repository in a permanent folder. The normal installation is run from that checkout:

```sh
cd /permanent/path/to/riff-codex
npm link
cd /path/to/application
riff-codex init
```

`riff-codex init` creates these project-local links and files:

- `.riff` is a symlink to the permanent `riff/` framework folder.
- `.agents/skills/<name>` symlinks expose the same short skills to the project.
- `.riff-state/` holds only this worktree's deterministic state, receipts, and short events. `riff-codex init` adds it to `.git/info/exclude` so receipts never alter the candidate they attest.
- `.codex/hooks.json` merges RIFF handlers with existing Codex hooks.
- Git `pre-commit` and `commit-msg` wrappers chain any hooks already present.

The thin `.codex-plugin/plugin.json` is packaging, not an orchestration runtime. Enabling the local `riff/` plugin supplies the exact namespaced entries such as `$riff:start` and `$riff:wave`. Project symlinks keep the skills inspectable and usable from the permanent checkout. RIFF creates no Claude files.

After initialization, open `/hooks` in Codex and approve the project hooks. Then record that observed approval:

```sh
riff-codex doctor --record-hooks-approved
```

RIFF deliberately does not claim that unapproved hooks are active.

## Main workflows

- `$riff:start` inspects facts, interviews only at the current decision boundary, asks for confirmation, and writes `PROJECT.md` plus JSON-formatted `ROADMAP.yaml`.
- `$riff:onboard` performs the same concise shaping for an existing application.
- `$riff:wave` resumes or selects the next ready vertical phase, validates affected behavior, obtains candidate-bound reviews, commits atomically, persists the result, and loops across independent ready phases.
- `riff-codex dashboard` serves a dependency-free local dashboard at `http://127.0.0.1:7337`.

Use `riff-codex --help`, `riff-codex doctor`, and `riff-codex dashboard --snapshot` for the mechanical interfaces. There is intentionally no `riff-codex next`.

## Persistent artifacts

`PROJECT.md` and `ROADMAP.yaml` belong to the application repository. `ROADMAP.yaml` is JSON-formatted YAML so RIFF can parse it without a YAML dependency. Runtime state is in `.riff-state/state.json`; structured events are in `.riff-state/events.ndjson`; review receipts are in `.riff-state/receipts/`.

Rules live once: wave behavior in `.riff/references/operating-contract.md`, focused security in `.riff/references/security.md`, and model selection in `.riff/references/model-routing.md`.
