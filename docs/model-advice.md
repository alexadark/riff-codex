# Optional model advice

[Back to the README](../README.md) · [Everyday use](usage.md) · [Installation](installation.md)

RIFF can recommend a model profile and reasoning effort before work begins or when the decision context materially changes. The recommendation is advice only. It never changes the model selected in Codex, starts the task, creates a worker, or proves which model is actually running.

## Ask in ordinary language

You do not need to prepare JSON or learn a new RIFF skill. Add an explicit advice request to an existing RIFF workflow:

```text
$riff:start Before planning, advise which model and reasoning effort fit this
product. Show me the advice, but do not start implementation or change models.
I want a small app for planning weekly meals.
```

For an existing phase:

```text
$riff:wave Before continuing the current phase, check whether the saved model
advice still fits. Report any new advice separately and continue with the current
model when the phase is otherwise allowed to proceed.
```

You can also ask for advice without launching work:

```text
Using RIFF's model profiles, advise which model and effort fit the next phase.
Do not execute the phase and do not change the active model.
```

The agent summarizes only the decision constraints that matter, requests or reuses advice, and explains the result. RIFF never scans the repository for this command and never sends repository files, the conversation, secrets, or configuration files automatically.

## Understand the profiles

The versioned [profile catalogue](../riff/references/model-profiles.json) is the source of available profile definitions. The [model-routing contract](../riff/references/model-routing.md) explains how agents use it without duplicating a fixed table. The broad roles are:

- **Luna** for bounded work with clear inputs and observable checks.
- **Sol** for well-scoped work with several connected steps and controlled dependencies.
- **Astra** for coordination, architecture, unresolved decisions, or long runs where later steps depend heavily on earlier judgment.

Use High or XHigh only when a concrete reasoning difficulty justifies it. A long task, large phase, or redesign does not justify higher effort by itself. DeepSeek profiles are conditional: they require explicit Ollama Cloud availability, data permission, and a stated quota or validated-quality benefit. They are not local models and are not included in the Codex subscription.

The catalogue is a decision policy, not a performance leaderboard. Any probabilities returned by Jev describe its decision distribution for the supplied summary. They are not success rates, reliability measurements, or promises of savings.

## Choose a mode

Model-advice preferences belong to one initialized RIFF project. The default is `local`.

| Mode | Behavior |
| --- | --- |
| `off` | No model advice is requested. |
| `local` | The current Codex agent applies the catalogue and supplies its recommendation to RIFF. This is not on-device inference. |
| `jev` | RIFF may send the curated decision summary to Jev through OpenRouter. Persistent use requires explicit summary consent. |

Configure a project in its Terminal:

```sh
riff-codex model-advice configure --mode local
riff-codex model-advice configure --mode jev --allow-jev-summary
riff-codex model-advice configure --mode off
```

Switching to `local` or `off` revokes the persistent Jev-summary permission. A one-off Jev request also needs `--allow-jev-summary` unless that project already has the persistent opt-in.

Jev reads `OPENROUTER_API_KEY` from the agent's environment. Supply it through your existing secret configuration, never in a prompt, input JSON, command flag or committed file. RIFF does not write the credential to project state. A missing credential, timeout, provider error, or invalid response is reported explicitly, with no paid automatic retry and no silent provider change. If the input includes a valid current-agent recommendation, RIFF can return it as a fallback labeled `local`; otherwise the result says that local advice is still needed. RIFF never fabricates a Jev result.

## Advice, reuse, and the model actually used

RIFF stores the project's preference and last advice in its local state. It reuses unchanged results, including a provider failure or a result that still needs local advice, when the phase, structured constraints, and profile-policy version are unchanged. This prevents automatic paid retries. Ordinary file edits do not invalidate the result. Changed decision facts cause reevaluation; to deliberately refresh unchanged facts, such as after restoring credentials, supply a reason:

```sh
riff-codex model-advice recommend --input advice.json --reason "Credentials restored"
```

This reason does not reset a wave's correction or retry budget. If an earlier result needs a current-agent recommendation, add a valid `localAdvice` and use `--mode local`; RIFF can record that advice without a network call. In loop mode, a new recommendation creates no mandatory pause. The agent can continue with the current model when all ordinary RIFF gates allow it and report the recommendation separately.

Advice and actual execution are distinct:

- `profile`, `model`, and `effort` describe the recommendation.
- `effectiveModel` describes the model actually used only when backed by runtime evidence or an explicit user declaration.
- `effectiveModel: null` means the actual model is unknown.

Never infer the active model from the recommendation or from another RIFF state field.

## Advanced CLI

The CLI is primarily for RIFF agents and integrations. `recommend` requires an initialized RIFF project and consumes a curated JSON object of at most 16 KiB from a project-relative file or standard input. File input may not escape the project through an absolute path, `..`, or a symbolic link. It does not scan the repository.

The complete [input and output contract](../riff/references/model-advice-input.md) also ships inside the plugin, so installed skills do not depend on this repository-level guide.

```sh
riff-codex model-advice recommend --input advice.json
riff-codex model-advice recommend --input - --mode local
riff-codex model-advice recommend --input advice.json --mode jev --allow-jev-summary
riff-codex model-advice show
```

`show` prints `{ "preference": ..., "advice": ... }` for the project preference and its last advice. Command-line mode overrides are one-off. Unknown options are rejected.

The smallest useful input contains the six required decision summaries and a recommendation made by the current agent:

```json
{
  "task": "Document an optional CLI feature across the public guides.",
  "reasoningDifficulty": "The behavior is specified; wording and cross-document consistency are the main risks.",
  "dependencies": "Five documentation files must agree with the implemented command contract.",
  "autonomy": "Work is bounded and all publication remains outside this task.",
  "verification": "Check local links, command examples, HTML structure, and the final diff.",
  "lateErrorCost": "Incorrect consent or provider wording could mislead users after adoption.",
  "localAdvice": {
    "profile": "sol_medium",
    "reason": "The contract is fixed and the work is a coordinated but bounded documentation pass.",
    "reconsiderWhen": "The implementation contract changes or verification reveals a cross-cutting inconsistency."
  }
}
```

Each required summary is a nonempty string of at most 1,200 characters. Optional fields are:

- `phase`, naming an existing RIFF phase when present.
- `unknowns`, with up to ten short strings.
- `constraints`, for provider, data, availability, and allowed-profile limits.
- `localAdvice`, the current agent's recommendation. The CLI validates and records it; it does not generate it heuristically.
- `effectiveModel`, only with runtime or user-declared evidence.

Example constraints:

```json
{
  "providers": ["openai"],
  "dataPolicy": "cloud-allowed",
  "allowedProfiles": ["luna_high", "sol_medium", "astra_medium"],
  "availableProfiles": ["sol_medium", "astra_medium"]
}
```

Omitting `availableProfiles` means availability is unknown, not that every profile is available. `dataPolicy: "local-only"` excludes cloud processing, including OpenAI, Jev, and Ollama Cloud, for that data. DeepSeek is admissible only when `providers` includes `ollama` and its constraint supplies all three fields:

```json
{
  "providers": ["ollama"],
  "deepseek": {
    "available": true,
    "dataAllowed": true,
    "benefit": "preserve-quota"
  }
}
```

Inspect the canonical portable catalogue from any folder with the RIFF checkout's direct Node path:

```sh
node /path/to/riff-codex/riff/bin/riff.mjs model-advice catalog
```

The command prints the canonical JSON grid from `riff/references/model-profiles.json`. Consumers should use that output instead of maintaining a second fixed model table.

## What a result means

The JSON result reports `status`, `origin`, `requestedMode`, provider status, availability, policy version, fingerprint, reuse status, and the selected profile, model, and effort when there is one. It also carries `effectiveModel`, which remains `null` when actual execution is unknown. A real Jev response includes its returned identity, probabilities, and declared usage or cost metadata when available.

The current agent interprets a Jev choice separately. It must not attach a contradictory local reason to Jev's selection. Provider failures and policy incompatibilities stay visible instead of being rewritten as successful advice.

Model advice does not add hooks, workers, schedulers, active-project resyncs, or global activation. Updating a framework worktree and enabling the feature in a linked project are separate actions. This documentation describes the feature contract; it is not evidence that a particular checkout has been integrated, activated, or published.
