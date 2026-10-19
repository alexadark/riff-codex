# RIFF model routing

The primary model is the one the user selected; RIFF never switches it. This file only says which subagent to launch for a delegated package.

## Subagent table

Under Claude Code, each Anthropic profile of [model-profiles.json](model-profiles.json) is installed as the subagent `riff:<profile>` with its model and effort fixed (`sonnet_5_5_medium` becomes `riff:sonnet-5-5-medium`). Launch the subagent that matches the package:

| Package | Subagent |
| --- | --- |
| Read, locate, extract, classify; output easy to check | `riff:haiku-4-5` or `riff:sonnet-5-5-low` |
| Bounded, well-specified change with stable contracts | `riff:sonnet-5-5-medium` |
| Code spanning data, permissions or integrations | `riff:opus-5-5-medium` |
| Hard diagnosis or architectural trade-off | `riff:opus-5-5-high` |

Under Codex, use the equivalent OpenAI profiles from the catalog (Luna for bounded units, Sol for well-specified work, Astra for dependent or ambiguous work). Raise effort only for a concrete difficulty the lower profile failed on, then come back down. Explicit user model choices and actual runtime availability win over this table. Changing model never resets the correction budget or the review round count, and never weakens a gate. Reviews go to another model family through `riff review run` (`gpt-6-astra`, then `gpt-6.1-sol`, then Claude Opus; configure `reviewers.chain`). Never send OpenAI execution through OpenRouter.

## Optional advice

`riff model-advice` (`show`, `recommend`, `plan`, `configure`) stays available for an explicit advice request or a project that turned it on; its input contract is [model-advice-input.md](model-advice-input.md). A wave doesn't call it by default and never waits on it. Jev (OpenRouter) is called only with explicit consent to send the curated summary. An advice-only request returns the advice and stops before any work.
