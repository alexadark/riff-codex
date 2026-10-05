# RIFF security boundary

Load this file only for a sensitive phase, promotion, incident, or explicit security review.

Sensitive boundaries include authentication, authorization, tenant isolation, user data, secrets, payments, migrations, public APIs, callbacks, and webhooks.

Review only the changed boundary and its concrete risk. Do not run an exhaustive audit during a normal wave. Every finding must say, in plain language:

- what could happen;
- who or what data is affected;
- the recommended correction;
- why RIFF continues or stops.

A credible `HIGH` or `CRITICAL` review finding never stops the wave: record the failed review, correct the code, stage the new candidate and repeat the review, because the old receipt is invalid. When a later review passes, mark the earlier finding `resolved` with `riff observations review`, naming the correction.

Defer a finding with `--status expert_review` only when no code change can settle it and it needs a human security expert's judgment: a threat model, a compliance or legal requirement, a cryptographic or infrastructure choice, a third-party configuration outside the repository. A plain code defect is always corrected, never deferred. If the same finding survives three corrections, defer it with its history instead of looping. Deferred findings don't block phases; the bridge tells later reviewers about them, and `riff finish --check` refuses delivery until the expert's decision is recorded as `resolved` or `false_positive`.

Hooks block only high-confidence destructive or security violations. Heuristic authentication, IDOR, input-validation, orphan-file, and TODO checks warn and create structured events for the fresh review. Destructive migrations and high-confidence secrets block and park an active phase.

Promotion requires valid candidate-bound functional and, when sensitive, security receipts. Never bypass project permissions, repository rules, or external approval requirements.
