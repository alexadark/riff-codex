# Plan: evolve RIFF Codex into model-independent RIFF

Date: 2026-09-15

Status: planning proposal. This document authorizes no implementation, installation, model call, subscription, migration or release. It is a design input for a future RIFF roadmap, not a second execution tracker.

## Goal and agreed direction

Use RIFF Codex as the foundation for one framework that can work with different coding environments and models. Keep its simplified workflow and make model-specific prompting easy to update without copying the framework or weakening its checks.

The user has confirmed these boundaries:

- Start from this repository, not the original RIFF for Claude Code.
- Preserve the simplifications already chosen, including the absence of a conductor and heavy Git metadata.
- Support future choices beyond Claude, including GLM or an open-source model through a suitable host.
- Plan now. A Claude subscription is not currently available and is not a prerequisite for the initial work.

The architecture and sequence below are proposals. Compatibility with another environment remains unverified until a real pilot passes.

## Current foundation

The following observations come from the local repository at commit `64ce60a`. This is an initial inventory, not a completed portability audit.

| Existing source | Reuse or dependency to address |
| --- | --- |
| [Operating contract](../riff/references/operating-contract.md) | Shared product artifacts, phase rules, autonomy and one active writer. It currently reserves execution state for Codex and treats original Claude state as foreign. |
| [CLI](../riff/bin/riff.mjs) | Phase selection, validation, reviews, completion and recovery already use deterministic code. The same entry point also contains Codex installation paths, hook registration and diagnostics. |
| [Model routing](../riff/references/model-routing.md) | Work roles are useful, but the policy directly names Astra and Luna. It explicitly does not switch the active model itself. |
| [Skills](../riff/skills/) and [plugin manifest](../riff/.codex-plugin/plugin.json) | Workflow instructions, Codex metadata and tool-specific invocation need to be distinguished. |
| [Managed hooks](../riff/lib/managed-hooks.mjs) and [dispatcher](../riff/hooks/managed-dispatch.mjs) | Current trust setup and event integration belong to the Codex host integration. |
| [Evidence](../riff/references/evidence.md), [reports](../riff/lib/report.mjs) and [dashboard](../riff/dashboard/) | Preserve actual executed checks, screenshots, candidate identity, observation history and recovery evidence. Audit assumptions about paths, tools and model metadata. |
| [Taste](../riff/references/taste.md), [learning](../riff/references/learning.md) and [security](../riff/references/security.md) | Reuse common conventions; identify dependencies on installed skills, browser tools and security services. |

There is no root `PROJECT.md` or `ROADMAP.yaml` in this checkout at planning time. Do not invent an active phase or modify consumer roadmaps to schedule this work. When implementation is commissioned, establish the framework's product scope and roadmap through its normal workflow.

[DEFERRED.md](../DEFERRED.md) currently excludes provider compatibility. This plan proposes revisiting that boundary for host integrations and configurable model profiles. A model gateway and executing Claude inside Codex remain outside the proposed scope.

## Proposed separation

### 1. One common RIFF core

The core owns product and roadmap contracts, phase transitions, candidate validation, review receipts, recovery, observation triage, learning, reports and dashboard data. It expresses work in roles and required capabilities rather than vendor names.

Retain deterministic CLI checks where they already exist. Prompt wording can guide behavior, but cannot replace an enforced check or prove that a model followed an instruction.

### 2. Small host integrations

A host is the application or agent harness that lets a model read files, run commands and use tools. Codex and Claude Code are host integrations; GLM is a model choice that needs a compatible host. A model endpoint alone does not provide a coding workflow.

Each integration supplies only the relevant installation and execution boundary:

- Instruction and skill exposure, invocation names and context loading.
- Native hook event translation, result handling and available enforcement.
- Tool access, browser evidence collection and review/delegation facilities.
- Actual model selection controls, if exposed by the host.
- Configuration diagnostics and update/uninstall behavior that preserves unrelated settings.

Keep execution in the host. Do not create a RIFF scheduler, nested agent runtime, universal tool router or API proxy. An unfamiliar host can be added later using an observed need, rather than scaffolding adapters for every vendor now.

### 3. Configurable model profiles

Separate the role from its current assignment. Planning, implementation and review are responsibilities; one model can fill several roles when the host supports the required workflow. Independent review still needs an actual separate reviewer execution, not a second invented identity.

A small declarative configuration should describe:

| Information | Purpose |
| --- | --- |
| Role assignment | Choose a model profile for judgment, implementation and review. |
| Model identity | Use the exact identifier accepted by the selected host; keep credentials outside RIFF artifacts. |
| Supported parameters | Apply reasoning, speed or other settings only where the host exposes them. Do not translate `xhigh` to unrelated models by assumption. |
| Prompt adaptation | Point to a short, versioned adaptation when that model needs different task framing or output guidance. |
| Verification status | Distinguish a user-configured profile from one exercised in a real pilot, with the tested host/model version and date. |

Use shared defaults with explicit project overrides, resolved in a documented order. Prefer existing RIFF configuration storage where practical; decide exact filenames and schema after the dependency inventory. Do not create another database or a configuration language.

Show the resolved selection and distinguish requested settings from settings the host actually reports. Unknown effective identity stays unknown. A configuration change must not be presented as switching an already-running conversation when the host cannot do that.

No silent fallback to another provider, remote service or paid model. Preserve project data boundaries and record an unavailable assignment rather than pretending it ran.

## Prompt evolution without framework forks

Maintain one canonical workflow contract and shared task instructions. Add short host and model adaptations only where behavior actually differs. Most profiles should work with shared instructions alone.

Adaptations may change task framing, context packaging, examples and tool-use guidance. They may not remove validation, fabricate independent reviews, bypass permissions, dismiss security observations or redefine phase completion.

If a host needs self-contained instruction files, generate those files from the shared source instead of maintaining independent copies. The installer should identify generated content and preserve user-owned instructions. No template engine is needed unless simple composition proves insufficient.

For a model update:

1. Identify the concrete behavior or capability that changed, using current official documentation and a reproducible task.
2. Edit the relevant profile or adaptation, leaving the common contract unchanged unless the lesson applies generally.
3. Inspect the effective instructions and run the affected reference scenario.
4. Record the profile/prompt version and observed result. Keep the previous version available through Git for rollback.

Record enough provenance to explain a result: candidate, host/model identity when known, resolved profile and instruction version. Do not retain full private prompts or transcripts by default, or introduce mandatory commit trailers and PR dossiers.

## Capabilities and honest support levels

Distinguish model abilities from host facilities and installed tools. A model that understands images still needs a host able to supply screenshots; a host with tools may not support a required pre-action hook.

Diagnostics should expose a small set of workflow-relevant capabilities: command execution, file changes, lifecycle events, pre-action enforcement, browser evidence, independent review and model selection. Installation checks can verify wiring; only live scenarios establish behavior. A profile's own declaration is not proof.

Use three clear support states:

- **Verified:** required behavior passed for the recorded configuration and scenario scope.
- **Limited:** useful work is possible, but specific missing facilities are visible and affected guarantees are unavailable.
- **Unverified:** configuration exists, but the integration has not been exercised sufficiently.

If a required browser check or review is unavailable, the phase remains incomplete under the existing blocker rules. An explicit checkpoint may substitute for a lifecycle reminder when it preserves the outcome. A reminder cannot substitute for pre-action protection, and a Git hook cannot prevent an already executed destructive shell command.

Keep hook trust native to each host. The existing Codex system approval arrangement is not a portable promise of automatic approval everywhere.

## State, switching and migration

Use one CLI-owned execution state for the new RIFF integrations. A host or model switch must not create a competing progress database. Start by retaining `.riff-codex-state/`, `.riff-codex/` and the `riff-codex` command: neutral names are not necessary to prove portability and immediate renaming would increase migration risk.

Existing `PROJECT.md`, `ROADMAP.yaml`, taste, observation decisions and evidence must survive installation or profile changes. Preserve roadmap representation, comments and unknown fields. Any required state schema change needs a versioned migration, backup and a tested recovery path.

Original Claude RIFF's `.riff` and `.riff-state/` remain foreign. The proposed new Claude integration will run this framework's core; it is not the original Claude framework sharing its private state. No import, overwrite or migration of that state is included here.

Begin switching at completed phase boundaries with no active writer. Later, allow interruption recovery across hosts after proving exclusive ownership, preserved working files/index and correct evidence handling. Do not reset, stash, overwrite or rerun successful checks merely because the host changed.

Existing candidate-bound evidence may remain valid when the candidate, target and required checks still match. A new policy requiring stronger checks must identify those missing checks; a model-name change alone does not invalidate an observed test result. Missing or stale evidence never becomes valid through a switch.

## Delivery sequence and acceptance

These are proposed vertical outcomes, not activated roadmap phases. Estimate implementation effort after the first inventory rather than assigning speculative dates now.

| Step | Observable result | Acceptance and dependency |
| --- | --- | --- |
| 1. Map the boundary | A concise inventory shows every Codex-specific dependency, including skills, security/browser tools, installation, hooks, state and reports. | Each dependency has a proposed owner: shared core, host integration or model profile. Confirm current behavior using existing tests. No consumer migration. |
| 2. Make profiles editable in Codex | The user can change a supported role assignment or its prompt adaptation without editing phase logic. | Effective instructions and configuration are inspectable; unsupported parameters are explained; a real Codex task preserves completion gates. Depends on step 1. |
| 3. Isolate the Codex host boundary | A disposable project installs, executes a small phase and resumes through the extracted Codex integration. | Existing paths and active consumers remain supported; hooks are not duplicated; verification reports and agent-owned triage work. Depends on steps 1 and 2. |
| 4. Prove a second real environment | The same small phase contract works in another available host using this RIFF core. | Real checks, independent review where required and an inspectable HTML report pass. Validate a different model profile without vendor assumptions. Select the host when access exists; neither Claude nor GLM is pre-declared compatible. Depends on step 3 and real access. |
| 5. Prove switching and document support | A project continues across supported configurations without losing work or history. | Verify completed-phase switching first, then one interruption/resume case. Publish the tested support matrix and update README, HTML manual, installation and technical references together. Depends on step 4. |

Steps 1 through 3 can proceed using the current Codex environment when implementation is authorized. Steps 4 and 5 depend on a second usable environment, not specifically on a Claude subscription. A fake adapter can test contracts but cannot establish live compatibility.

## Focused verification

Reuse existing tests and reports rather than creating a benchmark platform. Cover these five reference scenarios with the smallest useful checks:

1. **Installation and update:** repeat setup in a disposable project, preserve unrelated instructions and hooks, and verify the effective profile.
2. **Small delivery:** implement a bounded change, execute its checks, obtain the required review, and generate the report. Use a UI fixture when evaluating browser support so real screenshots are included.
3. **Failure and missing capability:** a failed check or unavailable required facility prevents completion; an invalid profile does not silently change provider or weaken the contract.
4. **Observation handling:** the agent justifies a false positive or verifies a fix, preserves history and reopens a group on a fresh occurrence.
5. **Recovery and switching:** preserve an interrupted candidate and valid evidence, reject stale evidence and prevent competing writers across integrations.

Judge model/prompt changes by the observed outcome and contract compliance, not identical wording. Repeat a scenario only for a relevant change, inconclusive result or newly discovered risk. Do not require a full suite after every edit or an exhaustive provider matrix.

## Exclusions and completion criteria

Keep out: conductor, custom agent runtime, model gateway, automatic prompt optimization, automatic model downloads, mandatory cloud service, bulk consumer migration, original Claude state import, heavy Git metadata and automatic publication. No subscription or paid inference is required by saving this plan.

The first portability milestone is complete only when Codex and a second real configuration have demonstrated the same core workflow and its required evidence. Documentation must state exactly which combinations were tested, their limitations and how to change a profile. A broad claim that RIFF works with every model is not a completion criterion.

The next implementation action, if commissioned, is step 1. Keep this file as the design reference, use `PROJECT.md` and `ROADMAP.yaml` as the execution authorities once established, and update public documentation as capabilities ship rather than describing this proposal as already implemented.
