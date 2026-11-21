# Promotion from scratch to production

Read this only when the user explicitly asks to make a scratch-scoped project a production project.

## Steps

Run `riff promote` to see the scope and stop if it's already production. Set production boundaries in `PROJECT.md`, `ROADMAP.yaml` and `taste.md`, keeping existing decisions, and resolve active phases and blockers. Stage the candidate, get fresh independent architecture, roadmap and functional reviews, plus security for a sensitive project, then run `riff promote --apply --architecture FILE --roadmap FILE --functional FILE [--security FILE]` and check the scope and `INCIDENTS.md`.

## Boundaries

Promotion changes the RIFF scope only: it never authorizes a push, merge, deployment or publication, and a later authorized Git finalization runs `riff finish --check` first. The review artifacts follow [evidence](evidence.md); a sensitive project also needs [security](security.md).
