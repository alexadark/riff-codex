# Stack taste index

Read only entries matching the actual repository and current behavior. Versions and project rules win over this baseline. Prefer a project's `references/taste/stacks/INDEX.md` for its researched conventions, including existing Claude references. Follow these links explicitly; no path-based autoload is assumed, and frontmatter `paths:` in these files is not a loader.

| File | Read when |
| --- | --- |
| [NowStack](nowstack.md) | The project identifies as NowStack or is a confirmed derivative using TanStack Start and Convex. |
| [TanStack Start v1](tanstack-start-v1.md) | The project uses `@tanstack/react-start`: entry files, `routeTree.gen.ts`, router setup, Tailwind 4 wiring. |
| [Router SSR Query](react-router-ssr-query.md) | Adding or upgrading `@tanstack/react-router-ssr-query`. |
| [Zod](zod.md) | Writing or changing Zod schemas and validation. |
| [Vitest](vitest.md) | Writing tests or mocks in a Vitest project. |
| [shadcn registry](shadcn-registry.md) | Installing shadcn components from a registry URL. |
| [Vercel AI SDK](vercel-ai-sdk.md) | LLM streaming, structured output or chat UI with the `ai` / `@ai-sdk/*` packages. |

The TanStack, Zod, Vitest, shadcn and AI SDK rules were last audited on 2026-05-28, before Zod 4 and Vitest 4. Check each rule against the installed version before relying on it, and refresh it through `$riff:learn-stack` when it is out of date.

`archive/` keeps rules for stacks no longer in use (React Router 7, Drizzle, Postgres scripts, saas-starter server utilities, Better Auth UI, react-day-picker). They are not part of this index: do not load them unless a project actually uses that stack, and then refresh them first.

For other stacks, preserve existing project references and use `$riff:learn-stack` when reusable conventions are missing. New research belongs to the invoking project; framework-wide additions require framework work explicitly in scope.
