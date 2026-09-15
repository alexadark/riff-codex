---
name: evolve
description: Challenge and plan changes to an existing onboarded RIFF product, including interacting requests and roadmap revisions. Use for $riff:evolve or an explicit request to replan an existing RIFF application; not for initial onboarding, a simple phase append, or implementation.
---

# Evolve an existing product

Use [the evolution contract](../../references/evolution.md) for prerequisites, impact analysis, roadmap preservation, and the planning handoff. Reuse [discovery](../../references/discovery.md) for dossier content and readiness, and [project framing](../../references/project-framing.md) for product synthesis. Do not run initial discovery again for unaffected behavior.

Run `node .riff-codex/bin/riff.mjs doctor` and `node .riff-codex/bin/riff.mjs status` when installed. Require existing `PROJECT.md`, `ROADMAP.yaml`, and initialized RIFF state. If a prerequisite is missing, report the next explicit step in installation → `$riff:map` → `$riff:onboard` → `$riff:evolve` → `$riff:wave`; do not install, map, or onboard automatically. Inspect the actual baseline and CLI state before changing shared artifacts.

Distinguish an exploration request from authorization to revise the plan. A collaborator's suggestion is input, not automatically a committed feature. Exploration returns options and consequences without changing project artifacts or state. Authorized evolution supports one request or several related requests: identify the underlying problem, users, outcome, competing requests, smallest useful scope, and exclusions before proposing phases. Check whether existing work already covers the outcome.

Challenge assumptions that materially affect the product. In `loop`, resolve ordinary ambiguity conservatively and record the decision without a confirmation round. In `guided`, ask only consequential product questions that repository evidence cannot answer and confirm the revised boundary before writing it. Honor an explicitly requested product discussion; do not turn it into a technical interview or mandatory approval queue.

Read the project's taste and only the applicable shared taste, stack, design, and verification references. Reuse a saved map after checking affected code for drift. Explain current versus proposed behavior and consequences for existing users, data, permissions, journeys, integrations, and recovery. Mark evidence, inference, and unresolved external dependencies distinctly. Define observable criteria for both the new outcome and affected existing behavior.

Revise only affected product and specification content and pending roadmap work. Preserve completed and active contracts, historical evidence, stable IDs, and the original YAML representation and unknown fields. Apply the supported pending replacement rules in the evolution contract; never invent lifecycle statuses. An active-work conflict stays a planning draft outside the live dossier until the owning execution reaches a safe boundary; do not interrupt another task or report readiness prematurely.

After the authorized edits, synchronize through `node .riff-codex/bin/riff.mjs wave sync` and refresh affected phase explanations under the [dashboard contract](../../references/dashboard.md). For an enrolled dossier, update affected manifest references, obtain an independent review of the revised candidate, and pass `discovery check`. For an explicit complete-version planning request, establish that same contract. A bounded legacy evolution remains on the light path, with impact and regression criteria checked and a successful sync; do not claim it passed discovery readiness.

Report the outcome, assumptions, added/revised/replaced/deferred phases, retained behavior, actual planning checks, and next `$riff:wave` invocation only when ready. Stop after planning. Never activate a wave, implement a product feature, publish issues, or deploy from evolve. Use the shared operating contract's real blocker and retry rules, not a second state system.

Use Astra Medium for synthesis and judgment under the [model-routing contract](../../references/model-routing.md). Delegate bounded mechanical inventory only when useful. Keep native compaction and preserve unrelated work.
