Review type: discovery (product dossier or evolution plan).

Goal: decide whether this dossier is ready to build from: an implementer could start the first phase without guessing a product, data, permission or architecture decision.

Read every listed dossier file, not a subset. Check in particular:

- Every story and journey is covered by a roadmap phase, and every phase traces back to a story.
- Data model, permissions and API contracts are explicit and consistent across documents.
- Architecture choices have a stated reason; risky assumptions have a verification plan.
- Wireframes and design handoff cover the states a user will meet (empty, loading, error, success).
- Each phase has observable `done_when` criteria and a way to verify them.
- Contradictions between files, unresolved decisions that block implementation, promised documents that are missing.

Severity bar for a dossier:

- HIGH: a contradiction between documents, or a missing decision that forces an implementer to guess on the main path; a plan that would lose data or expose private data.
- MEDIUM at most: a rare case (a narrow race, a multi-step failure sequence, an operator mistake) that the dossier can handle with an operating instruction for the team. Recommend the instruction instead of more machinery.
- When the context says this is a scoped review of an evolution, judge the change and the existing behavior it touches. Unrelated pre-existing gaps are LOW, not blockers of this change.
