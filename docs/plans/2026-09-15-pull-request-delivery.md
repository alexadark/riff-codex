# Restore pull request delivery

Status: planned; implement after the concurrent evolve work is complete and verified.

## Confirmed gap

RIFF Codex currently requires reviewed local commits but explicitly excludes PR creation from completion requirements in `riff/references/operating-contract.md` and `riff/skills/wave/SKILL.md`. `finish --check` checks local readiness and performs no GitHub publication. The user wants PR delivery restored, as remembered from Claude RIFF. Exact historical Claude behavior has not yet been inspected.

## Intended outcome

Restore a coherent branch, reviewed commits, and pull request workflow for deliverable changes. Preserve local validation and review gates. A local commit must not be reported as a published PR.

Before implementation, inspect the original Claude RIFF delivery contract read-only and reconcile it with the final evolve implementation. Resolve PR granularity from that evidence and the current wave model; avoid automatically creating one PR per internal phase.

- Prepare changes on a scoped branch, preserving unrelated work and concurrent tasks.
- When delivery is authorized, push the verified branch and create or update its PR. Reuse an existing matching PR on resume rather than creating duplicates.
- Use a concise title and description explaining the resulting behavior and validation. Return the verified PR URL and actual delivery status.
- Honor explicit local-only, no-push, and preview-only limits. Reuse existing delivery authorization without asking separately for push and PR creation. Where publication is not authorized, prepare the concrete local result and PR description before requesting it.
- Treat merge and application deployment according to their own authorization and verification boundaries. PR creation does not imply either occurred.
- Report missing GitHub access or an unresolved remote/base target accurately; never fabricate publication success.

## Integration and verification

Revisit the operating, execution and evidence contracts, wave and quick delivery behavior, CLI finish boundary, and user documentation. Prefer a shared delivery reference over duplicated instructions; add CLI behavior only where required. Read the canonical skill-authoring procedure before changing skills. Do not edit managed exposures or consumer state.

Use the narrowest relevant checks for the implemented behavior, covering authorized PR delivery, explicit local-only limits, reuse on resume, and missing access or an ambiguous target. Verify actual GitHub publication separately when authorized; mocked checks alone do not establish a live PR.

## Concurrency boundary

This task records the delivery gap and intended restoration only. It does not modify evolve, shared runtime contracts, skills, or RIFF state, and does not push or open a PR. Recheck the completed evolve diff before implementing shared delivery changes.
