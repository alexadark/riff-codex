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
| `.riff-cli` | Symlink to the permanent checkout's `riff/` directory. Projects migrated from the old name keep `.riff-codex` as a compatibility link. |
| `.claude/settings.local.json` | Claude Code: RIFF hooks merged with existing ones, `autoCompactWindow: 400000`, and the `riff` and `riff-cockpit` plugins enabled. Machine-local, excluded from Git. |
| `.agents/skills/riff-codex-*` | Codex: project-local links to the RIFF skills. |
| `.codex/hooks.json` | Codex: RIFF hooks merged with existing Codex hooks. |
| `.riff-data/config.json` | Project preferences, recorded Codex hook approval, and the optional `reviewers` setting. |
| `.riff-data/state.json` | Current phase state, written only through the RIFF CLI. |
| `.riff-data/events.ndjson` | Short append-only event stream. |
| `.riff-data/receipts/` | Validation and review evidence tied to the reviewed Git tree. |
| `.riff-data/reviews/` | Review artifacts written by `riff review run`, before the agent records them. |
| `.riff-data/MAP.md` | Reusable current-system map from `onboard`, when it was saved. |
| `.riff-data/dashboard/phases/` | Derived explanations displayed by the dashboard. |
| `.riff-data/backups/` | Backups made when `resync` moved an older `.riff-codex-state/`. |

Initialization excludes `.riff-data/`, `.riff-cli`, `.claude/settings.local.json` and generated `.uxtest/runs/` through Git's local `info/exclude`. It also installs Git `pre-commit` and `commit-msg` wrappers that chain existing hooks. The shared dashboard registry is at `~/.config/riff-dashboard/registry.json`.

## Hosts

`riff init` and `riff resync` install both hosts in every project. Their files are machine-local and excluded from Git, so switching hosts needs no reinstall.

| | Claude Code | Codex |
| --- | --- | --- |
| Skills | Plugin `riff` from the marketplace in [`riff/.claude-plugin/marketplace.json`](../riff/.claude-plugin/marketplace.json), called as `/riff:wave`. Registered once per machine with `claude plugin marketplace add <checkout>/riff`. | Project links under `.agents/skills/`, or the native plugin [`riff/.codex-plugin/plugin.json`](../riff/.codex-plugin/plugin.json), called as `$riff:wave`. |
| Model profiles | Each Anthropic profile is a subagent in [`riff/agents/`](../riff/agents/), such as `riff:opus-5-5-medium`, with model and effort fixed. | Applied through native launch tools. |
| Hooks | `.claude/settings.local.json` | `.codex/hooks.json`, approved through `/hooks`, unless system-managed. |
| Context injection | `SessionStart` on startup, resume, `clear` and `compact`. RIFF never edits the project's `CLAUDE.md`. | `SessionStart` hook. |
| Compaction | `autoCompactWindow` set to 400,000 tokens; `doctor` warns when it's missing or higher. | Native Codex compaction. |
| Cockpit | Plugin `riff-cockpit` from the same marketplace. | None. |
| Not available | `deep-audit`, which routes to Codex Security. | None. |

The plugin definitions expose skills; they aren't separate execution engines. Newly registered skills are exposed through the normal `riff init` and `riff resync` paths. Existing sessions keep the instructions loaded when they opened, so a newly exposed skill requires a fresh session. There is no separate consumer migration step.

## Hook safeguards

RIFF keeps six event handlers in each host (`SessionStart`, `PreCompact`, `PreToolUse`, `PostToolUse`, `Stop`, `SessionEnd`) and two chained Git hooks. Post-tool hooks collect focused warnings and validation needs; they don't run tests or typechecks after every edit. Validation and candidate-bound review remain workflow checkpoints.

Installation rejects hook directories outside the project or its Git common directory. Existing hook sources are preserved through local backups and atomic wrapper replacement; an external symlink target is never overwritten. State mutations use a process lock.

The pre-commit scan reads filenames and content from the Git index. Unstaged edits or local deletions cannot hide content that would be committed. An index read failure blocks the commit. Private `.env` and `.env.*` files are rejected in any directory; `.example` templates are allowed but still scanned for secrets. Live Stripe secret and restricted keys are checked before tools, after edits, and before commits.

The pre-tool guard recognizes ordinary force-push flags and table-drop commands, alongside its existing destructive patterns. Normal pushes and `--force-with-lease` retain their existing behavior. Path warnings compare complete directory boundaries, so a sibling named `riff-codex` isn't mistaken for `riff`. These are focused heuristic safeguards, not a shell sandbox or a complete secret scanner.

## Terminal commands

Run these from an initialized application, unless noted otherwise.

| Command | Purpose |
| --- | --- |
| `riff init` | Connect the project for both hosts and choose initial preferences. |
| `riff init --configure` | Revisit preferences. |
| `riff resync` | Refresh managed links, hooks and Claude Code settings; move an older `.riff-codex-state/` to `.riff-data/` when no phase is active. |
| `riff doctor` | Check installation, configuration, hooks for both hosts, reviewer CLIs, dependencies, and state. |
| `riff doctor --record-hooks-approved` | Record actual prior approval of the current Codex hooks, then check setup. |
| `riff status` | Print saved project progress. |
| `riff discovery snapshot` | Inspect dossier coverage and its content digest. |
| `riff discovery review --evidence FILE` | Record an independent discovery review for that digest. |
| `riff discovery check` | Verify current dossier and review integrity. |
| `riff review run --type discovery\|functional\|security\|delivery [--phase ID\|--quick]` | Run the reviewer chain read-only on the current candidate, write the artifact to `.riff-data/reviews/`, and print the command that records it. |
| `riff observations list` | List technical and security observations with their status. |
| `riff wave context [phase-id]` | Read phase references, checkpoint and candidate freshness. |
| `riff wave checkpoint phase-id --summary TEXT --next TEXT` | Persist a phase recovery checkpoint through the CLI. |
| `riff finish --review FILE` | Record the independent review of whole-version verification. |
| `riff finish --check` | Verify local completion and, for enrolled projects, final delivery evidence. Lists `expert_review` security points with their interim decisions. |
| `riff dashboard` | Start or attach to the shared local dashboard. |
| `riff dashboard --snapshot` | Print a dashboard data snapshot. |
| `riff --help` | List mechanical commands, including internal wave operations. |

`riff-codex` remains an alias of `riff`. The conversation skill `wave` orchestrates building. Terminal subcommands such as `riff wave sync` manage its state; they aren't a replacement for the conversation skill. There is no `riff next` command.

## Roadmaps, reviews, and autonomy

New roadmaps use `version`, `project`, `phases`, and `out_of_scope`. The parser also accepts existing Claude roadmaps with top-level `phase-*` entries. Preserve the current layout, comments, and unknown fields rather than converting the file unnecessarily.

Ready work is selected by priority after its prerequisites are complete. Review receipts apply only to the exact recorded Git tree. A changed candidate needs fresh evidence. See the [operating contract](../riff/references/operating-contract.md) for the state definitions, retry budget, and completion rules.

`loop` is the default. `guided` retains planning confirmations and pauses between phases. Loop mode records conservative assumptions and continues rather than stopping for ordinary product decisions. Its blocker kinds are `credentials-or-access`, `third-party-verification`, `destructive-target`, and `validation-failure`. External publication still follows the user's explicit authorization.

`evolve` is the conversation skill for product changes that need a current-system impact analysis or several interacting roadmap changes. It checks the installed and onboarded prerequisites, reuses onboarding map findings while checking affected areas for drift, challenges the need, and updates only affected specifications and future phases. It preserves completed and active phase contracts, repoints dependencies before synchronization, and ends at planning readiness. It never activates a wave. A legacy bounded evolution does not silently enroll an existing project; a complete-version request follows the full discovery contract, and an enrolled changed dossier needs a fresh discovery review and check. Use only supported lifecycle states when replacing or deferring pending work.

## Review bridge

`riff review run` is implemented in [`riff/lib/review-bridge.mjs`](../riff/lib/review-bridge.mjs), with prompt templates and the output schema in [`riff/references/review-prompts/`](../riff/references/review-prompts/).

- **Candidate.** `functional` and `security` review the staged tree of the active phase, or the phase named by `--phase`. `--quick` reviews a staged change outside any phase; the result is advisory and prints no record command. `discovery` reviews the dossier digest from `discovery snapshot`. `delivery` reviews the committed `HEAD` tree with a clean worktree.
- **Chain.** By default: `codex:gpt-6-astra`, `codex:gpt-6.1-sol`, then a fresh `claude:opus`. Codex runs as `codex exec --ignore-user-config -s read-only --ephemeral --output-schema`; Claude runs as `claude -p --no-session-persistence --tools Read,Grep,Glob --json-schema`. Effort is `medium`, `high` for `security` and `delivery`.
- **Fallback.** The next reviewer runs only on real unavailability: CLI missing, not logged in, model unavailable, quota or rate limit, timeout, or an error. Output that doesn't match the schema is retried once, then counts as unavailable. A negative review never triggers the next reviewer.
- **Verdict.** A HIGH or CRITICAL finding forces `fail`. The bridge refuses a run on a candidate whose last review of that type failed, and stops a dossier after three failed rounds.
- **Artifact.** `.riff-data/reviews/<type>-<candidate>-<time>.json`, with `reviewer.id` such as `codex:gpt-6-astra@high`, `family`, `sameFamily`, the CLI version, and `skipped` reviewers with their reasons. The printed command (`riff wave review ...`, `riff discovery review --evidence FILE` or `riff finish --review FILE`) is run by the agent; the bridge records nothing itself.
- **Same family.** The builder's family comes from the host running the command (`anthropic` under Claude Code, `openai` under Codex), or from `reviewers.builderFamily`. The dashboard labels a same-family review.
- **Security deferral.** Phase-scoped findings already marked `expert_review` are passed to the reviewer so they aren't reported again unless the candidate makes them worse.

Optional settings in `.riff-data/config.json`. Without a `reviewers` key, the defaults apply; `init` and `resync` don't write one.

```json
"reviewers": {
  "chain": [{ "via": "codex", "model": "gpt-6-astra" }, { "via": "codex", "model": "gpt-6.1-sol" }, { "via": "claude", "model": "opus", "fresh": true }],
  "effort": { "default": "medium", "security": "high", "delivery": "high" },
  "timeoutSeconds": 1200
}
```

`riff doctor` checks that each CLI in the chain answers `--version`, and that Codex is logged in, without calling a model.

## Coexisting with the original RIFF framework

Both frameworks may share `PROJECT.md` and `ROADMAP.yaml` in an application. The original framework owns `.riff` and `.riff-state/`; this one owns `.riff-cli` and `.riff-data/`, plus the older `.riff-codex` and `.riff-codex-state/` names in projects that haven't been migrated yet. Only one should execute a given phase at a time.

Initialization never creates or replaces the original framework's paths. Old paths of this framework are migrated only when the framework link and configuration prove ownership by this checkout. Existing hooks are chained. Don't manually rename or overwrite them.

## Dashboard

The dashboard is a separate Bun application. It reads registered projects and their display files; it doesn't invoke Codex, Claude, an AI API, or wave commands. Its status view shows who reviewed the functional and security work, labels a same-family reviewer, and notes any fallback. Its default address is `http://127.0.0.1:4000`.

Read the [dashboard README](../riff/dashboard/README.md) and [projection contract](../riff/references/dashboard.md) for configuration and display-file rules.

## Framework rules and skills

- [Operating contract](../riff/references/operating-contract.md): product sources, selection, reviews, retries, and completion.
- [Project framing](../riff/references/project-framing.md): when a larger project needs deeper discovery.
- [Discovery](../riff/references/discovery.md): complete application dossier, external design handoff and independent readiness review.
- [Execution](../riff/references/execution.md): phase context, worktrees, no-progress handling and final verification.
- [Taste](../riff/references/taste.md): selective conventions, learning and Claude coexistence.
- [Frontend taste](../riff/references/taste/frontend.md): required design skills and rendered acceptance.
- [NowStack](../riff/references/taste/stacks/nowstack.md): starter conventions and version-aware evidence.
- [Security](../riff/references/security.md): sensitive boundaries, required review, and `expert_review` deferral.
- [Evidence](../riff/references/evidence.md): review artifacts and the review bridge as their normal source.
- [Model routing](../riff/references/model-routing.md): when and how to use additional agents.
- [Start](../riff/skills/start/SKILL.md), [onboard](../riff/skills/onboard/SKILL.md), [evolve](../riff/skills/evolve/SKILL.md) and [wave](../riff/skills/wave/SKILL.md): core workflows.
- [Quick](../riff/skills/quick/SKILL.md), [debug](../riff/skills/debug/SKILL.md), and [add phase](../riff/skills/add-phase/SKILL.md): everyday changes.
- [Status](../riff/skills/status/SKILL.md), [dashboard](../riff/skills/dashboard/SKILL.md), [learn stack](../riff/skills/learn-stack/SKILL.md), [issue](../riff/skills/issue/SKILL.md) and [deep audit](../riff/skills/deep-audit/SKILL.md) (Codex only): less frequent workflows.

For framework code changes, the existing test command is `npm test` from the RIFF checkout. Documentation changes need link, content, and rendering checks rather than a full application test run.

## Executed evidence and production lifecycle

See [candidate evidence](../riff/references/evidence.md) for the executable validation, review artifact, screenshot report, promotion, incident ledger and finalization contracts. Reports are generated under `.uxtest/runs/` and exposed by the existing dashboard. A status declaration alone no longer permits phase completion.

### Historical verification compatibility

If `wave sync` rejects `verificationRequired` on a completed or imported skipped
phase, inspect `wave context <id>`. A `null` verification requirement means the
stored record predates that field, not that verification passed or was waived.
After confirming this legacy boundary, use:

```sh
riff wave sync --preserve-legacy-verification
```

This explicit compatibility mode preserves the entire terminal record and its
receipts without backfilling the unknown field. It ignores only that field's
comparison when absent from a terminal record. All other historical drift,
explicit true/false contracts and active-phase drift still fail. New and pending
phases retain current verification requirements. Because history is unchanged,
use this flag on subsequent syncs of the same legacy project as well. This is
not a way to mark any phase verified or completed.
