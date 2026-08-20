---
name: deep-audit
description: Route an explicitly requested exhaustive audit to Codex Security. Use only when the user invokes $riff:deep-audit or clearly requests a deep repository security audit.
---

# Route a deep security audit

Confirm the authorized repository scope. Invoke the available Codex Security deep-scan capability, preferably `$codex-security:deep-security-scan`, and follow its workflow. Do not recreate a scanner, duplicate its policies, or run this during a normal wave.

Translate validated findings into RIFF's plain-language security format. Park any affected active phase for credible HIGH or CRITICAL findings and keep audit artifacts separate from ordinary candidate receipts.
