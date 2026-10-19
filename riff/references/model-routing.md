# RIFF model routing

The primary model is the one the user selected; RIFF never switches it. This file says which subagent to launch for a delegated package, and when not to delegate at all.

## When to delegate

Delegation pays off for two kinds of work: many independent reads (exploring separate modules, gathering sources) and independent, sizeable packages or phases with settled contracts. A chain of dependent steps stays with the primary model, at lower effort if the steps are simple: every subagent rereads context and every report has to be read back.

- No subagent for a few file reads, a small change, or checking your own work.
- Give each subagent a complete brief the first time, and never redo its work yourself.
- Launch independent subagents in one message so they run at once (Claude Code runs up to 20 together).

## Subagent table

Under Claude Code, each Anthropic profile of [model-profiles.json](model-profiles.json) is installed as the subagent `riff:<profile>` with its model and effort fixed (`opus_5_5_low` becomes `riff:opus-5-5-low`). Launch the subagent that matches the package:

| Package | Subagent |
| --- | --- |
| Read, search, extract, classify, summarize; output easy to check | `riff:haiku-5-5-medium` (read-only), `riff:haiku-5-5-high` for long explorations |
| Bounded, well-specified change with stable contracts | `riff:opus-5-5-low` |
| Whole phase, or code spanning data, permissions or integrations | `riff:opus-5-5-medium` |
| Hard diagnosis or architectural trade-off | `riff:opus-5-5-high` |

A stronger model at lower effort usually beats a mid-tier model at higher effort for a similar cost, so Opus Low comes before Sonnet. The Sonnet profiles stay available when Opus capacity runs short. Raise effort before changing model, only for a concrete difficulty the lower profile failed on, then come back down; `riff:opus-5-5-xhigh` is the last step.

Under Codex, use the equivalent OpenAI profiles: Luna High for read-only fan-out and bounded units, Sol (`gpt-6.1-sol`) for well-specified work, Astra Medium for dependent or ambiguous work, Astra High for hard diagnosis.

Explicit user model choices and actual runtime availability win over this table. Changing model never resets the correction budget or the review round count, and never weakens a gate. Reviews keep going to another model family through `riff review run` (`gpt-6-astra`, then `gpt-6.1-sol`, then Claude Opus; configure `reviewers.chain`). Never send OpenAI execution through OpenRouter.

## Planning

The `start` and `evolve` skills run in the primary session: Opus 5.5 Medium fits the interview and a light plan. For a complete production dossier, raise the session to High while settling the data model, architecture and phase split, then the independent artifacts go to `riff:opus-5-5-medium` subagents.

## Optional advice

`riff model-advice` (`show`, `recommend`, `plan`, `configure`) stays available for an explicit advice request or a project that turned it on; its input contract is [model-advice-input.md](model-advice-input.md). A wave doesn't call it by default and never waits on it. Jev (OpenRouter) is called only with explicit consent to send the curated summary. An advice-only request returns the advice and stops before any work.
