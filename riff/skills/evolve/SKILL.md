---
name: evolve
description: Plan a change to an existing RIFF product, from one request to several competing ones, and revise the roadmap without losing history. Use when the user invokes this skill by name or asks to replan an existing RIFF application; not for initial definition, a simple phase append or implementation.
---

# Evolve an existing product

`riff` means `node .riff-cli/bin/riff.mjs`. The CLI refuses to change the contract of an active or finished phase, to remove a phase with execution history, and, for an enrolled project, to activate a phase until the revised dossier has a fresh passing review.

## Goal

Turn an authorized change to an existing application into a verifiable plan the `wave` skill can build from, then stop. First classify the request:

- Exploration: a question or a collaborator's suggestion that nobody has accepted yet. Answer with options and consequences and change nothing.
- Planned change: the user asks to plan it. This authorizes targeted edits to the product files and the roadmap.
- A single, already understood outcome to append belongs to the `add-phase` skill; defining a new product belongs to the `start` skill.

## Done when

- The change is clear: who it affects, the problem, the observable outcome, the smallest useful scope and the exclusions. Competing requests are grouped or arbitrated, and work already planned is reused, not duplicated.
- The user confirmed the summary of the change.
- Only affected product and spec content and pending phases changed. Each new or revised phase has `done_when` and `verify`, with criteria for the new outcome and for the existing behavior it touches.
- The change analysis is saved in the project's specs (for example `docs/specs/evolutions/<change>.md`), linked from `PROJECT.md`, with the old-to-new phase mapping.
- `riff wave sync` passed and the affected `EXPLAIN.simple.md` files are refreshed.
- Enrolled project, or an explicit request to plan the whole next version: the manifest lists the new documents, a fresh independent review covers the revised dossier, and `riff discovery check` passes. A bounded change to an unenrolled application stays light planning; never present it as discovery readiness.
- No phase is active. Building starts only when the user invokes the `wave` skill.

## Verify

- Run `riff doctor` and `riff status` before and after the edits.
- Check the plan against the code and tests around the affected paths, not only the documents.
- An enrolled dossier is reviewed with `riff review run --type discovery`; the reviewer judges the coherence of the whole revised version, including the existing behavior affected. Three failed rounds at most before recording a blocker.

## How to work

1. Run `riff doctor` and `riff status`. Require `PROJECT.md`, `ROADMAP.yaml` and initialized RIFF state; if one is missing, name the next step (install RIFF, then the `onboard` skill) and stop without doing it.
2. Read the product sources, the affected specs, the project taste and only the applicable references, plus `.riff-data/MAP.md` after checking the affected code for drift. Settle technical facts from the code instead of asking.
3. Interview the user about the change, whatever the autonomy mode: the mode governs waves, not product definition. Ask a few questions at a time, in the user's language, about what the sources didn't settle: who is affected and what problem they have, the outcome they expect, what stays out, what existing users must keep, and the design reference. Challenge the proposed solution when a simpler one reaches the outcome, offer concrete options with a recommendation, and explain the consequences for existing users, data, permissions, journeys, integrations and recovery. Never ask for technical facts the code settles.
4. Present the summary, separating evidence, inference and external dependencies, and let the user confirm or correct it before editing shared files. From there, finish without further questions; only a blocker kind from the operating contract stops the work.
5. Edit the plan following the evolution reference: keep the YAML layout, unknown fields and stable IDs, never recycle an ID or invent a status, revise or replace only ready phases without execution history. Reuse unchanged specs and don't redo discovery for unaffected behavior. A missing promised design stays an external dependency; never invent a substitute.
6. If an active phase or another session is building against the affected contract, keep the proposal as a draft outside the live dossier, name the phase it waits for and apply it at that phase's safe boundary. Never interrupt or rewrite another task.
7. Sync, refresh the explanations, then run the review and check when the dossier is enrolled. A failed sync or check means the plan isn't ready: fix the scoped issue under the operating contract's retry rules and never edit RIFF state files by hand.

A request for model advice alone doesn't authorize an evolution, and an exploration records no advice unless asked; optional advice never switches the primary model or adds a pause in `loop` mode. Never implement, publish issues, deploy or relaunch your own host. Preserve unrelated changes.

Report the outcome, assumptions, phases added, revised, replaced or deferred, the behavior kept, the checks actually passed, any scheduling conflict, and the `wave` invocation only when the plan is ready.

## References

Read when the step needs them, under `.riff-cli/references/`: `evolution.md` (baseline, change analysis, roadmap edit rules, active work, readiness), `discovery.md` (dossier content, design handoff, review lifecycle), `project-framing.md`, `operating-contract.md` (modes, blocker kinds, phase contract), `dashboard.md` (`EXPLAIN.simple.md`), `security.md`, `model-routing.md`, `taste.md` and the applicable `taste/` topics.
