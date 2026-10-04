---
name: issue
description: Publish framed RIFF product outcomes as grouped GitHub issues on explicit request. Use when the user invokes this skill by name or asks RIFF to create or update GitHub issues from the project frame or roadmap.
---

# Publish a RIFF GitHub issue

`riff` means `node .riff-cli/bin/riff.mjs`. No RIFF command publishes to GitHub: everything here rests on you, and the project frame and roadmap stay the source of truth.

## Goal

Turn the outcomes the user named into one GitHub issue per coherent product outcome, in the repository of the current checkout, only because the user explicitly asked. Running the `start`, `add-phase` or `wave` skill is never a reason to publish.

## Done when

- Each issue groups one useful user or product outcome with its stories, acceptance criteria, data and permission boundaries, integrations, dependencies, exclusions and validation boundary, in the body shape of the project-framing reference.
- An existing open issue for the same outcome was updated instead of duplicated.
- The roadmap and the RIFF state are unchanged.

## Verify

Read back each created or updated issue: title, repository, number and URL. Report this external change separately from any local RIFF work.

## How to work

1. Check that the user explicitly asked to create or update issues. Read the project-framing reference, `PROJECT.md`, `ROADMAP.yaml` and `riff status`.
2. Resolve the target repository from the checkout's remote; never guess one. Run `gh auth status`; missing access or an impossible third-party check is a blocker to report, not to work around.
3. Leave out microtasks, implementation checklists, old pull request numbers, branch names, stale review metadata, commit history and past delivery dossiers, unless the request asks for a current release reference.
4. Search the open issues, then create with `gh issue create` or update with `gh issue edit`.

Never add a phase, change phase state or skip RIFF validation and review as part of publishing. If the request reveals new product scope, stop and recommend the `add-phase` or `evolve` skill instead of slipping it into an issue.
