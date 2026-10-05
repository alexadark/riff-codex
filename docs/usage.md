# Everyday use

[Back to the README](../README.md) · [Installation](installation.md) · [How it works](how-it-works.md)

Type the examples in the Claude Code or Codex conversation. They use the Claude Code form, `/riff:wave`; in Codex, type `$riff:wave` instead. Terminal commands are labeled separately. If the names don't appear in Codex, [choose the corresponding project skill](installation.md#use-riff-in-codex).

## Start with an idea

Describe the people, the task, and the result you want. You do not need to decide how to build it first.

```text
/riff:start I want a recipe app for myself. I need to save a recipe,
find it later, and see the ingredients when I cook.
```

For a production application, RIFF prepares the committed version in depth. `PROJECT.md` indexes the product dossier: stories and acceptance criteria, journeys, ASCII wireframes, detailed data model and rights, architecture/integrations, Mermaid source files, decisions grounded in project taste and stack, risk probes and the verification strategy. `ROADMAP.yaml` links small useful phases to the stories they deliver. Future versions remain less detailed. Scratch exploration and small independent changes stay lightweight.

You can provide a stack, a template repository and design references. RIFF uses those sources and existing conventions to make technical decisions. If another model will produce the design, RIFF prepares a handoff from the wireframes, then integrates the actual reference and tokens before implementation. It can create the design itself when you authorize that role. No implementation phase begins while a required external design is missing. Nonvisual applications explain why the visual sections do not apply.

An independent reviewer checks the finished dossier and RIFF corrects defects before calling it ready. Its manifest, `docs/specs/readiness.json`, binds the declared files to that review. The agent handles the mechanical checks. Existing applications are not enrolled just by refreshing RIFF.

In default loop mode, RIFF makes conservative choices and records its assumptions. In guided mode, it asks about the current product decisions. Starting a project prepares the plan; it does not launch implementation.

Read the plan, correct anything that does not match your intent, then start:

```text
/riff:wave
```

## Start with an existing app

```text
/riff:onboard Map this recipe app and establish the existing product baseline.
/riff:evolve Plan how to make finding a recipe easier while preserving what works.
```

RIFF inspects the app before planning changes. It uses any existing project brief and roadmap instead of replacing them just to change their format. Once the plan is ready, use `/riff:wave` to begin work.

## Prepare an existing application

If the application isn't connected to RIFF yet, use this sequence. Installation happens in Terminal; the rest is in the conversation:

```text
riff init
/riff:onboard
/riff:evolve I want to invite teammates while preserving individual accounts.
/riff:wave
```

`onboard` maps the current system without changing product or code. When the map will be reused, it saves it as `.riff-data/MAP.md` and records the inspected revision. It then checks the affected areas for drift and establishes a baseline of existing behavior. That baseline isn't a retrospective list of delivery phases. If the project is already onboarded, start at `/riff:evolve`.

The normal `riff init` and `riff resync` paths expose newly registered skills. A running session keeps the instructions it loaded earlier, so open a fresh session before using a newly exposed skill. No separate consumer migration is needed.

## Evolve an existing product

Use `/riff:evolve` when a requested change needs product questioning or can affect several interacting phases, specifications, or user boundaries. Use `/riff:add-phase` when the outcome is already clear and one bounded vertical phase is enough. Evolve can accept one request or several related requests from a meeting or collaborator; suggestions are input to evaluate, not automatic product commitments.

Evolve checks that the project is installed and onboarded. It doesn't install RIFF, run `onboard`, or manufacture missing project context. For an application without RIFF, follow the explicit install, onboard, evolve, wave path above. A bounded evolve on a legacy onboarded project does not silently enroll it in the complete discovery contract. A request to plan a complete version follows full discovery and its independent review. An enrolled project whose dossier changes needs a fresh discovery review and check before further activation.

The planning pass:

1. Challenges the need, users, desired observable outcome, scope and exclusions.
2. Reuses the onboarding map and checks current code, data, permissions, tenancy, integrations and operational behavior for drift.
3. Explains the current-to-target impact, including what existing users must retain and what must change.
4. Updates only affected specifications and future roadmap phases, with stable story and criterion IDs and real dependencies. Completed phase IDs, historical outcomes, receipts and active phase contracts remain intact. Dependencies are repointed before the roadmap is synchronized.
5. Stops at a planning-ready handoff. Evolve never activates a wave; use `/riff:wave` separately.

If a pending phase must be replaced, remove only a never-started, unreferenced `ready` phase and document the old-to-new mapping. Work deferred beyond the version belongs in the existing exclusions with a reason. Do not invent a lifecycle status or use a fake low-priority phase to represent deferral. An active phase is never silently retargeted; evolve records the conflict and keeps dependent planning from activating until the supported handoff is established.

### Worked example: team invitations

Suppose the application currently gives each person an individual account. A useful evolve request makes the product question and the preservation rules concrete:

```text
/riff:evolve
We have individual accounts today. I want account owners to invite teammates
to a shared workspace, revoke an invitation, and remove a member later.
Keep each person's existing account and personal data. Only an owner or
authorized admin may invite or revoke; members may see shared workspace
projects but must not gain access to another workspace. Please challenge
whether this is the smallest useful outcome, inspect the current auth,
workspace and project boundaries, and update only the affected roadmap and
specifications. Leave completed and active phase contracts intact and stop
with a planning-ready result. Do not start implementation.
```

The resulting plan should make the new behavior observable: an invitation has a lifecycle, authorized users can manage it, an accepted member can reach the shared workspace, personal data remains private, and revoked or cross-workspace access is denied. It should also show the affected data, permissions, screens, recovery behavior and dependencies. `/riff:wave` is the next request only after that revised plan is ready.

Related requests can be evaluated together when they share the same boundary:

```text
/riff:evolve
Please evaluate these related requests from the team meeting: workspace
invitations, member removal, and a member activity history. Identify the
shared outcome and conflicts, preserve current individual-account behavior,
and revise only the future phases and contracts that are actually affected.
```

Use `/riff:start` for a new product, and `/riff:add-phase` when an already-understood outcome fits one bounded phase. An exploratory suggestion can remain a discussion with options and consequences, without changing project artifacts. Requests to create an unsupported roadmap status or to silently enroll an old project also belong outside this command's contract.

## Let it work, then see what changed

A wave chooses work whose prerequisites are complete. The agent builds it, checks it, gets an independent review, and saves a local Git commit before recording completion.

There is one active phase at a time. Substantial independent work inside it may run in parallel, with separate worktrees for writers. The agent checks the integrated result, preserves existing behavior and reuses suitable components. It handles dashboard observations at each phase and performs whole-version verification after the last phase. You do not need to act as the tester or approve every phase in loop mode.

- **Loop**, the default: continue to the next ready step automatically.
- **Guided**: pause between steps so you can direct what happens next.

To change this preference, run `riff init --configure` in your project's Terminal.

### How the reviews happen

Each review comes from `riff review run`, which asks another model to attack the work read-only: GPT-6 Astra through the Codex CLI by default, then GPT-6.1 Sol, then a fresh Claude session. It moves to the next reviewer only when one can't run, never because a review is negative. The agent corrects what the reviewer finds and records the result itself, without asking you. The dashboard shows which reviewer ran, labels a reviewer from the same model family as the builder, and notes any fallback.

A security finding never stops the wave. The agent corrects it and gets a new review. A point that needs a security expert's judgment rather than a code fix gets the most cautious interim decision that keeps the app working, written in its note, and `riff finish --check` lists it at the end. See [independent reviews](installation.md#independent-reviews) to change the reviewers.

## Ask for model advice

Model advice is optional and doesn't change the active model in your host. Ask in ordinary language through the RIFF workflow you are already using:

```text
/riff:wave Before continuing this phase, advise which model and reasoning effort
fit the work. Report the advice separately, do not change models, and continue
when the normal RIFF gates allow it.
```

The default `local` mode means the current agent applies RIFF's profile catalogue. It does not mean on-device inference. A project can explicitly opt into Jev advice through OpenRouter; only a curated decision summary is eligible to be sent, never an automatic repository scan. RIFF reuses matching advice at the same phase and policy version, so ordinary file changes do not cause another request.

After settling a wave's work packages, the agent obtains a role plan for the primary agent and any useful authorized subagents, unless advice is off. With Jev enabled, roles needing advice share one request; unchanged roles are reused. Verified subagent profiles are applied through native launch tools where supported. The primary model stays unchanged. For one wave, say: “Use Jev for this wave's model allocation, including its planned subagents, and continue.” To make this recurring within a project, explicitly enable that project's Jev mode.

Luna suits bounded work, Sol suits well-scoped work with several connected steps, and Astra suits planning or dependent long runs. High and XHigh need a concrete reasoning difficulty. A recommendation is not proof of which model is running, and returned probabilities are not success rates.

See [optional model advice](model-advice.md) for privacy controls, modes, failure behavior, and the advanced CLI.

For a short update:

```text
/riff:status
```

For the visual progress board:

```text
/riff:dashboard
```

The dashboard shows progress; it does not run the work. You can also open it from Terminal with `riff dashboard`.

## Return after a break

Open the same project in Claude Code or Codex:

```text
/riff:status
```

Then:

```text
/riff:wave
```

RIFF uses the saved progress to resume active work or select the next ready step. A recorded access or verification blocker must be resolved first. You do not need to rewrite the plan or mark progress yourself.

Each phase keeps a checkpoint with decisions, evidence pointers and the next action. The host keeps its own compaction; in Claude Code, RIFF sets it to 400,000 tokens and injects the active phase context again after a compaction or `/clear`. RIFF doesn't create a new session per phase or run an external relaunch loop. If the session stops, return with `/riff:wave`, in either host. A checkpoint is checked against current files before its evidence is reused.

## Make a small change

```text
/riff:quick Make the empty recipe list explain how to add the first recipe.
```

Use this for a small, separate change that does not need a new roadmap step. RIFF checks and reviews the change and creates a local commit. If the request turns into larger product work, it belongs in the roadmap.

## Fix a problem

```text
/riff:debug I click Save after entering a recipe, but the recipe never
appears in the list. I expected it to appear immediately.
```

Say what you did, what happened, and what you expected. RIFF investigates the observed failure and aims for a focused fix.

## Add a larger improvement

```text
/riff:add-phase Let me share a recipe with a friend using a link.
```

This adds a justified step to the plan. Use `/riff:wave` when you want RIFF to build it.

## Understand a pause

In loop mode, ordinary product choices do not require a handoff. A real blocker can still stop work: missing access, a check that depends on an unavailable outside service, an unclear target for an authorized destructive action, or a failed check that could not be corrected. A security review finding never stops the wave: it's corrected, or, when it needs an expert, given a cautious documented interim decision and listed at the end.

RIFF records the reason rather than declaring the step complete. Check `/riff:status` for the next action. Uploading to GitHub, deploying, and publishing remain subject to your explicit instruction.

## Keep design and engineering conventions

Production discovery records the project's conventions in `taste.md` and relevant `taste/` topics. Existing Claude taste is preserved. RIFF reads only what the current work needs and saves proven lessons without a separate approval queue.

For frontend work, RIFF applies the relevant design skills to layout, typography, colors, components, accessibility and copy, then checks the rendered screen and interactions in the browser. A passing build is not visual acceptance. New screens get a coherent direction based on the product goal; an existing approved design remains authoritative.

NowStack has a dedicated reference, selected only when the project confirms that stack. The actual installed versions and project rules govern implementation.

```text
/riff:learn-stack NowStack: establish the conventions for this project's
forms, Convex authorization and frontend components.
```

`learn-stack` researches the relevant sources and saves version-aware conventions under `references/taste/stacks/`, linked from `taste.md`. Existing rules are merged conservatively. It does not require a source-shortlist approval in loop mode, change dependencies or deploy anything.

## Find the less frequent tools

| Need | Skill |
| --- | --- |
| Research and save reusable stack conventions | `/riff:learn-stack` |
| Publish planned outcomes as GitHub issues | `/riff:issue` |
| Investigate an active application incident | `/riff:debug` |
| Turn a prototype into a production project | `/riff:start` |
| Request an exhaustive security audit, in Codex only | `$riff:deep-audit` |

The former `map`, `incident` and `promote` skills are now part of `onboard`, `debug` and `start`. Some operations need additional installed tools or service access. The [technical reference](technical-reference.md) links to each workflow's actual rules.
