---
name: promote
description: Handle explicit RIFF scratch-to-production promotion requests. Use only when the user says "promote to production" or "this app is going public"; never use for an ordinary push, deployment, publication, merge, audit, incident, health check, or review request.
---

# Promote a RIFF project

Read `.riff-codex/references/evidence.md` for the implemented scope-promotion contract. Inspect the current scope with `node .riff-codex/bin/riff.mjs promote`; if already production-scoped, report that no promotion is needed.

Establish the production boundaries in shared `PROJECT.md`, `ROADMAP.yaml` and `taste.md`, preserving existing decisions. Resolve active phase blockers, stage the candidate and obtain fresh independent architecture, roadmap and functional review artifacts. Apply the checked transition with `promote --apply --architecture FILE --roadmap FILE --functional FILE`, then inspect the resulting scope and incident ledger. Load `.riff-codex/references/security.md`; sensitive projects also require `--security FILE`. Keep the candidate review evidence and report what remains unverified externally.

This promotes RIFF project scope only. It does not authorize push, merge, deployment, publication or destructive changes. For a later explicit Git finalization, use `finish --check` before the authorized action.
