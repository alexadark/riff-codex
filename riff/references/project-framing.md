# Large-project framing

Use this reference only for a substantial RIFF project. The trigger is a project with several dependent outcomes, multiple user roles or system boundaries, a multi-system integration, or an explicit request for a large-project frame. A small application with one clear outcome, a bounded feature, `$riff:quick`, and independent APEX work keep their existing lightweight flow.

RIFF remains the owner of phases, dependencies, validation, review, and completion gates. This framing adds product clarity; it does not create a second orchestrator, a second state system, or a mandatory interview. Reuse answers, repository documents, and prior phase decisions already available in the project. Ask only when an unresolved choice can change the product boundary, a user-visible behavior, a data or permission contract, an external integration, or an authority boundary.

## Initial frame

For a large project, shape the initial `PROJECT.md` around these connected views. Keep verified facts, user preferences, explicit hypotheses, and open questions distinct.

### Product and user stories

- State the product outcome, users, shared vocabulary, and measurable signals of value.
- Capture the meaningful user journeys as numbered stories: `As a <actor>, I want <capability>, so that <benefit>`.
- Give each important story observable acceptance criteria. Cover the normal journey and the relevant empty, error, recovery, privacy, authorization, and audit cases.
- Link stories to one or more product outcomes or phases so that the roadmap explains which user value each phase delivers.

### Data, relationships, and rights

- Name the entities and the ownership of each source of truth.
- Describe important fields or identifiers only where they affect behavior, identity, retention, or integration.
- Record relationships and cardinality, lifecycle and state transitions, invariants, uniqueness, tenancy boundaries, and migration or rollback constraints.
- Describe who can read, create, change, export, publish, or delete each sensitive entity. Make least privilege, masking, auditability, retention, and deletion behavior explicit where they matter.

### Architecture and integrations

- Describe the smallest architecture that can deliver the outcomes: boundaries, responsibilities, persistence, and user-visible entry points.
- For each external system, record the purpose, direction of data flow, contract or event boundary, identity mapping, idempotency, retry/failure behavior, and the evidence needed to verify it.
- Record material decisions with the chosen option, reason, rejected alternatives, reversibility, and the condition that would make the decision worth revisiting. Do not turn ordinary reversible choices into a human handoff.

### Scope and phases

- Define included outcomes, explicit exclusions, and the fog of war that belongs to later discovery.
- Break the work into vertical, demonstrable phases. Each phase must connect to the stories and criteria it advances, name real dependencies and blocking edges, and carry a justified P0-P3 priority.
- Keep the initial frame at outcome and contract level. Do not invent a file-by-file implementation plan, exhaustive future test list, or phase detail that the current evidence cannot support.

Recommended headings are `Product outcome`, `Users and stories`, `Acceptance criteria`, `Data model and rights`, `Architecture and integrations`, `Decisions`, `Scope and exclusions`, `Facts`, `Preferences`, `Assumptions`, `Open questions`, and `Phase map`. Omit a heading when it has no useful content rather than filling a template mechanically.

## Deepen a phase when useful

When `$riff:add-phase` or `$riff:wave` needs more detail, extend the existing frame instead of starting a new interview. Reuse the relevant story IDs, criteria, entities, relationships, rights, integrations, decisions, and answers already recorded. Add only what the selected phase needs:

- the user-visible outcome and the stories it completes or unlocks;
- phase-specific acceptance criteria, including failure and permission behavior;
- the data and ownership boundaries touched;
- integration contracts, verification evidence, and rollback or recovery behavior;
- the dependency, risk, sensitivity, and exclusion that explain its order.

Keep the roadmap phase itself concise enough to remain a demonstrable tracer bullet. Put extended rationale in the existing project or phase documentation chosen by the repository; never replace the shared roadmap with a parallel planning system. A phase may be deepened during execution, but new scope still follows `$riff:add-phase` and active phases retain RIFF's validation, review, receipt, and completion gates.

## GitHub issue projection

GitHub issues are an explicit delivery projection, never an automatic side effect of framing or wave completion. Create them only when the user asks RIFF to publish an issue. Read the current project frame and roadmap first, then group work by useful user or product outcome. One issue may contain the connected stories, criteria, data or permission boundary, integration notes, dependencies, and validation boundary needed to deliver that outcome.

Do not create microtask issues, implementation checklists disguised as issues, or a historical PR dossier. Omit old pull request numbers, branch names, review metadata, commit history, and stale delivery status unless the current request specifically needs a present release reference. `PROJECT.md` and `ROADMAP.yaml` remain canonical after publication.

Use this body shape when publishing an issue:

```markdown
## Outcome

<The user-visible result and why it matters>

## User stories and acceptance criteria

<Connected stories with observable criteria>

## Data, permissions, and integrations

<Relevant entities, rights, contracts, and failure boundaries>

## Scope and dependencies

<Included work, exclusions, phase dependencies, and risks>

## Validation boundary

<Evidence required to call this outcome complete>
```

Before an explicit publication, verify the repository remote, `gh` authentication, the target repository, and whether a matching open issue already exists. Verify the created issue URL and title after `gh issue create`; do not claim publication from a command that only prepared a draft.
