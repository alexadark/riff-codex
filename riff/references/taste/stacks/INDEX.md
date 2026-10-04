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
| [Better Auth UI](better-auth-ui.md) | The project uses `@better-auth-ui/react`, as NowStack does: auth routes, providers, base paths, email verification. |
| [React Router 7](react-router-7.md) | The project uses React Router 7 in framework mode (`react-router.config.ts`, `app/routes`). |
| [Drizzle](drizzle.md) | The project uses Drizzle ORM: schema, migrations, queries or repositories. |
| [Node ESM scripts](node-esm.md) | Writing Node ESM / `tsx` scripts, seeds or CLIs, including Postgres batch writes. |
| [Deep modules](deep-module.md) | Organizing server features as one folder per feature with a barrel as public API. |
| [Server utilities](server-utilities.md) | The project comes from saas-starter or web-starter and uses its `app/lib/server` utilities. |
| [react-day-picker](react-day-picker.md) | Editing a calendar component on react-day-picker v10. |

Every rule except NowStack was last audited on 2026-05-28, before Zod 4 and Vitest 4. Check each rule against the installed version before relying on it, and refresh it through the `learn-stack` skill when it is out of date.

For other stacks, preserve existing project references and use the `learn-stack` skill when reusable conventions are missing. New research belongs to the invoking project; framework-wide additions require framework work explicitly in scope.
