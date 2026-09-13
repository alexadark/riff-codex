---
name: incident
description: Contain and investigate an active application incident with RIFF state. Use when the user invokes $riff:incident or reports a live security or reliability incident.
---

# Handle an incident

Prioritize human safety, data protection, and reversible containment. Establish verified impact, affected users or data, current symptoms, and ownership. Preserve relevant evidence without exposing secrets.

Recommend the smallest safe containment action and ask before destructive or external changes not already authorized. Load `.riff-codex/references/security.md` for a security boundary. Preserve temporary evidence under `.riff-codex-state/`. Once the boundary is stable, append the confirmed impact, cause and prevention with `incident log --evidence FILE` under `.riff-codex/references/evidence.md`. The durable `INCIDENTS.md` ledger is append-only and idempotent by incident id. Review this ledger for recurring causes when explicitly requested; do not resume normal waves while the incident is unstable.
