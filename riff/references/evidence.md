# Candidate evidence and verification reports

Stage the complete candidate before verification. `git write-tree` is its identity. Keep transient evidence inside `.riff-codex-state/`; never commit credentials, private screenshots or raw sensitive responses.

## Executed validation

```sh
node .riff-codex/bin/riff.mjs wave validate phase-1 --run --command '["npm","test"]' --paths '["src","test","package.json"]'
```

The CLI executes the argv without a shell, with a 60-second limit. Choose a bounded check that fits that limit. Paths must cover exactly the authorized files or directories changed since activation. Tracked unstaged changes are rejected. A command that changes the candidate fails validation. Legacy `--status` declarations remain recordable but cannot satisfy completion. Every executed validation produces `.uxtest/runs/<run-id>/report.html`, `run.json` and `UX-REPORT.md`. The HTML is standalone and includes command output; review output for sensitive content before sharing.

## Browser evidence

For changed user journeys, run the actual flow with the installed browser capability and save real screenshots locally. Cover the affected acceptance criteria and useful error states, without rerunning unrelated journeys. Write a JSON manifest such as:

```json
{
  "version": 1,
  "candidate": "<git write-tree>",
  "title": "Checkout verification",
  "steps": [{
    "name": "Completed checkout",
    "kind": "browser",
    "status": "pass",
    "expected": "Order confirmation appears",
    "observed": "Confirmation and order number displayed",
    "url": "http://localhost:3000/confirmation",
    "viewport": "390 x 844",
    "screenshot": ".riff-codex-state/verification/confirmation.png"
  }]
}
```

Use `pass`, `fail` or `unverified` for each observed step. Never fabricate a screenshot or mark an unavailable journey passed. Attach the manifest with `wave validate ... --verification FILE`. A phase with `verification_required: true` (or `verification.required: true`, or HITL mode) cannot complete without passing verification. For quick work outside a phase, use `node .riff-codex/bin/riff.mjs report --evidence FILE`; this bundles observations but does not itself execute tests or grant a phase receipt.

Existing consumers should run `resync` to install the new local report exclusion; this preserves their project artifacts and preferences.

Reports embed the image bytes, remain readable without a server and appear in the dashboard UX runs with screenshot and report links. Completion verifies the saved report hash. Link the actual HTML in the final response. Do not require screenshots for nonvisual unit tests; their command results belong in the same report.

## Fresh review artifact

After executed validation, a fresh independent reviewer inspects the staged candidate and writes:

```json
{
  "version": 1,
  "candidate": "<git write-tree>",
  "type": "functional",
  "status": "pass",
  "reviewer": {"id": "<actual reviewer identity>", "independent": true},
  "evidence": ["<inspected path, observed behavior and check result>"],
  "findings": []
}
```

Record it with `wave review phase-1 --type functional --status pass --summary "Observed outcome" --evidence FILE`. Use `security` for required security reviews; record findings with severity and evidence. A passing artifact cannot contain HIGH or CRITICAL findings. The CLI stores an immutable content-hashed copy. Reviewer independence is a recorded attestation, not a cryptographic guarantee; never invent another reviewer identity. Changing the tree requires fresh validation and review. The security review command itself parks blocking findings.

## Production lifecycle

`promote` inspects the current scope. Prepare shared `PROJECT.md`, `ROADMAP.yaml` and `taste.md`, stage them, then obtain independent architecture, roadmap and functional artifacts in the same review format with types `architecture`, `roadmap` and `functional`. Run `promote --apply --architecture FILE --roadmap FILE --functional FILE` only for an explicitly requested scope promotion. Load the security reference and also supply `--security FILE` when the project touches a sensitive boundary. It preserves phases, blocks unresolved active work, stores the reviews and initializes `INCIDENTS.md`. Scope promotion grants no deployment permission.

For a resolved incident, `incident log --evidence FILE` appends once per id to `INCIDENTS.md`. Its JSON fields are `id`, `title`, `severity` (`low`, `medium`, `high`, `critical`), `impact`, `rootCause`, and `prevention`. Record confirmed facts and any still-unknown cause honestly. Review recurring causes directly from this ledger when requested; do not create an automatic audit cadence.

`finish --check` verifies terminal phases, preserved validation and reviews, commits reachable from HEAD, and a clean worktree. It reports readiness for an explicitly authorized Git finalization; it never pushes, merges or deploys.
