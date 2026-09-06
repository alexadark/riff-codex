---
name: promote
description: Handle explicit RIFF scratch-to-production promotion requests. Use only when the user says "promote to production" or "this app is going public"; never use for an ordinary push, deployment, publication, merge, audit, incident, health check, or review request.
---

# Promote a RIFF project

RIFF Codex doesn't currently implement the canonical scratch-to-production
promotion protocol. Report that promotion is temporarily unavailable and stop
without changing project files, scope, Git state, deployments, or external
systems.

If the project is already production-scoped, report that no scope promotion is
needed. Never reinterpret `$riff:promote` as authorization to push, merge,
publish, deploy, migrate, or bypass controls.
