# Restore pull request delivery

Status: implemented in the shared Git delivery reference and wave/quick skill instructions after evolve commit `3d8fa13`. GitHub publication is performed by the agent; CLI verification remains local. Live publication is not part of this implementation request.

## Confirmed gap

RIFF Codex currently requires reviewed local commits but explicitly excludes PR creation from completion requirements in `riff/references/operating-contract.md` and `riff/skills/wave/SKILL.md`. `finish --check` checks local readiness and performs no GitHub publication. The user wants PR delivery restored, as remembered from Claude RIFF. Read-only inspection of Claude RIFF confirmed stacked per-phase PRs in `protocols/GIT-DELIVERY.md`; the user chose one PR per coherent evolution for Codex instead.

## Intended outcome

Restore a coherent branch, reviewed commits, and pull request workflow for deliverable changes. Preserve local validation and review gates. A local commit must not be reported as a published PR.

Before implementation, inspect the original Claude RIFF delivery contract read-only and reconcile it with the final evolve implementation. The agreed granularity is one PR per coherent evolution across successive waves, with an authorized draft after the first validated phase. PR creation does not pause loop mode; guided retains its existing pauses.

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

Evolve was committed before delivery implementation began. The implementation updates the shared delivery instructions and wave/quick entry points without changing evolve or RIFF state. Unrelated handoff edits remain untouched. No push, live PR creation, merge or deployment is authorized by this implementation task.

## Implementation verification

- `doctor`: zero errors or warnings before the instruction changes; runtime and installation files are unchanged.
- Direct YAML, UI metadata, canonical symlink and affected Markdown-link checks passed for wave and quick. The personal skill validator reports `excluded path` for these framework paths, so it did not validate them.
- Existing `test/delivery-cli.test.mjs`: four passing tests covering discovery, phase completion, final delivery evidence and retry integrity. No CLI behavior was changed.
- Instruction walkthroughs: an authorized loop opens a draft and continues on the same branch; an authorized standalone quick change creates its bounded PR after review; local-only implementation stays local; an evolve planning request never enters this publication workflow. Resume checks the existing PR identity before creation. These are contract reviews, not live agent or GitHub executions.
- No live push, PR creation, merge or deployment was exercised. Final diff checked for unrelated changes and whitespace errors.
