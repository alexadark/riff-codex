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

On first interactive initialization, RIFF asks five concise questions about project scope, conversation and artifact languages, explanation level, and autonomy. Press Enter to accept the recommended choice. Use `riff-codex init --configure` to revisit these preferences or `--non-interactive` in scripts.

`riff-codex init` creates these project-local links and files without claiming Claude RIFF's namespace:

- `.riff-codex` is a symlink to the permanent `riff/` framework folder.
- `.agents/skills/riff-codex-<name>` symlinks expose inspectable, collision-free project skills.
- `.riff-codex-state/` holds only this worktree's deterministic state, receipts, and short events. `riff-codex init` adds it to `.git/info/exclude` so receipts never alter the candidate they attest.
- `.codex/hooks.json` merges RIFF handlers with existing Codex hooks.
- Git `pre-commit` and `commit-msg` wrappers chain any hooks already present.

The thin `.codex-plugin/plugin.json` is packaging, not an orchestration runtime. Enabling the local `riff/` plugin supplies the exact namespaced entries such as `$riff:start` and `$riff:wave`. Project symlinks keep the skills inspectable and usable from the permanent checkout. RIFF Codex creates or updates only its own runtime, state, hooks, and skill paths.

Claude RIFF and RIFF Codex can be installed in the same project. They share the existing `PROJECT.md` and `ROADMAP.yaml`, while `.riff` and `.riff-state/` remain owned by Claude and `.riff-codex` and `.riff-codex-state/` remain owned by Codex. Run a phase with only one runtime at a time so the shared product roadmap never has competing executors.

Initialization automatically migrates an older RIFF Codex installation only when `.riff` resolves to this exact permanent RIFF Codex checkout and `.riff-state/config.json` independently proves Codex ownership. Foreign Claude `.riff` and `.riff-state/` paths are left byte-for-byte intact, while foreign hooks are preserved and chained. Migration keeps configuration fields, active state, events, receipts, Git-hook chains, and recorded hook approval.

After initialization, open `/hooks` in Codex and approve the project hooks. Then record that observed approval:

```sh
riff-codex doctor --record-hooks-approved
```

RIFF deliberately does not claim that unapproved hooks are active.

## Main workflows

- `$riff:start` inspects facts, interviews only at the current decision boundary, asks for confirmation, and writes `PROJECT.md` plus JSON-formatted `ROADMAP.yaml`.
- `$riff:onboard` performs the same concise shaping for an existing application.
- `$riff:wave` resumes or selects the next ready vertical phase, validates affected behavior, obtains candidate-bound reviews, commits atomically, persists the result, and loops across independent ready phases.
- `riff-codex dashboard` opens the full shared local dashboard at `http://127.0.0.1:4000`. It combines legacy RIFF and RIFF Codex projects through a shared registry while leaving the legacy framework untouched.

Use `riff-codex --help`, `riff-codex doctor`, and `riff-codex dashboard --snapshot` for the mechanical interfaces. There is intentionally no `riff-codex next`.

## Persistent artifacts

`PROJECT.md` and `ROADMAP.yaml` belong to the application repository and are shared with Claude RIFF. RIFF Codex reads both its `version`/`project`/`phases` roadmap format and Claude roadmaps with top-level `phase-*` entries. Synchronization never rewrites a roadmap merely to convert its format, and skills must preserve unknown fields and the existing layout when making an authorized edit. Runtime state is in `.riff-codex-state/state.json`; structured events are in `.riff-codex-state/events.ndjson`; review receipts are in `.riff-codex-state/receipts/`.

Rules live once: wave behavior in `.riff-codex/references/operating-contract.md`, focused security in `.riff-codex/references/security.md`, model selection in `.riff-codex/references/model-routing.md`, and the read-only dashboard projection contract in `.riff-codex/references/dashboard.md`.

The dashboard is an independent Bun application. It doesn't call Codex, Claude, an AI SDK, or a provider API. `$riff:start` writes simple pre-phase explanations and `$riff:wave` writes verified post-phase explanations for the dashboard to display.
