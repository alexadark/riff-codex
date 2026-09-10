---
name: issue
description: Publish a framed RIFF product outcome as a grouped GitHub issue on explicit request. Use when the user asks RIFF to create or update GitHub issues from the project frame or roadmap.
---

# Publish a RIFF GitHub issue

Load `.riff-codex/references/project-framing.md`, `PROJECT.md`, `ROADMAP.yaml`, and the current RIFF state before drafting. This skill is opt-in: never create or update an issue because `$riff:start`, `$riff:add-phase`, or `$riff:wave` ran.

1. Confirm the user explicitly asked for GitHub issue publication or an issue update. Resolve the repository remote and target repository from the current checkout; do not invent a target.
2. Group the request by useful user or product outcomes. Include connected stories, acceptance criteria, relevant data and permission boundaries, integrations, dependencies, exclusions, and the validation boundary. Keep one issue per coherent outcome when several outcomes are requested.
3. Omit microtasks, implementation-only checklists, old pull request numbers, branch names, stale review metadata, commit history, and historical delivery dossiers unless the current request explicitly calls for a present release reference.
4. Check `gh auth status` and search for a matching open issue before creating a duplicate. If access or third-party verification is missing, stop with that concrete blocker.
5. Create or update the issue with `gh issue create` or `gh issue edit` using the body shape in the project-framing reference. Verify the resulting title, repository, number, and URL. Report the external mutation separately from local RIFF completion; the project frame and roadmap remain canonical.

Do not add a roadmap phase, alter phase state, or bypass RIFF validation and review gates as part of issue publication. If the issue request reveals new product scope, return to `$riff:add-phase` rather than smuggling it into an existing issue.
