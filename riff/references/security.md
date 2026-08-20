# RIFF security boundary

Load this file only for a sensitive phase, promotion, incident, or explicit security review.

Sensitive boundaries include authentication, authorization, tenant isolation, user data, secrets, payments, migrations, public APIs, callbacks, and webhooks.

Review only the changed boundary and its concrete risk. Do not run an exhaustive audit during a normal wave. Every finding must say, in plain language:

- what could happen;
- who or what data is affected;
- the recommended correction;
- why RIFF continues or stops.

A credible `HIGH` or `CRITICAL` finding parks the phase. There is no flag-and-continue path. After a correction, stage the new candidate and repeat the affected review because the old receipt is invalid.

Hooks block only high-confidence destructive or security violations. Heuristic authentication, IDOR, input-validation, orphan-file, and TODO checks warn and create structured events for the fresh review. Destructive migrations and high-confidence secrets block and park an active phase.

Promotion requires valid candidate-bound functional and, when sensitive, security receipts. Never bypass project permissions, repository rules, or external approval requirements.
