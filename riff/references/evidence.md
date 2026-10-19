# Candidate evidence and verification reports

Stage the complete candidate before verification; `git write-tree` is its identity. Keep transient evidence inside `.riff-data/`; never commit credentials, private screenshots or raw sensitive responses.

## Discovery evidence

For a project with `docs/specs/readiness.json`, run `discovery snapshot` once the dossier is written. Its digest covers the manifest, `PROJECT.md`, `ROADMAP.yaml`, `taste.md` and every declared artifact. The reviewer reads those files and judges story and phase coverage, data and permission contracts, architecture, wireframes and design, risks, verification criteria and contradictions. The artifact uses the review shape below with `type: "discovery"` and `candidate` set to the digest. Record it with `discovery review --evidence FILE`, then run `discovery check`. Changed dossier bytes invalidate the review; missing sections, blocking assumptions or an absent promised design can't pass.

## Frozen criteria and decision records

`done_when` and `verify` are frozen when the phase is activated: `wave sync` keeps the activated wording (it only fills them in for a phase that had none) and reviewers judge against it. Editing the roadmap text mid-phase does not change the contract and a reviewer will flag it as a contract change. When the implementation legitimately departs from a criterion's wording (for example Web Audio instead of MediaRecorder to enforce an exact five-second cap), keep the criterion and record why with `riff wave decision <phase> --type contract --note "what changed, why, and how the original intent is still met"`. `review run` passes every decision of the phase to the reviewer. A new or wider outcome is not a decision: add a phase.

## Executed validation

```sh
node .riff-cli/bin/riff.mjs wave validate phase-1 --run --command '["npm","test"]' --paths '["src","test","package.json"]'
```

The CLI executes the argv without a shell, with a 60-second limit. Choose a bounded check that fits that limit. Paths must cover exactly the authorized files or directories changed since activation. Tracked unstaged changes are rejected, with the list of files: stage the ones that belong to the phase and restore the others (a formatter run on a whole folder is the usual cause). After a correction, `wave validate phase-1 --rerun` restages the same paths and repeats the last command and manifest. A command that changes the candidate fails validation. Legacy `--status` declarations remain recordable but cannot satisfy completion. Every executed validation produces `.uxtest/runs/<run-id>/report.html`, `run.json` and `UX-REPORT.md`. The HTML is standalone and includes command output; review output for sensitive content before sharing.

## Browser evidence

For changed user journeys, run the actual flow with the installed browser capability and save real screenshots locally. Cover the affected acceptance criteria and useful error states, without rerunning unrelated journeys. If the browser cannot resize to a narrow width on this host, render the same bundle headless at that width and say so in the step's `observed` text. Write a JSON manifest such as:

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

### Journeys with several signed-in users

A journey where one user acts and another confirms (owner and client, admin and member) needs two real identities in the same verification run. Do not write the second user's action straight into the database: the step would prove nothing about the interface. When the app uses a local auth stub, make the stub return the user named in the request token instead of one fixed synthetic user, then sign each browser context in with its own token:

```ts
// Local and test environments only: never reachable in production builds.
const TEST_USERS = {
  owner: { id: "00000000-0000-4000-8000-000000000001", email: "owner@example.test", role: "owner" },
  client: { id: "00000000-0000-4000-8000-000000000002", email: "client@example.test", role: "member" },
} as const;

export function stubUserFromRequest(request: Request) {
  if (process.env.NODE_ENV === "production" || process.env.AUTH_STUB !== "1") return null;
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "")
    ?? new URL(request.url).searchParams.get("as");
  return token && token in TEST_USERS ? TEST_USERS[token as keyof typeof TEST_USERS] : null;
}
```

Use one browser context per identity, and name the identity in each manifest step (`"observed": "client@example.test sees the confirmed plan"`). Seed the second user through the app's own setup path or a fixture script, not hand-written rows. Keep the stub behind an explicit environment flag and out of production bundles.

Existing consumers should run `resync` to install the new local report exclusion; this preserves their project artifacts and preferences.

The shared roadmap flag `smoke_test: true` also requires passing verification evidence. A smoke test exercises the phase's essential user outcome, such as opening a phase, completing a form or reaching a confirmation. Opening a browser alone is insufficient. Reuse an existing observed check when it covers that outcome for the same candidate and target; do not rerun it merely to produce a second label or report. Record the actual target URL and whether remote integrations used real or sandbox services. A local or sandbox success does not establish deployed production behavior. This flag does not install monitoring or force browser checks on unrelated nonvisual phases.

Reports embed the image bytes, remain readable without a server and appear in the dashboard UX runs with screenshot and report links. Completion verifies the saved report hash. Link the actual HTML in the final response. Do not require screenshots for nonvisual unit tests; their command results belong in the same report.

## Fresh review artifact

After executed validation, run `node .riff-cli/bin/riff.mjs review run --type functional` (or `security`, `discovery`, `delivery`; `--type functional,security` runs both in parallel and returns when both are done; in a phase batch, `--phase a,b` reviews every phase of the batch at once, each with its own owned paths). Each review type is bounded by `--timeout-minutes` (default 25, configurable as `reviewers.runTimeoutMinutes`); a review that exceeds it is stopped and nothing is recorded. The review bridge checks the candidate the same way the record commands do, builds a contract-based prompt from `references/review-prompts/` with the phase criteria and diff, and runs the first available reviewer of the chain read-only without a persistent session: by default `gpt-6-astra`, then `gpt-6.1-sol` through `codex exec`, then a fresh Claude Opus through `claude -p`. It skips a reviewer only when it can't run (missing CLI, not logged in, model unavailable, quota, timeout, a Codex sandbox that cannot start such as `bwrap ... RTM_NEWADDR`, output invalid twice), never because the verdict is negative. The status follows the findings: `fail` if any is HIGH or CRITICAL, otherwise `pass`. It writes the artifact under `.riff-data/reviews/` and prints the record command; run it. For a phase review the prompt also carries the validation receipt of the frozen candidate (command, exit code, candidate tree, run time, report path and an output excerpt) and the observed verification steps: the manifest attached with `--verification`, else the steps of the report written at that validation, else `.riff-data/verification/<phase>/manifest.json` or a manifest path named in `verify` (marked as earlier evidence when its candidate differs). The reviewer is told that execution is attested by the receipt, so a read-only reviewer no longer fails a round as "runtime unverified"; it still judges whether those checks cover each criterion. Evidence kept only in `.uxtest` or `.riff-data` therefore reaches the reviewer without committing it. `reviewer.skipped` and `reviewer.sameFamily` show any fallback and a reviewer from the builder's own model family. Override the chain, effort per type or timeout with a `reviewers` object in `.riff-data/config.json`. With `--quick` outside a phase, the artifact is advisory and has no record command. If no reviewer can run, use a fresh native subagent and say so: its artifact adds `"reviewedBy": "native-subagent"` and a `"fallbackReason"` naming why the bridge could not run. The record commands refuse a discovery, functional, security or delivery artifact that is neither the file `riff review run` wrote under `.riff-data/reviews/` nor such a declared fallback.

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

Review the integrated candidate against the phase's acceptance criteria and preserved behavior, including applicable design references. Functional and security reviewers may work in parallel on that frozen tree; implementers cannot change it underneath them. A repeated review of the unchanged failed candidate is not a correction. A fresh review must identify what was actually inspected and cannot merely repeat the implementer's conclusion.

## Review rounds, decisions and convergence

RIFF counts failed review rounds per phase and type in the state (one per failed candidate; recording the same failed candidate again does not count twice). Limits come from the `reviewers` object in `.riff-data/config.json`: `convergenceFromRound` (default 2) and `maxFailedRounds` (default 2). Only HIGH and CRITICAL findings fail a round. The reviewer is told to keep HIGH for an unmet `done_when` criterion or a regression in normal use, and to judge the change, not pre-existing code it does not touch.

- Record tradeoffs as you make them: `riff wave decision <phase> --note "what was chosen and why" [--type functional|security|contract]`. Every later review of the phase receives the decisions, so a reviewer judges the choice instead of reversing it silently.
- From round 2, the review is a re-review. `review run` adds the earlier failed rounds (findings with their location, files changed in response) and the diff since the last failed round. The reviewer checks that earlier HIGH and CRITICAL findings are fixed. A new HIGH is allowed only if the latest change introduced it or a `done_when` criterion is plainly unmet; any other new problem is MEDIUM at most. A finding that reverses an earlier fix or conflicts with another contract gets a title starting `CONFLICT:`; pick one contract and record a decision, or park for the human. Do not flip the earlier fix back.
- A MEDIUM or lower finding you choose not to fix, at any round, can be recorded as a known residual risk with `riff wave risk <phase> --kind crash-window|runtime-unverified|edge-case --severity S --summary "..." --note "why it stays open"`. It is listed for the human at `finish --check`, and later reviews don't report it again.
- After 2 failed rounds of one type, `review run` refuses another round. Record what is left with `riff wave risk`, then `riff wave park <phase> --kind validation-failure --reason "<conflict summary>"`. The refusal prints the round log to build that summary. Only the owner resumes it: `riff wave resume <phase> --reason "<decision>"` records the decision and allows one more round, not a fresh count.
- The owner may instead stop the rounds and accept what is left: `riff wave complete <phase> --commit HEAD --accept-risks --reason "<owner decision>"`. It is refused unless the phase is active or parked with no other phase active, its dependencies are complete, an executed validation passed for the exact commit tree, each required review type either passed for that tree or reached the failed-round limit, and every HIGH or CRITICAL finding of the last failed round of each such type is recorded with `riff wave risk` (summary equal to the finding title, or `--finding "<title>"`). The refusal prints the missing `wave risk` commands. Pending HIGH or CRITICAL observations still block. The phase becomes `completed`, so dependent phases become ready; it keeps an `acceptance` record (source `owner`, reason, commit, waived review types, residual risks) and an owner decision. `finish --check` accepts the waived review types for that commit and lists the phase as accepted with residual risks for the final report; the delivery review sees it marked the same way. The agent runs this command only on the owner's explicit instruction, never on its own, in `loop` mode included.
- `riff wave context` shows the failed round counts and the decisions.

## Final delivery evidence

After the last phase, run the whole-version checks from the [operating contract](operating-contract.md#whole-version-verification) and get a `delivery` review on the final tree, with the real commands or journeys, results, target and report paths in `evidence`. A list of phase names or "all tests passed" isn't evidence. Record it with `finish --review FILE`, then run `finish --check`, which verifies terminal phases, preserved receipts, reachable commits, a clean worktree and, for enrolled projects, the discovery contract and delivery review. It never pushes, merges or deploys. A failed delivery review leads to a correction phase.

## Production lifecycle

`promote` shows the scope. For an explicitly requested promotion, prepare `PROJECT.md`, `ROADMAP.yaml` and `taste.md`, stage them, get `architecture`, `roadmap` and `functional` reviews (plus `security` for a sensitive project) in the same shape, then run `promote --apply --architecture FILE --roadmap FILE --functional FILE [--security FILE]`. It blocks unresolved active work and initializes `INCIDENTS.md`; it grants no deployment permission.

`incident log --evidence FILE` appends a resolved incident once per id to `INCIDENTS.md`, with `id`, `title`, `severity` (`low` to `critical`), `impact`, `rootCause` and `prevention`.

`wave resume` keeps the worktree and index. If HEAD already holds the validated candidate, the tree is clean and the gates hold, it completes the active phase without another commit or test run; otherwise it reports what can be reused.
