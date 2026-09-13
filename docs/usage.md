# Everyday use

[Back to the README](../README.md) · [Installation](installation.md) · [How it works](how-it-works.md)

Type the `$riff:...` examples in Codex. Terminal commands are labeled separately. If the names do not appear, [choose the corresponding project skill](installation.md#make-the-skills-available).

## Start with an idea

Describe the people, the task, and the result you want. You do not need to decide how to build it first.

```text
$riff:start I want a recipe app for myself. I need to save a recipe,
find it later, and see the ingredients when I cook.
```

RIFF prepares two documents: `PROJECT.md` describes the product, and `ROADMAP.yaml` lists small useful steps. A step is also called a “phase.” For example, “Save a recipe and find it again” is a step you can actually try.

In default loop mode, RIFF makes conservative choices and records its assumptions. In guided mode, it asks about the current product decisions. Starting a project prepares the plan; it does not launch implementation.

Read the plan, correct anything that does not match your intent, then start:

```text
$riff:wave
```

## Start with an existing app

```text
$riff:onboard Understand this recipe app. Preserve what already works
and plan how to make finding a recipe easier.
```

RIFF inspects the app before planning changes. It uses any existing project brief and roadmap instead of replacing them just to change their format. Once the plan is ready, use `$riff:wave` to begin work.

## Let it work, then see what changed

A wave chooses work whose prerequisites are complete. Codex builds it, checks it, gets a review, and saves a local Git commit before recording completion.

- **Loop**, the default: continue to the next ready step automatically.
- **Guided**: pause between steps so you can direct what happens next.

To change this preference, run `riff-codex init --configure` in your project's Terminal.

For a short update in Codex:

```text
$riff:status
```

For the visual progress board:

```text
$riff:dashboard
```

The dashboard shows progress; it does not run the work. You can also open it from Terminal with `riff-codex dashboard`.

## Return after a break

Open the same project in Codex:

```text
$riff:status
```

Then:

```text
$riff:wave
```

RIFF uses the saved progress to resume active work or select the next ready step. A recorded access or verification blocker must be resolved first. You do not need to rewrite the plan or mark progress yourself.

## Make a small change

```text
$riff:quick Make the empty recipe list explain how to add the first recipe.
```

Use this for a small, separate change that does not need a new roadmap step. RIFF checks and reviews the change and creates a local commit. If the request turns into larger product work, it belongs in the roadmap.

## Fix a problem

```text
$riff:debug I click Save after entering a recipe, but the recipe never
appears in the list. I expected it to appear immediately.
```

Say what you did, what happened, and what you expected. RIFF investigates the observed failure and aims for a focused fix.

## Add a larger improvement

```text
$riff:add-phase Let me share a recipe with a friend using a link.
```

This adds a justified step to the plan. Use `$riff:wave` when you want RIFF to build it.

## Understand a pause

In loop mode, ordinary product choices do not require a handoff. A real blocker can still stop work: missing access, a check that depends on an unavailable outside service, an unclear target for an authorized destructive action, or a failed check or review that could not be corrected.

RIFF records the reason rather than declaring the step complete. Check `$riff:status` for the next action. Uploading to GitHub, deploying, and publishing remain subject to your explicit instruction.

## Keep design and engineering conventions

Production discovery records the project's conventions in `taste.md` and relevant `taste/` topics. Existing Claude taste is preserved. RIFF reads only what the current work needs and saves proven lessons without a separate approval queue.

For frontend work, RIFF applies the relevant design skills to layout, typography, colors, components, accessibility and copy, then checks the rendered screen and interactions in the browser. A passing build is not visual acceptance. New screens get a coherent direction based on the product goal; an existing approved design remains authoritative.

NowStack has a dedicated reference, selected only when the project confirms that stack. The actual installed versions and project rules govern implementation.

```text
$riff:learn-stack NowStack: establish the conventions for this project's
forms, Convex authorization and frontend components.
```

`learn-stack` researches the relevant sources and saves version-aware conventions under `references/taste/stacks/`, linked from `taste.md`. Existing rules are merged conservatively. It does not require a source-shortlist approval in loop mode, change dependencies or deploy anything.

## Find the less frequent tools

| Need | Skill |
| --- | --- |
| Understand the existing code | `$riff:map` |
| Research and save reusable stack conventions | `$riff:learn-stack` |
| Investigate an active application incident | `$riff:incident` |
| Request an exhaustive security audit | `$riff:deep-audit` |
| Explicitly prepare promotion to production | `$riff:promote` |

Some operations need additional installed tools or service access. The [technical reference](technical-reference.md) links to each workflow's actual rules.
