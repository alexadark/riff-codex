---
name: onboard
description: Map an existing codebase and bring it into RIFF as a baseline. Use when the user invokes this skill or the former map skill, or asks to map or onboard a project that already has code.
---

# Map and onboard an existing project

`riff` means `node .riff-cli/bin/riff.mjs`. The brownfield path is: install RIFF, then onboard, then the `evolve` skill for new features, then the `wave` skill.

## Goal

Understand the existing application from its code, then record it as the RIFF baseline: what it does today, not a retrospective list of completed phases. A request to map only stops after the map.

## Done when

- **Map:** user-visible flows are linked to entry points, data boundaries, external systems and sensitive surfaces, with verified facts kept apart from inference. If the map will be reused, `MAP.md` in the RIFF state folder records the inspected revision, sources and remaining uncertainties. No target architecture, implementation plan or exhaustive file inventory.
- **Onboard:** `PROJECT.md` summarizes current capabilities, architecture, constraints, risks and vocabulary, separating implemented facts from preferences, assumptions and open decisions. `ROADMAP.yaml` lists only requested future outcomes, often none; each phase has a justified P0 to P3 priority, `done_when` and `verify`. `riff wave sync` passed, and the skill stopped there.
- The project taste holds the verified conventions of the actual code and design, merged into existing Claude or project taste without overwriting it. For a UI product, it includes the frontend direction and design-skill routing.

## Verify

Check every map finding against the current code before relying on it, including findings from an earlier `MAP.md`. Confirm the actual stack and reuse its stack references.

## How to work

1. Inspect the repository, existing project answers and the configured autonomy mode. Reuse a valid `MAP.md` and existing onboarding artifacts instead of repeating discovery.
2. Classify the scope. Several dependent outcomes, multiple user roles or system boundaries, multi-system integration or an explicit large-project request use the project framing reference: stories with observable criteria, entities, relationships and rights, architecture and integrations with motivated decisions, and a phase map. A small application with one clear outcome stays concise.
3. A read-only map reports useful conventions without changing taste and doesn't persist model advice or call paid advice without an explicit request. Save conventions only when asked.
4. In `loop` mode, settle product and technical questions from repository evidence: preserve behavior and data, minimize scope, permissions, dependencies and external effects, prefer reversible choices, record assumptions and continue. Never create `awaiting_human` for a decision. Stop only for missing credentials or access, impossible third-party verification, an unidentifiable destructive target or a failed RIFF validation. In `guided` mode, ask only product-boundary decisions, each with a recommendation, and confirm before writing the artifacts.
5. Name technical debt only when it blocks a vertical outcome; mark uncertain later work as fog of war. Don't redesign the application.
6. `PROJECT.md` and `ROADMAP.yaml` are shared with Claude RIFF: keep existing content, representation, comments, key order and unknown fields unless a targeted replacement is authorized.

Publish GitHub issues only through the `issue` skill.

## References

Read when the step needs them, under `.riff-cli/references/`: `project-framing.md`, `evolution.md`, `taste.md` and `taste/frontend.md`, `model-routing.md`, `operating-contract.md`.
