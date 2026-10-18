# Candidate evidence and verification reports

Stage the complete candidate before verification; `git write-tree` is its identity. Keep transient evidence inside `.riff-data/`; never commit credentials, private screenshots or raw sensitive responses.

## Discovery evidence

For a project with `docs/specs/readiness.json`, run `discovery snapshot` once the dossier is written. Its digest covers the manifest, `PROJECT.md`, `ROADMAP.yaml`, `taste.md` and every declared artifact. The reviewer reads those files and judges story and phase coverage, data and permission contracts, architecture, wireframes and design, risks, verification criteria and contradictions. The artifact uses the review shape below with `type: "discovery"` and `candidate` set to the digest. Record it with `discovery review --evidence FILE`, then run `discovery check`. Changed dossier bytes invalidate the review; missing sections, blocking assumptions or an absent promised design can't pass.

## Executed validation

```sh
node .riff-cli/bin/riff.mjs wave validate phase-1 --run --command '["npm","test"]' --paths '["src","test","package.json"]'
```

The CLI runs the argv without a shell, with a 60-second limit, so pick a bounded check. Paths must cover exactly the files changed since activation; tracked unstaged changes are rejected, and a command that changes the candidate fails. Each run writes `.uxtest/runs/<run-id>/report.html`, `run.json` and `UX-REPORT.md`; check the output for sensitive content before sharing.

## Browser evidence

For a changed user journey, run the real flow in the browser and save real screenshots. Cover the affected criteria and useful error states, not unrelated journeys. Write a manifest:

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

Each step is `pass`, `fail` or `unverified`; never fabricate a screenshot or pass an unavailable journey. Attach it with `wave validate ... --verification FILE`. A phase with `verification_required: true` (or `verification.required`, or HITL mode) or `smoke_test: true` can't complete without passing verification; a smoke test exercises the essential outcome, not just opening a page. Record the target URL and whether integrations were real or sandbox. Reuse an observed check that already covers the same candidate. Nonvisual phases need no screenshots. Outside a phase, `riff report --evidence FILE` bundles observations into an HTML report without granting a receipt.

## Review artifact

After validation, run `node .riff-cli/bin/riff.mjs review run --type functional` (or `security`, `discovery`, `delivery`). Pass several types separated by commas (`--type functional,security`) to run the reviewers in parallel on the same candidate. The bridge builds an adversarial prompt from `references/review-prompts/` with the phase criteria and diff, and runs the first available reviewer of the chain read-only: by default `gpt-6-astra`, then `gpt-6.1-sol` through `codex exec`, then a fresh Claude through `claude -p`. It skips a reviewer only when it can't run, never because the verdict is negative. A HIGH or CRITICAL finding forces `fail`. It writes the artifact under `.riff-data/reviews/` and prints the record command; run it. Override the chain, effort per type or timeout with `reviewers` in `.riff-data/config.json`. After a failed review of the same type, the next round only rechecks the listed findings and reports a new finding only if CRITICAL. With `--quick` outside a phase the artifact is advisory. If no reviewer can run, use a fresh native subagent that didn't write the code and say so.

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

Record it with `wave review phase-1 --type functional --status pass --summary "Observed outcome" --evidence FILE`. A passing artifact can't contain HIGH or CRITICAL findings; the CLI stores an immutable hashed copy. Never invent a reviewer identity. A failed security review records its findings as observations without parking the phase: correct and review again ([security](security.md)).

## Final delivery evidence

After the last phase, run the whole-version checks from the [operating contract](operating-contract.md#whole-version-verification) and get a `delivery` review on the final tree, with the real commands or journeys, results, target and report paths in `evidence`. A list of phase names or "all tests passed" isn't evidence. Record it with `finish --review FILE`, then run `finish --check`, which verifies terminal phases, preserved receipts, reachable commits, a clean worktree and, for enrolled projects, the discovery contract and delivery review. It never pushes, merges or deploys. A failed delivery review leads to a correction phase.

## Production lifecycle

`promote` shows the scope. For an explicitly requested promotion, prepare `PROJECT.md`, `ROADMAP.yaml` and `taste.md`, stage them, get `architecture`, `roadmap` and `functional` reviews (plus `security` for a sensitive project) in the same shape, then run `promote --apply --architecture FILE --roadmap FILE --functional FILE [--security FILE]`. It blocks unresolved active work and initializes `INCIDENTS.md`; it grants no deployment permission.

`incident log --evidence FILE` appends a resolved incident once per id to `INCIDENTS.md`, with `id`, `title`, `severity` (`low` to `critical`), `impact`, `rootCause` and `prevention`.

`wave resume` keeps the worktree and index. If HEAD already holds the validated candidate, the tree is clean and the gates hold, it completes the active phase without another commit or test run; otherwise it reports what can be reused.
