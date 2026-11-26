# Learning across phases

Keep verified lessons in the project's existing `taste.md` and relevant `taste/` topics. These files are the shared memory for planning, implementation and review, including later sessions and the original RIFF framework. Lessons are separate from improvement proposals, described below.

When a correction or review establishes a reusable lesson, merge it into that topic before final candidate validation. Use one short entry containing:

- **When:** the concrete condition where this lesson applies.
- **Rule and reason:** what to do differently and which observed failure it prevents.
- **Evidence:** a repository path, regression check, incident or phase review that establishes the rule.

Check for an existing equivalent rule first (`riff lesson list`). Amend an obsolete rule with the evidence for the correction; do not append duplicates. Routine success and speculative advice need no entry. If no topic exists, create only the needed project-owned topic and link it from a writable project taste index. Follow the taste contract for symlinks and shared sources.

This learning is automatic within authorized work and shared across phases and roles, not across unrelated private projects. A reusable stack gap uses the `learn-stack` skill. A consumer never silently changes RIFF's framework references or another project's conventions. Framework-wide improvements belong to an explicitly authorized framework task.

## An error seen twice gets a check

A first occurrence keeps the narrow fix: no ladder, and a lesson only when it teaches something reusable. When the same error comes back (same cause, not just the same area), a sentence has already failed to stop it. Take the strongest rung that can, and say why each stronger one was passed over:

1. `architecture`: the mistake can't be written any more (one owner, one path, a smaller interface).
2. `types`: the compiler or the schema refuses it.
3. `lint_or_ci`: a rule or a CI job refuses it.
4. `test`: a test fails when it comes back.
5. Taste alone (`none`): only when no check can catch it, with the reason.

Stay with the one check that stops this error; don't harden what surrounds it.

Record both cases with `riff lesson record --file FILE`, a JSON object. It finds the lesson by its title, counts the new occurrence and writes the entry in its taste topic (`topic`, default `taste/lessons.md`). `seen` can state a higher count when the error is known to be older than its lesson.

```json
{
  "title": "Empty list totals",
  "when": "Reducing a list that can be empty.",
  "rule": "Give reduce an initial value: an empty cart crashed.",
  "evidence": "src/total.mjs, second crash",
  "enforced_by": {
    "rung": "test",
    "file": "test/total.test.mjs",
    "check": ["node", "--test", "test/total.test.mjs"],
    "evidence": { "before": "HEAD", "shows": "Reduce of empty array" }
  },
  "passed_over": {
    "architecture": "the helper is already the single owner",
    "types": "an empty array has the same type",
    "lint_or_ci": "no linter runs in this project"
  }
}
```

A first occurrence needs only `title`, `when`, `rule` and `evidence`; a repeat needs `title`, `evidence`, `enforced_by` and `passed_over`. For the last rung, `enforced_by` is `{ "none": "<why no check can catch it>" }` and `passed_over` covers the four others.

Stage the fix and its check first. RIFF runs the check on `before` (a commit that holds the error, `HEAD` by default), where it must fail and print `shows`, then on the staged candidate, where it must pass. A check that fails there only because a file or import the fix added is missing doesn't count; neither does a `shows` text that also appears after the fix. When that can't be shown (the old code needs a service that is gone), use `"evidence": { "cannot": "<reason>" }`; the reviewer reads it as an unproven check. If the recorded check let the error through, the next record needs a new proof of the corrected one.

The entry keeps these fields in a `yaml riff-lesson` block under its `##` heading (a heading of its own; a topic heading such as "Testing" without the lesson bullets is not a lesson). Amend the wording by hand; leave `seen` to the command. A recorded lesson may be renamed or moved unchanged; one that no longer applies keeps its block with `retired: "<reason>"` instead of disappearing. `riff wave validate --run`, `riff lesson check` and the pre-commit hook refuse a new or changed block that skips the ladder, lowers `seen`, removes a recorded lesson, or whose check doesn't hold. An entry without a block is valid as it is and counts as seen once.

## End-of-version improvement proposals

On the last phase of a version, record what would make the project or RIFF better with `riff improve record --phase ID --file FILE`. The file is a JSON array of at most three proposals; an empty array is a valid answer when nothing useful surfaced. `riff wave complete` refuses the last unfinished phase without it, earlier phases don't need one. Do not invent proposals or log routine success.

Ask what surprised you, what failed in a way likely to recur, and what RIFF lacked during the version (a missing command, an unclear reference, outdated documentation). Check `riff improve list` and `riff improve list --target riff` first; the CLI also skips titles already recorded.

Each proposal has `target` (`project` or `riff`), `title`, `what_happened`, `proposal` and `impact` (HIGH, MEDIUM or LOW). A project proposal may name a `suggested_phase`; a RIFF proposal names an `area` (skill, reference, cli, dashboard, doc or other).

Proposals are never applied by the agent that writes them. Project proposals appear in the dashboard until the owner takes one through the `add-phase` or `evolve` skill (which then runs `riff improve decide --id ID --status taken`) or dismisses it. RIFF proposals go to the framework idea box, `ideas/inbox.ndjson` in the RIFF repository, shared by every project on this machine; only a dedicated framework session applies them.
