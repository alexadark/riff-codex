# Project framing

Use this reference for a complete scoped-version dossier. The trigger is either an explicit request to plan a full application or a new application intended for production. Scratch work, a bounded risk probe, a small existing application with one clear outcome, and `$riff:quick` stay lightweight unless the user explicitly asks for the full application plan. The [discovery contract](discovery.md) owns the readiness manifest and review lifecycle.

RIFF owns phases, dependencies, validation, review, and completion gates. Project framing adds product clarity; it does not create another orchestrator, another state system, or a mandatory technical interview. Reuse user answers, repository documents, existing specifications, approved templates, project taste, and prior phase decisions. Ask only a product, user-visible, data, permission, integration, or authority question that can change the committed boundary and cannot be inferred.

## Product synthesis in `PROJECT.md`

`PROJECT.md` is the concise product synthesis and index. Keep detailed supporting material in existing project paths or under `docs/specs/` and `docs/diagrams/`, then link it from the relevant section. Preserve useful existing prose and links with targeted edits. Do not turn `PROJECT.md` into a second roadmap or a file-by-file implementation plan.

Use stable IDs throughout the dossier:

- outcomes: `O-###`;
- user stories: `S-###`, written as `As a <actor>, I want <capability>, so that <benefit>`;
- observable acceptance criteria: `AC-###`, each testable and linked to one or more stories;
- journeys, screens, data entities, decisions, risks, and phases: `J-###`, `UI-###`, `D-###`, `DEC-###`, `R-###`, and `P-###` as applicable.

The synthesis should link these views when they exist:

### Product and users

State the outcome, users, vocabulary, value signal, included version, explicit exclusions, assumptions, facts, preferences, and later fog of war. Describe the important journeys and map each story and criterion to the phase that delivers or unlocks it. Include normal, empty, error, recovery, privacy, authorization, and audit behavior when relevant.

### Data and rights

For each entity that affects behavior, identity, retention, authorization, or integration, document its owner and source of truth. List fields with their types, required or nullable status, defaults, keys, uniqueness, foreign keys, constraints, and the reason for each non-obvious index. State relationships and cardinality, lifecycle and state transitions, invariants, tenancy isolation, migration and rollback constraints, retention, masking, export, and deletion behavior. Map who may read, create, change, export, publish, or delete sensitive records. If the product has no durable or sensitive data, say why and link the relevant verification boundary.

### Architecture and integrations

Describe the smallest architecture that delivers the committed outcomes: boundaries, responsibilities, persistence, entry points, and failure handling. For each API or external integration, record purpose, direction of data flow, identity mapping, request and response or event contract, idempotency, retry and failure behavior, secret or permission boundary, and verification evidence. Record material decisions with the chosen option, reason, rejected alternatives, reversibility, and the condition that would reopen the decision.

### Experience and design handoff

List screens and states, responsive journeys, and ASCII wireframes that show hierarchy and the primary action. Map each screen and state to the stories and criteria it serves. Record the design provenance: an approved external reference, an available but not yet received reference, or RIFF-native design explicitly authorized by the user. The handoff includes the reference or source path, returned tokens, component and interaction rules, responsive behavior, content and state rules, and mappings to `UI-###`, `S-###`, and `AC-###`. A missing promised external reference is an external dependency, not permission to replace it or a human technical approval state.

### Diagrams and verification

Link actual Mermaid source files, not only rendered images. Include architecture, an ER diagram when the data model is non-empty, sequence diagrams for critical paths, and state diagrams for meaningful lifecycle or UI state machines. Verify syntax with an available renderer when possible. If no renderer is available, record the exact unverified check and do not claim syntax proof. Define the evidence needed for each important criterion and distinguish executed evidence, external evidence, and attestation.

Include the applicable security, privacy, accessibility, performance, observability, backup and recovery requirements. Make consequential targets observable and connect them to acceptance criteria, the test environment and a verification method. Keep requirements proportional to the committed product and record reasons for inapplicable areas.

### Scope and phase map

`ROADMAP.yaml` remains the canonical phase list. Each vertical phase keeps its existing stable identifier or receives a stable ID such as `P-###` when it is new, plus a demonstrable user outcome, a justified `P0` to `P3` priority, dependencies, blocking edges, risks, and mappings to the stories and criteria it advances. Keep phase descriptions at outcome and contract level. Do not invent exact files, exhaustive future tests, or implementation detail unsupported by current evidence. The roadmap must cover the committed version; future versions remain indicative and clearly separated.

## Before implementation

Complete the whole committed-version dossier before any implementation wave. A UI product needs its actual design reference and tokens; a recorded but unresolved external-design dependency keeps the dossier incomplete. Bounded isolated risk probes may inform a decision, but are not product implementation. An independent reviewer reviews the full dossier, not a subset. Apply corrections automatically, refresh the candidate manifest, and obtain a review tied to the new digest. Evidence records what was attested or observed; it does not prove the underlying product claims.

## Light path

For scratch work and bounded changes, capture only the product outcome, affected behavior, facts, assumptions, scope, and the smallest useful roadmap entry. Reuse existing `PROJECT.md`, `ROADMAP.yaml`, specifications, and taste. Do not manufacture stories, data models, diagrams, design packages, or readiness areas that have no bearing on the bounded request. A later explicit full-app or production request promotes the work to the complete dossier path.

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
