# Project taste

Goal: preserve useful product, design and engineering judgment across tasks without prescribing an implementation script. `PROJECT.md` owns the product goal; taste records how this project delivers it well.

## Read and resolve

For implementation or review, read the project's `taste.md` when present, then only the topic and stack references relevant to the changed behavior. Read [frontend taste](taste/frontend.md) for visual or interaction work, including when the project has no taste yet. Consult [the stack index](taste/stacks/INDEX.md) when identifying the stack. File patterns are navigation hints, not automatic Codex loading rules.

Explicit user instructions and repository instructions take precedence. Preserve approved design references, project decisions and established contracts over generic defaults. Resolve an obsolete convention against current repository evidence and verified documentation; record the reason for a targeted correction. Do not silently weaken security or data guarantees to preserve a pattern.

## Establish and reuse

Production `start` and `onboard` establish a small project-owned `taste.md`: stack and version evidence, load-bearing architectural conventions, a table of topic paths with “Read when” triggers, and links to non-obvious decisions already in `PROJECT.md`. Use [architecture](taste/architecture.md) as a starting point, not a checklist to copy blindly.

Seed only applicable `taste/frontend.md`, `taste/backend.md`, `taste/security.md` and `taste/testing.md` from their matching references in this directory and verified project patterns. Omit irrelevant topics and empty placeholders. Keep each topic short enough to scan; split by responsibility only when needed. Include visual direction and skill routing in frontend taste. Reference shared sources instead of duplicating their full text.

Existing Claude `taste.md`, `taste/` and project `references/taste/stacks/` are shared artifacts: read and preserve them, including legacy monolithic taste files. Merge only evidence-backed additions or corrections; do not rename, overwrite, reformat wholesale, or copy foreign `.riff` state. Resolve symlinks before writing: a project path linked to the framework, another consumer or a managed skill is read-only. Put a project-specific addition in a regular project-owned file and link it from a writable project index instead.

For an existing production project without taste, an authorized implementation may establish only the conventions needed for its current outcome. Read-only map/review work reports useful conventions without creating or changing taste; an explicit request to save a map may also save verified conventions. Scratch work reads existing taste but does not bootstrap a production file set.

## Learn and finish

Use `$riff:learn-stack` for explicit stack-convention research or a reusable knowledge gap that materially affects the current outcome. Its output belongs to the invoking project under `references/taste/stacks/`, linked from project taste so future work actually finds it. A one-off API lookup stays a normal lookup.

When implementation or a concrete failure proves a reusable convention, merge the concise rule, its applicability, reason and evidence into the appropriate project topic before final validation/review. Do not persist guesses, duplicate rules, or create a `PENDING` approval queue. Refresh only affected rules after stack upgrades. A consumer task never edits framework references or another project to promote a lesson.

In loop mode, choose and record conservative conventions without source-shortlist approval, replace/merge questions, fixed research quotas, periodic audits or additional phase ceremonies. Follow the operating contract for real blockers and candidate-bound receipts. Taste changes are part of the same candidate; a later edit invalidates its receipts.
