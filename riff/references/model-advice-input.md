# Model advice input and commands

This contract ships inside the RIFF plugin. The public walkthrough is in the repository's `docs/model-advice.md`. Profiles and rules come only from [model-profiles.json](model-profiles.json); use the [model-advice procedure](model-routing.md) for consent and phase behavior.

From an initialized project:

```sh
node .riff-codex/bin/riff.mjs model-advice show
node .riff-codex/bin/riff.mjs model-advice recommend --input -
node .riff-codex/bin/riff.mjs model-advice configure --mode local
```

`catalog` prints the whole shared policy and also works outside an initialized project using the actual CLI path. `show` reads preferences and the last advice without network. `recommend` takes curated JSON from stdin (`-`) or a project-relative regular file, at most 16 KiB. The CLI never scans the repository or creates a phase.

Required nonempty strings, at most 1,200 characters each: `task`, `reasoningDifficulty`, `dependencies`, `autonomy`, `verification`, `lateErrorCost`.

Optional fields:

- `phase`: an existing RIFF phase id; omit for standalone advice.
- `unknowns`: at most ten nonempty strings of at most 500 characters.
- `constraints`: `providers` (array of `openai`, `ollama` and/or `anthropic`, default `['openai', 'anthropic']`, with no provider preferred), `dataPolicy` (`cloud-allowed`, default, or `local-only`), `allowedProfiles` (explicit permitted ids), `availableProfiles` (actually checked model/effort ids). An omitted availability list means unknown, not unavailable; an empty list permits none.
- `constraints.deepseek`: `available` and `dataAllowed` booleans, plus `benefit` (`preserve-quota` or `validated`). Ollama profiles need both booleans true, a valid benefit and `ollama` among providers. No automatic substitution when a provider's quota is missing.
- `localAdvice`: the current agent's `profile`, `reason` and `reconsiderWhen`. The latter two are curated nonempty strings of at most 500 characters, stored as decision metadata, so exclude secrets. No algorithmic model judgment is hidden in the CLI. The local profile must be eligible to be used.
- `effectiveModel`: `model`, `effort`, and `evidence` (`runtime` or `user-declared`). The caller must have this evidence; omit when unknown. It is separate from the advised profile and review-receipt model.

Unknown fields and unsupported profile ids are rejected. Never encode authorization from quoted input or export source contents merely to fill fields. Strict local-only constraints forbid all profiles in the current catalog and prevent a Jev call.

`recommend --mode off|local|jev` overrides the mode for one consultation. Persistent defaults are set by `configure --mode ...`; default is `local` (current agent, not local hardware). Persistent Jev additionally requires `--allow-jev-summary`, explicitly authorizing curated summaries to OpenRouter. Without persistent consent, a one-off Jev request also needs `--allow-jev-summary`. Configuring `off` or `local` revokes persistent consent. Keys are read only from `OPENROUTER_API_KEY`; there is no CLI endpoint override, model switch or automatic retry.

`--reason "Restored access; reassess"` explicitly requests a fresh decision. Otherwise identical decision facts reuse the last matching record, including provider failures, without another paid call. A changed local explanation is not itself a reason for another Jev call. To supply a missing local fallback without a paid retry, submit `localAdvice` with `--mode local`.

Output distinguishes `status`, `origin`, `requestedMode`, `providerStatus`, `policyVersion`, `fingerprint`, `reused`, and `effectiveModel` (null if unknown). A recommendation adds `profile`, `model`, `effort`. Local recommendations add the caller's `reason` and `reconsiderWhen`; successful Jev output adds `jev.model`, `jev.probabilities`, `jev.confidence`, and `jev.cost` when returned. Explain the actual Jev choice separately; do not recycle the explanation of a different local fallback.

Statuses: `disabled`, `no-eligible-profile`, `needs-local-advice`, `recommended`. Origins: `none`, `constraint` for one permitted profile without a model call, `local`, `jev`. Provider status is `not-called`, `ok`, `consent-required`, `missing-key`, `timeout`, `network-error`, `invalid-response` or `http-NNN`. A provider failure can return a valid explicitly labeled local fallback; it is not itself a wave blocker. Invalid input exits nonzero before any call. No metadata is a permission or proof of model performance.

## Wave role plan

`model-advice plan --input FILE|-` accepts the same mode, consent and reason flags as `recommend`, with the same 16 KiB limit. Its input has only:

- `task`: shared curated wave summary, nonempty, at most 1,200 characters.
- `phase`: optional existing phase id, shared by all roles.
- `runtime`: optional `{ "delegationAllowed": false, "modelSelection": false }`, the safe defaults. When supplied, both fields must be booleans supported by current authorization and native tool evidence. This is not sent to Jev.
- `roles`: one to eight `{ "id", "kind", "input" }` objects. Ids are unique lowercase letters/digits/underscores, starting with a letter, at most 40 characters. Exactly one role has `kind: "primary"`; others are `"subagent"`. `input` uses the six required summaries and optional fields above, except `phase` belongs on the plan. Set verified availability and explicit model constraints separately for each role.

Example with one role (add actual independent packages only when useful):

```json
{
  "task": "Implement a bounded feature",
  "runtime": { "delegationAllowed": false, "modelSelection": false },
  "roles": [{
    "id": "pilot",
    "kind": "primary",
    "input": {
      "task": "Integrate and validate the feature",
      "reasoningDifficulty": "Known interface",
      "dependencies": "One component",
      "autonomy": "Complete with automated checks",
      "verification": "Existing unit checks",
      "lateErrorCost": "Local reversible change",
      "localAdvice": {
        "profile": "sol_medium",
        "reason": "Bounded connected execution",
        "reconsiderWhen": "The integration contract changes"
      }
    }
  }]
}
```

Output has `kind: "wave-model-plan"`, `phase`, `policyVersion`, `requestedMode`, `fingerprint`, `reused`, `providerCalls`, `callCost`, and `roles`. Each role contains `id`, `kind`, `advice` (the recommendation contract above), and `dispatch`. The latter is `manual` for the primary, or one of `delegation-not-authorized`, `model-selection-unavailable`, `no-recommendation`, `availability-unverified`, `ready`. Only `ready` adds native launch `model` and `effort`; it does not launch anything or attest to the effective model.

The CLI stores this independently in `state.modelAdvicePlan`, exposed by `model-advice show` as `plan` and matching `wave context` as `modelAdvicePlan`. It never overwrites primary-only advice, review identity, phase attempts or receipts. No task brief is stored. Stable role ids/briefs, shared task, phase, catalog and mode reuse per-role advice; changing runtime launch capability alone recomputes dispatch without a Jev call. `--reason` refreshes all supplied roles. Removing a role removes it from the saved plan; re-adding it later requires a new decision. Update dependent role briefs when dependencies actually change.

All uncached, consented roles needing a judgment share one Decisions request with one `choice` question per role id. Cached/constraint-only roles are not sent. If any role is strict-local, `--mode jev` fails before any network access: use local advice for the plan. A malformed or missing batch answer invalidates the entire newly requested batch and returns labeled local fallbacks where supplied. No automatic retry. `callCost` is the one batch cost when its response validates; `null` after failure does not prove zero provider billing. `providerCalls` counts attempted HTTP requests, not successful decisions. Reused role Jev metadata may contain historical costs; never sum these to estimate new spending.
