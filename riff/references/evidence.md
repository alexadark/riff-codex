# Candidate evidence and verification reports

Stage the complete candidate before verification. `git write-tree` is its identity. Keep transient evidence inside `.riff-data/`; never commit credentials, private screenshots or raw sensitive responses.

## Discovery evidence

For a project with `docs/specs/readiness.json`, run `discovery snapshot` after completing the dossier. The returned digest covers the manifest, `PROJECT.md`, `ROADMAP.yaml`, `taste.md` and all declared artifact files. An independent reviewer reads those actual files and assesses story/phase coverage, data and permission contracts, architecture rationale, wireframes and design, risk evidence, verification criteria and contradictions.

Use the review artifact shape below with `type: "discovery"` and `candidate` set to that digest rather than a Git tree. Record it with `discovery review --evidence FILE`, then run `discovery check`. The gate verifies structure, content identity and saved review integrity; it cannot determine whether the reviewer really understood a design or ran a probe. Missing sections, unresolved implementation-blocking assumptions or an absent promised design must not receive a passing review. Changed dossier bytes invalidate the review. Reference supplementary taste/design files in the manifest so they participate in the digest.

## Executed validation

```sh
node .riff-cli/bin/riff.mjs wave validate phase-1 --run --command '["npm","test"]' --paths '["src","test","package.json"]'
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
    "screenshot": ".riff-data/verification/confirmation.png"
  }]
}
```

Use `pass`, `fail` or `unverified` for each observed step. Never fabricate a screenshot or mark an unavailable journey passed. Attach the manifest with `wave validate ... --verification FILE`. A phase with `verification_required: true` (or `verification.required: true`, or HITL mode) cannot complete without passing verification. For quick work outside a phase, use `node .riff-cli/bin/riff.mjs report --evidence FILE`; this bundles observations but does not itself execute tests or grant a phase receipt.

Existing consumers should run `resync` to install the new local report exclusion; this preserves their project artifacts and preferences.

The shared roadmap flag `smoke_test: true` also requires passing verification evidence. A smoke test exercises the phase's essential user outcome, such as opening a phase, completing a form or reaching a confirmation. Opening a browser alone is insufficient. Reuse an existing observed check when it covers that outcome for the same candidate and target; do not rerun it merely to produce a second label or report. Record the actual target URL and whether remote integrations used real or sandbox services. A local or sandbox success does not establish deployed production behavior. This flag does not install monitoring or force browser checks on unrelated nonvisual phases.

Reports embed the image bytes, remain readable without a server and appear in the dashboard UX runs with screenshot and report links. Completion verifies the saved report hash. Link the actual HTML in the final response. Do not require screenshots for nonvisual unit tests; their command results belong in the same report.

## Fresh review artifact

After executed validation, run `node .riff-cli/bin/riff.mjs review run --type functional` (or `security`, `discovery`, `delivery`). The review bridge checks the candidate the same way the record commands do, builds an adversarial prompt from `references/review-prompts/` with the phase criteria and diff, and runs the first available reviewer of the chain read-only without a persistent session: by default `gpt-6-astra`, then `gpt-6.1-sol` through `codex exec`, then a fresh Claude through `claude -p`. It skips a reviewer only when it can't run (missing CLI, not logged in, model unavailable, quota, timeout, output invalid twice), never because the verdict is negative. A HIGH or CRITICAL finding forces `fail`. It writes the artifact under `.riff-data/reviews/` and prints the record command; run it. `reviewer.skipped` and `reviewer.sameFamily` show any fallback and a reviewer from the builder's own model family. Override the chain, effort per type or timeout with a `reviewers` object in `.riff-data/config.json`. When the last recorded review of the same type failed, the bridge sends a recheck round: the reviewer only checks that the listed findings are corrected and reports a new finding only if it is CRITICAL. With `--quick` outside a phase, the artifact is advisory and has no record command. If no reviewer can run, use a fresh native subagent and say so.

The artifact shape, whichever reviewer wrote it:

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

Record it with `wave review phase-1 --type functional --status pass --summary "Observed outcome" --evidence FILE`. Use `security` for required security reviews; record findings with severity and evidence. A passing artifact cannot contain HIGH or CRITICAL findings. The CLI stores an immutable content-hashed copy. Reviewer independence is a recorded attestation, not a cryptographic guarantee; never invent another reviewer identity. Changing the tree requires fresh validation and review. A failed security review records its findings as observations without parking the phase; correct and review again, as described in the [security reference](security.md).

Review the integrated candidate against the phase's acceptance criteria and preserved behavior, including component/service reuse and applicable design references. Functional and security reviewers may work in parallel on that frozen tree; implementers cannot change it underneath them. A repeated review of the unchanged failed candidate is not a correction. A fresh review must identify what was actually inspected and cannot merely repeat the implementer's conclusion.

## Final delivery evidence

After terminal phases, the agent executes the remaining whole-version checks in [execution](execution.md#whole-version-verification) and obtains an independent review with `type: "delivery"`, `candidate: "<git write-tree>"`, the real reviewer identity, observations in `evidence` and any findings. Include actual commands or observed journeys, results, environment/target and references to saved reports. A collection of phase names or an assertion that “all tests passed” is insufficient substantive evidence.

For enrolled projects, record `node .riff-cli/bin/riff.mjs finish --review FILE`, then `finish --check`. The review is bound to the final candidate and preserved as integrity-checked evidence, not a replacement for executed verification. The CLI also checks historical phase evidence and terminal state. A changed final candidate needs an updated final review and the affected checks. A failed final review triggers an in-scope correction phase; preserve completed phase history and follow normal validation/review gates. These commands never publish. See [Git delivery](git-delivery.md) for agent-operated draft publication after a completed phase and final PR readiness after these gates pass. A draft PR is not final delivery evidence.

## Production lifecycle

`promote` inspects the current scope. Prepare shared `PROJECT.md`, `ROADMAP.yaml` and `taste.md`, stage them, then obtain independent architecture, roadmap and functional artifacts in the same review format with types `architecture`, `roadmap` and `functional`. Run `promote --apply --architecture FILE --roadmap FILE --functional FILE` only for an explicitly requested scope promotion. Load the security reference and also supply `--security FILE` when the project touches a sensitive boundary. It preserves phases, blocks unresolved active work, stores the reviews and initializes `INCIDENTS.md`. Scope promotion grants no deployment permission.

For a resolved incident, `incident log --evidence FILE` appends once per id to `INCIDENTS.md`. Its JSON fields are `id`, `title`, `severity` (`low`, `medium`, `high`, `critical`), `impact`, `rootCause`, and `prevention`. Record confirmed facts and any still-unknown cause honestly. Review recurring causes directly from this ledger when requested; do not create an automatic audit cadence.

`finish --check` verifies terminal phases, preserved validation and reviews, commits reachable from HEAD, and a clean worktree. Enrolled projects also need an intact current discovery contract and final delivery review. It reports local delivery readiness; it never pushes, merges or deploys. Unenrolled existing projects retain the historical checks and are not enrolled by a refresh.

`wave resume` preserves the worktree and index after interruption. If HEAD already contains the validated candidate, the tree is clean and the same passing review/evidence gates hold, it completes that active phase without another commit or test run. Otherwise it reports what can be reused and leaves the phase active. Changed or missing evidence cannot complete recovery. No commit trailers, PR metadata dossier, reset, stash or automatic publication is required.
