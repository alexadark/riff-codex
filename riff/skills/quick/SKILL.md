---
name: quick
description: Make a small, bounded change with RIFF checks but no roadmap phase. Use when the user invokes this skill by name or asks for a quick fix that leaves the roadmap unchanged.
---

# Run a quick RIFF change

`riff` means `node .riff-cli/bin/riff.mjs`. The CLI records nothing for a quick change apart from the Git hooks, so these checks rest on you.

## Goal

Make one bounded change that leaves the product roadmap unchanged, on its own branch, in one atomic commit.

## Done when

- The changed behavior works and was checked once.
- The staged change was reviewed with `riff review run --type functional --quick` (advisory, no receipt), adding `--type security` when the boundary is sensitive. Fix HIGH or CRITICAL findings before committing.
- Observations from the change are triaged: confirmed in-scope problems fixed, decisions recorded with `riff observations review`, nothing unverified marked resolved.
- The change is one atomic commit on its branch. The draft PR is created or updated only when publication is authorized; otherwise the result stays local.

## Verify

- Check only the changed behavior and its regression boundary, and report the real output.
- For a changed user journey, exercise it in a real browser, capture screenshots and generate the HTML report with `riff report --evidence FILE`. Nonvisual checks report observed results; never invent screenshots.

## How to work

1. Establish or reconcile the change's scoped branch.
2. Read the project taste and only the relevant topics and lessons. For UI work, apply the design skills listed in the frontend taste. Read the security reference for a sensitive boundary.
3. Work as a single writer: inspect the affected boundary, implement, verify, review, commit. Let the Git hooks record the commit; don't call `riff hook` yourself.
4. Merge a proven reusable lesson into taste, in proportion to the change.
5. If the scope grows or a product decision appears, stop and recommend the `add-phase` skill.

Model advice is optional and never switches the primary model; a request for advice alone stops before implementation. Report the outcome, commit, checks and PR URL or local-only status. Never claim a merge or a deployment.

## References

Read when the step needs them, under `.riff-cli/references/`: `git-delivery.md`, `evidence.md` (browser evidence and reports), `learning.md`, `security.md`, `dashboard.md` (observation triage), `model-routing.md`, `taste.md` and `taste/frontend.md`.
