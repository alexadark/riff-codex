---
name: promote
description: Promote a reviewed RIFF candidate through an authorized deployment boundary. Use only when the user explicitly invokes $riff:promote or requests promotion.
---

# Promote a reviewed candidate

Load `.riff/references/security.md` only now. Identify the exact candidate, environment, rollback path, required credentials, and external approvals. Verify candidate-bound functional and, when sensitive, security receipts are current.

Explain the expected user impact and recommend whether to proceed. Ask only for missing authority, credentials, or a material environment choice. Never infer permission to deploy, push, publish, migrate, or bypass controls. Record the promotion result as a short RIFF event.
