---
name: learn-stack
description: Research and save source-backed stack conventions for the current project. Use when the user invokes this skill by name, asks for stack conventions, or a reusable stack knowledge gap blocks a RIFF outcome; not for a passing technology mention or a one-off API question.
---

# Learn stack conventions

No RIFF command checks this work: the rules below rest on you. `.riff-cli/references/taste.md` sets precedence between taste sources and the shared artifacts.

## Goal

Leave short, verified rules for one stack and focus that later implementation and review can find and apply. Research authorizes no implementation, dependency upgrade, deployment or promotion of the rules to RIFF itself.

## Done when

- `references/taste/stacks/<stack>.md` exists in the current project, with the stack, version or range, focus, date checked and a precise "Read when" trigger; short actionable conventions tied to their source; gotchas and the patterns that replace them; source links or repository files; and the remaining evidence gaps.
- `references/taste/stacks/INDEX.md` has one row with the trigger and link, other rows preserved, and the project's `taste.md` links that index (create a minimal index if none exists).
- Each rule carries its label: `[official]` from maintainer documentation, `[project]` with local evidence, `[example]` with the reference repository and file, or an inferred recommendation labeled and justified as such. Unsupported claims stay out.

## Verify

- Every source link works, applies to the installed version and supports the claim it backs.
- Local links resolve, existing rules, decisions and sources are preserved, and nothing is duplicated.
- No fixed source count or shortlist approval is needed, but a thin source set never justifies invented guidance. Missing required external access is a real blocker.

## How to work

1. Infer the stack, installed version and useful focus from the request, manifest, lockfile and current outcome. For NowStack, identify the actual starter variant and start from `.riff-cli/references/taste/stacks/nowstack.md`. A stack the user names before installing it may be researched; say it isn't installed yet. In `loop` mode, if no stack can be identified, report that the task lacks context and write nothing.
2. Read the project's taste and stack notes first; `.riff-data/stack-notes.md` may give leads, but keep its unrelated notes.
3. Research only what affects the focus: current maintainer documentation, then the best reference code at the installed version, such as official examples and templates, apps maintained by the stack's authors, and active, well-regarded open-source projects in real production use, rather than the most starred. Read their code for the focus and turn recurring patterns into rules.
4. Write only in the current project, never in the RIFF installation, another project or a symlinked external folder. Name the file with a lowercase hyphenated slug matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`, never with raw path-like input. If the target resolves outside the project, leave it alone and write a regular project file with its own index entry. The same boundary applies to both indexes.
5. Merge an existing file conservatively and idempotently: keep unrelated content, keep separate version or focus sections, and correct a stale claim only with evidence and a short reason. In `loop` mode, don't ask whether to replace, merge or skip.
6. Inside an active wave, include the taste edits in its candidate before the final receipts; otherwise follow the repository's usual local commit policy.

Report the paths, the key rules kept and the unresolved evidence.
