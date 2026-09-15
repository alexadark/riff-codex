# Technical reference

[Back to the README](../README.md) · [Plain-language workflow](how-it-works.md)

This page keeps installation internals and contributor references out of the getting-started path. The linked framework rules remain authoritative for execution.

## Files and responsibilities

| Path in an application | Purpose |
| --- | --- |
| `PROJECT.md` | Shared product brief, vocabulary, constraints, and scope. |
| `docs/specs/readiness.json` | Explicit complete-discovery enrollment, artifact coverage and content digest inputs. |
| Dossier paths indexed by `PROJECT.md` | Stories, ASCII wireframes, design/tokens, data/architecture, Mermaid sources, risks and verification contracts. |
| `ROADMAP.yaml` | Shared phases, explicit priorities, prerequisites, and exclusions. |
| `taste.md`, `taste/` | Shared project conventions, selective topic loading and frontend direction. |
| `references/taste/stacks/` | Project-owned, source-backed stack research from `learn-stack`. |
| `.riff-codex` | Symlink to the permanent checkout's `riff/` directory. |
| `.agents/skills/riff-codex-*` | Project-local links to RIFF Codex skills. |
| `.codex/hooks.json` | RIFF hooks merged with existing Codex hooks. |
| `.riff-codex-state/config.json` | Project preferences and recorded hook approval. |
| `.riff-codex-state/state.json` | Current phase state, written only through the RIFF CLI. |
| `.riff-codex-state/events.ndjson` | Short append-only event stream. |
| `.riff-codex-state/receipts/` | Validation and review evidence tied to the reviewed Git tree. |
| `.riff-codex-state/dashboard/phases/` | Derived explanations displayed by the dashboard. |

Initialization excludes `.riff-codex-state/` and generated `.uxtest/runs/` through Git's local `info/exclude`. It also installs Git `pre-commit` and `commit-msg` wrappers that chain existing hooks. The shared dashboard registry is at `~/.config/riff-dashboard/registry.json`.

The native plugin definition lives at [`riff/.codex-plugin/plugin.json`](../riff/.codex-plugin/plugin.json). It exposes `$riff:*` skills; it is not a separate execution engine.

## Hook safeguards

RIFF keeps six Codex event handlers and two chained Git hooks. Post-tool hooks collect focused warnings and validation needs; they don't run tests or typechecks after every edit. Validation and candidate-bound review remain workflow checkpoints.

Installation rejects hook directories outside the project or its Git common directory. Existing hook sources are preserved through local backups and atomic wrapper replacement; an external symlink target is never overwritten. State mutations use a process lock.

The pre-commit scan reads filenames and content from the Git index. Unstaged edits or local deletions cannot hide content that would be committed. An index read failure blocks the commit. Private `.env` and `.env.*` files are rejected in any directory; `.example` templates are allowed but still scanned for secrets. Live Stripe secret and restricted keys are checked before tools, after edits, and before commits.

The pre-tool guard recognizes ordinary force-push flags and table-drop commands, alongside its existing destructive patterns. Normal pushes and `--force-with-lease` retain their existing behavior. Path warnings compare complete directory boundaries, so a sibling named `riff-codex` isn't mistaken for `riff`. These are focused heuristic safeguards, not a shell sandbox or a complete secret scanner.

## Terminal commands

Run these from an initialized application, unless noted otherwise.

| Command | Purpose |
| --- | --- |
| `riff-codex init` | Connect the project and choose initial preferences. |
| `riff-codex init --configure` | Revisit preferences. |
| `riff-codex resync` | Refresh managed links and hooks. |
| `riff-codex doctor` | Check installation, configuration, hooks, dependencies, and state. |
| `riff-codex doctor --record-hooks-approved` | Record actual prior approval of the current hooks, then check setup. |
| `riff-codex status` | Print saved project progress. |
| `riff-codex discovery snapshot` | Inspect dossier coverage and its content digest. |
| `riff-codex discovery review --evidence FILE` | Record an independent discovery review for that digest. |
| `riff-codex discovery check` | Verify current dossier and review integrity. |
| `riff-codex wave context [phase-id]` | Read phase references, checkpoint and candidate freshness. |
| `riff-codex wave checkpoint phase-id --summary TEXT --next TEXT` | Persist a phase recovery checkpoint through the CLI. |
| `riff-codex finish --review FILE` | Record the independent review of whole-version verification. |
| `riff-codex finish --check` | Verify local completion and, for enrolled projects, final delivery evidence. |
| `riff-codex dashboard` | Start or attach to the shared local dashboard. |
| `riff-codex dashboard --snapshot` | Print a dashboard data snapshot. |
| `riff-codex --help` | List mechanical commands, including internal wave operations. |

The conversation skill `$riff:wave` orchestrates building. Terminal subcommands such as `riff-codex wave sync` manage its state; they are not a replacement for the conversation skill. There is no `riff-codex next` command.

## Roadmaps, reviews, and autonomy

New Codex roadmaps use `version`, `project`, `phases`, and `out_of_scope`. The parser also accepts existing Claude roadmaps with top-level `phase-*` entries. Preserve the current layout, comments, and unknown fields rather than converting the file unnecessarily.

Ready work is selected by priority after its prerequisites are complete. Review receipts apply only to the exact recorded Git tree. A changed candidate needs fresh evidence. See the [operating contract](../riff/references/operating-contract.md) for the state definitions, retry budget, and completion rules.

`loop` is the default. `guided` retains planning confirmations and pauses between phases. Loop mode records conservative assumptions and continues rather than stopping for ordinary product decisions. Its blocker kinds are `credentials-or-access`, `third-party-verification`, `destructive-target`, and `validation-failure`. External publication still follows the user's explicit authorization.

## Using RIFF with Claude Code

Both frameworks may share `PROJECT.md` and `ROADMAP.yaml` in an application. Claude owns `.riff` and `.riff-state/`; Codex owns `.riff-codex` and `.riff-codex-state/`. Only one runtime should execute a given phase at a time.

Initialization migrates old Codex paths only when both the framework link and configuration prove ownership by this exact Codex checkout. Foreign Claude paths are preserved, and existing hooks are chained. Do not manually rename or overwrite them.

## Dashboard

The dashboard is a separate Bun application. It reads registered projects and their display files; it does not invoke Codex, Claude, an AI API, or wave commands. Its default address is `http://127.0.0.1:4000`.

Read the [dashboard README](../riff/dashboard/README.md) and [projection contract](../riff/references/dashboard.md) for configuration and display-file rules.

## Framework rules and skills

- [Operating contract](../riff/references/operating-contract.md): product sources, selection, reviews, retries, and completion.
- [Project framing](../riff/references/project-framing.md): when a larger project needs deeper discovery.
- [Discovery](../riff/references/discovery.md): complete application dossier, external design handoff and independent readiness review.
- [Execution](../riff/references/execution.md): phase context, worktrees, no-progress handling and final verification.
- [Taste](../riff/references/taste.md): selective conventions, learning and Claude coexistence.
- [Frontend taste](../riff/references/taste/frontend.md): required design skills and rendered acceptance.
- [NowStack](../riff/references/taste/stacks/nowstack.md): starter conventions and version-aware evidence.
- [Security](../riff/references/security.md): sensitive boundaries and required review.
- [Model routing](../riff/references/model-routing.md): when and how to use additional agents.
- [Start](../riff/skills/start/SKILL.md), [onboard](../riff/skills/onboard/SKILL.md), and [wave](../riff/skills/wave/SKILL.md): core workflows.
- [Quick](../riff/skills/quick/SKILL.md), [debug](../riff/skills/debug/SKILL.md), and [add phase](../riff/skills/add-phase/SKILL.md): everyday changes.
- [Map](../riff/skills/map/SKILL.md), [learn stack](../riff/skills/learn-stack/SKILL.md), [incident](../riff/skills/incident/SKILL.md), [deep audit](../riff/skills/deep-audit/SKILL.md), and [promote](../riff/skills/promote/SKILL.md): less frequent workflows.

For framework code changes, the existing test command is `npm test` from the RIFF Codex checkout. Documentation changes need link, content, and rendering checks rather than a full application test run.

## Executed evidence and production lifecycle

See [candidate evidence](../riff/references/evidence.md) for the executable validation, review artifact, screenshot report, promotion, incident ledger and finalization contracts. Reports are generated under `.uxtest/runs/` and exposed by the existing dashboard. A status declaration alone no longer permits phase completion.
