# Learning across phases

Keep verified lessons in the project's existing `taste.md` and relevant `taste/` topics. These files are the shared memory for planning, implementation and review, including later sessions and the original RIFF framework. Lessons are separate from improvement proposals, described below.

Before a phase or a related bug fix, read the applicable topic and any directly relevant prior incident or phase review. Apply its prevention rule to the current boundary; do not replay the whole history.

When a correction or review establishes a reusable lesson, merge it into that topic before final candidate validation. Use one short entry containing:

- **When:** the concrete condition where this lesson applies.
- **Rule and reason:** what to do differently and which observed failure it prevents.
- **Evidence:** a repository path, regression check, incident or phase review that establishes the rule.

Check for an existing equivalent rule first. Amend an obsolete rule with the evidence for the correction; do not append duplicates. Routine success and speculative advice need no entry. If no topic exists, create only the needed project-owned topic and link it from a writable project taste index. Follow the taste contract for symlinks and shared sources.

This learning is automatic within authorized work and shared across phases and roles, not across unrelated private projects. A reusable stack gap uses the `learn-stack` skill. A consumer never silently changes RIFF's framework references or another project's conventions. Framework-wide improvements belong to an explicitly authorized framework task.

## End-of-phase improvement proposals

Before `wave complete`, record what would make the project or RIFF better with `riff improve record --phase ID --file FILE`. The file is a JSON array of at most three proposals; an empty array is a valid answer when nothing useful surfaced. Do not invent proposals or log routine success.

Ask what surprised you, what failed in a way likely to recur, and what RIFF lacked during the phase (a missing command, an unclear reference, outdated documentation). Check `riff improve list` and `riff improve list --target riff` first; the CLI also skips titles already recorded.

Each proposal has `target` (`project` or `riff`), `title`, `what_happened`, `proposal` and `impact` (HIGH, MEDIUM or LOW). A project proposal may name a `suggested_phase`; a RIFF proposal names an `area` (skill, reference, cli, dashboard, doc or other).

Proposals are never applied by the agent that writes them. Project proposals appear in the dashboard until Alexandra takes one through the `add-phase` or `evolve` skill (which then runs `riff improve decide --id ID --status taken`) or dismisses it. RIFF proposals go to the framework idea box, `ideas/inbox.ndjson` in the RIFF repository, shared by every project on this machine; only a dedicated framework session applies them.
