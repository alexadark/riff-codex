# Discovery dossier and readiness contract

This is the canonical reference for `$riff:start` when it produces a complete scoped-version dossier. It complements [project framing](project-framing.md), which defines the product content in `PROJECT.md` and the phase map in `ROADMAP.yaml`.

## Scope and boundary

Use the complete path when the user explicitly asks for a full application plan or asks to plan a new application for production. Use the light path for scratch work, bounded risk probes, and `$riff:quick`. A small existing application with one clear outcome may remain light. An explicit full-app request takes precedence over a convenient light interpretation.

The complete path plans the entire committed version before implementation. It does not require an exhaustive plan for later versions. It may run bounded, isolated prototypes to test a material risk, but a probe cannot become a product feature or an implementation wave. No phase becomes active until the complete dossier and its independent review pass. `start` stops after the dossier and its independent review. Only a separate `$riff:wave` request may activate implementation.

## Sources and preservation

Inspect the repository, `node .riff-codex/bin/riff.mjs doctor`, configured autonomy, current `PROJECT.md`, `ROADMAP.yaml`, `taste.md`, relevant taste topics and stack references, approved templates, and existing supporting specifications before asking questions. Use repository and user precedence in this order: explicit current user instruction, repository instructions and existing behavior, approved external or project design reference, project taste and stack evidence, then the smallest reversible inference. Do not ask the user for technical facts Codex can establish from those sources.

`PROJECT.md` is the product synthesis and index. `ROADMAP.yaml` is the canonical phase list. Existing documents and specs may be reused in place. New detail may live under existing project paths or `docs/specs/` and `docs/diagrams/`; link it from the synthesis. Preserve unrelated content, comments, key order, unknown fields, and existing document paths with targeted edits.

Keep verified facts, user preferences, explicit hypotheses, and open questions distinct. Open questions that do not change the committed boundary belong to later fog of war. In `loop`, resolve ordinary product and technical ambiguity conservatively and record the assumption. In `guided`, ask only the few product or authority decisions that cannot be inferred and materially change the boundary. Never turn a missing design artifact into a technical interview or an `awaiting_human` product decision.

## Dossier quality bar

The complete dossier must include useful content, or an explicit reason, for each applicable area:

- product outcome, users, vocabulary, scope, exclusions, facts, preferences, assumptions, and later fog of war;
- stable story IDs and observable criterion IDs, including normal, empty, error, recovery, privacy, authorization, and audit behavior where applicable;
- journey IDs, screens, states, responsive ASCII wireframes, and mappings from screens and journeys to stories and criteria;
- data entities with fields, types, nullability, defaults, keys, uniqueness, foreign keys, constraints, index reasons, relationships, cardinality, lifecycle, rights, retention, deletion, and tenancy;
- architecture boundaries, responsibilities, persistence, entry points, APIs and external integrations, with identity, contracts, idempotency, retries, failure handling, permissions, and verification evidence;
- decisions with chosen option, reason, rejected alternatives, reversibility, and revisit condition, justified from repository, template, stack, taste, or explicit user direction;
- risks with bounded probes and outcomes, verification strategy and evidence boundaries, explicit exclusions, and a phase map linking stories and criteria to stable roadmap phase IDs;
- applicable cross-cutting requirements: security and privacy, accessibility, measurable performance expectations, observability, backup and recovery, and operational limits. Link each consequential requirement to its verification method and target environment; justify omissions instead of copying generic targets;
- a design handoff package or explicit external dependency, with reference provenance, tokens, components, responsive behavior, state rules, and mappings to screens and criteria;
- actual Mermaid `.mmd` files for architecture, ER when data exists, critical-path sequences, and applicable state diagrams, linked from the dossier and syntax-checked when a renderer is available.

Do not add empty headings or placeholder files. For an inapplicable area use `not_applicable` with a concrete reason in the manifest and explain any consequential omission in the linked synthesis. For example, “no durable data: the application reads an immutable local asset and writes no user or service state” is useful; “none” is not.

## Design handoff and external references

Before any implementation wave, record one of these states:

1. `received`: the user-provided or approved reference is available at a verifiable local path, or its external URL has an immutable local capture or reference version. Its screens, tokens, components, responsive rules, and states are mapped to the dossier. The local capture, reference version, and token files needed to reproduce the handoff are listed in the readiness manifest;
2. `pending_external`: the user promised a reference that is not available yet. Continue independent product, data, architecture, and roadmap planning, record the dependency and affected criteria, and wait for the artifact before any implementation wave. If access to the promised artifact is required to proceed, record the real `credentials-or-access` dependency; do not turn it into an approval round;
3. `riff_native_authorized`: the user explicitly authorized RIFF to establish the design. Record that authorization, use the applicable design skills and project taste, and map the resulting reference and tokens to screens and criteria.

Never invent a received reference, silently substitute a generic design, or start a UI-only pipeline while the rest of the product plan is incomplete. Missing external material is a real external dependency. It is not a request for technical approval.

`pending_external` is a preparation state, never a ready design. A dossier that still requires the missing reference cannot receive a passing discovery review or begin any implementation phase, including backend work. Nonvisual products use a justified `not_applicable` design area.

## Readiness manifest API

The complete dossier writes `docs/specs/readiness.json` with version `1`. Its `areas` object has exactly these named areas:

`product`, `stories`, `journeys`, `wireframes`, `design`, `data`, `architecture`, `verification`, `risks`, `roadmap`, `decisions`, and `diagrams`.

Every area is either a non-empty relative `files` array or a `not_applicable` string with a substantive reason (at least ten characters; length alone does not establish relevance). Do not use both forms for one area. The listed paths must exist as nonempty regular project-owned files, stay inside the project without symlinks or traversal, and contain the dossier material for that area. The mandatory project files are `PROJECT.md`, `ROADMAP.yaml`, and `taste.md`, in addition to the manifest itself.

Illustrative shape:

```json
{
  "version": 1,
  "areas": {
    "product": { "files": ["PROJECT.md"] },
    "stories": { "files": ["docs/specs/stories.md"] },
    "journeys": { "files": ["docs/specs/journeys.md"] },
    "wireframes": { "files": ["docs/specs/wireframes.md"] },
    "design": { "files": ["docs/specs/design-handoff.md"] },
    "data": { "files": ["docs/specs/data-model.md"] },
    "architecture": { "files": ["docs/specs/architecture.md"] },
    "verification": { "files": ["docs/specs/verification.md"] },
    "risks": { "files": ["docs/specs/risks.md"] },
    "roadmap": { "files": ["ROADMAP.yaml"] },
    "decisions": { "files": ["docs/specs/decisions.md"] },
    "diagrams": { "files": ["docs/diagrams/architecture.mmd"] }
  }
}
```

The CLI owns the canonical serialization and SHA256 calculation. `PROJECT.md`, `ROADMAP.yaml`, `taste.md`, the manifest, and every listed file form the candidate content. `node .riff-codex/bin/riff.mjs discovery snapshot` returns the resulting digest. A changed or removed mandatory or listed file makes a previous review stale. Supporting documents, design captures, tokens, and Mermaid sources must be explicitly listed; an unlisted change is not detectable by this contract. An external URL alone is not immutable content for the digest.

## Independent review and checks

The independent discovery review artifact has this existing version 1 shape:

```json
{
  "version": 1,
  "candidate": "<digest>",
  "type": "discovery",
  "status": "pass",
  "reviewer": { "id": "<independent-reviewer>", "independent": true },
  "evidence": ["<path-or-attestation>"],
  "findings": []
}
```

The reviewer must be independent of the authoring pass. Findings are corrected in the dossier, then the candidate is snapshotted and reviewed again. Evidence is an attestation of what the reviewer checked; it is not proof of product truth, external availability, or implementation behavior.

Use the CLI lifecycle exactly:

```text
node .riff-codex/bin/riff.mjs discovery snapshot
node .riff-codex/bin/riff.mjs discovery review --evidence FILE
node .riff-codex/bin/riff.mjs discovery check
```

`discovery check` verifies the manifest structure, mandatory and listed files, current digest, and an intact passing independent review. `wave activate` enforces this readiness for enrolled projects. Legacy projects are not silently enrolled. Once a project is enrolled, removing the manifest cannot bypass the gate.

## Stop and handoff

After a passing discovery check, `start` may run `node .riff-codex/bin/riff.mjs wave sync` to refresh an enrolled project's derived state, then stops. It never activates a wave, invokes nested `codex exec`, publishes an issue, or deploys an application. External design access, a third-party verification, or an unavailable renderer may be recorded as unverified or pending with a precise reason; do not claim completion beyond the available evidence.
