# NowStack taste

Applicability: confirmed NowStack projects. Local baseline inspected on 2026-09-13: NowStack 2.1.0, TanStack Start/Router, React 19, Tailwind 4, shadcn/Base UI, Convex and Better Auth. This is a starting reference, not a required version or an instruction to migrate other apps.

## Project conventions

- Verify the consumer's manifest, lockfile, `AGENTS.md` and relevant `.agents/rules/` before choosing APIs. Read matching rules explicitly; their frontmatter is not a guaranteed loader. Starter docs may describe an older variant, so resolve conflicts against the actual application.
- Preserve Convex as the application backend. Do not introduce Prisma, Drizzle, PostgreSQL, Supabase or a duplicate data layer without a product requirement and authorization.
- Reuse the project's Better Auth/Convex bindings, org/admin function builders and DTO boundaries. Derive identity and organization from trusted context and enforce resource permissions server-side.
- For Convex changes, read the available `convex:convex-expert` skill and the project's generated guidelines when present. Use the relevant Convex review guidance for review. Do not invent generated APIs or run codegen against an unidentified deployment.
- Use the existing TanStack Form wrapper for new forms where the project retains that convention; the presence of legacy React Hook Form is not a reason to introduce a second form pattern.
- Reuse the local dialog manager, route pending/skeleton conventions, aliases and shadcn/Base UI primitives when present. Inspect their actual interfaces before extending them.
- Apply [frontend taste](../frontend.md) and its design skills for UI work. Starter pages are implementation references, not the product's visual identity. Exact migration parity takes precedence over a redesign.
- Confirm the project's actual email, billing, storage and job providers. NowStack variants differ; never infer configured Resend, Stripe, Polar, R2 or Trigger.dev credentials from installed packages.
- Inspect development scripts before starting them: installs, codegen and combined dev commands may sync remote Convex state. Verify the target and existing authorization; distinguish offline checks from remote integration proof.

## Maintainer-backed constraints

- [official] Convex public boundaries need appropriate argument/return validation and authorization. Use indexed, bounded reads for growing collections. Keep related atomic writes in a mutation and external calls in actions. Multiple calls from an action do not become one transaction. See [Convex best practices](https://docs.convex.dev/understanding/best-practices) and [actions](https://docs.convex.dev/functions/actions).
- [official] Respect TanStack Start's client/server execution boundaries; keep server-only data and code out of browser bundles. Check server function APIs against the installed version. See [execution model](https://tanstack.com/start/latest/docs/framework/react/guide/execution-model) and [server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions).

Local provenance: `~/DEV/frameworks/nowstack-saas/AGENTS.md`, `package.json`, `.agents/rules/convex-authorization-dto.md` and `.agents/rules/convex-queries.md`. These paths document the inspected source; consumers use their own corresponding files. Refresh affected rules through `$riff:learn-stack` when the consumer's version or provider variant differs.
