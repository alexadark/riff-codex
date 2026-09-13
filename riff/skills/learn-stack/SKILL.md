---
name: learn-stack
description: Research and persist source-backed stack conventions for the invoking project. Use for $riff:learn-stack, explicit stack-convention requests, or a reusable stack knowledge gap blocking a RIFF outcome; not for incidental technology mentions or one-off API questions.
---

# Learn stack conventions

Goal: leave concise, verified stack rules that future implementation and review can find and apply. Read `.riff-codex/references/taste.md` for precedence, shared artifacts and autonomy.

## Scope and evidence

Infer the requested stack, installed version and useful focus from the request, manifest, lockfile and current outcome. For NowStack, identify the actual starter variant and use `.riff-codex/references/taste/stacks/nowstack.md` as a starting reference. An explicitly named new stack may be researched before it is installed; label that distinction. If no stack can be identified in loop mode, report insufficient task context without inventing one or writing a file.

Inspect existing project taste and stack notes first. Research only conventions that affect the requested focus, using current maintainer documentation and relevant inspected repository evidence. Verify source links, version applicability and the claims they support. No fixed source count or shortlist approval is required. A maintainer rule can stand alone as `[official]`; a project convention needs local evidence as `[project]`; an inferred recommendation must be labeled and justified, not presented as consensus. Unsupported claims stay out of the rules. Missing required external access remains a real blocker; a sparse source set is not permission to fabricate guidance.

## Durable result

Write in the invoking consumer project, not the RIFF installation, another consumer or a symlinked external directory. Use a lowercase hyphenated stack slug matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`; never use raw path-like input. The output is `references/taste/stacks/<stack>.md`, with:

- stack, version/range, focus, date checked and a precise “Read when” trigger;
- concise actionable conventions, each tied to its source and applicability;
- relevant gotchas and anti-pattern replacements;
- verified source links or repository file references, and remaining evidence gaps.

Merge an existing file conservatively and idempotently: preserve unrelated rules, decisions and sources, remove duplication, and correct stale claims only with evidence and a short reason. Retain multiple version/focus sections when needed. Do not ask replace/merge/skip in loop mode. If the target resolves outside the project, preserve it and use a regular project-owned supplement with an explicit index entry instead.

Update `references/taste/stacks/INDEX.md` with one precise trigger/link for the result, preserving other rows. Link that index from project `taste.md`, creating a minimal index if absent, so start/wave/quick/review can discover the rules. Honor the same symlink boundary for both indexes. Existing `.riff-codex-state/stack-notes.md` may supply leads, but reusable verified rules belong in project taste; do not delete unrelated notes.

Check local links, source attribution, version/focus and preservation of existing content. Report the paths, key retained rules and unresolved evidence. This research does not authorize implementation, dependency upgrades, deployment or framework-wide promotion. Within an active wave, include taste edits in its candidate before final receipts; otherwise follow the repository's normal local commit policy.
