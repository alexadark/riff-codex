# Learning across phases

Keep verified lessons in the project's existing `taste.md` and relevant `taste/` topics. These files are the shared memory for planning, implementation and review, including later sessions and Claude RIFF. Do not add an improver agent, a proposal queue, per-agent copies or completion sentinels.

Before a phase or a related bug fix, read the applicable topic and any directly relevant prior incident or phase review. Apply its prevention rule to the current boundary; do not replay the whole history.

When a correction or review establishes a reusable lesson, merge it into that topic before final candidate validation. Use one short entry containing:

- **When:** the concrete condition where this lesson applies.
- **Rule and reason:** what to do differently and which observed failure it prevents.
- **Evidence:** a repository path, regression check, incident or phase review that establishes the rule.

Check for an existing equivalent rule first. Amend an obsolete rule with the evidence for the correction; do not append duplicates. Routine success and speculative advice need no entry. If no topic exists, create only the needed project-owned topic and link it from a writable project taste index. Follow the taste contract for symlinks and shared sources.

This learning is automatic within authorized work and shared across phases and roles, not across unrelated private projects. A reusable stack gap uses `$riff:learn-stack`. A consumer never silently changes RIFF's framework references or another project's conventions. Framework-wide improvements belong to an explicitly authorized framework task.
