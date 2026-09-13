# Architecture taste

Apply the rules that support the current product outcome. Derive concrete paths and types from the project.

- Start a new capability with the smallest demonstrable end-to-end behavior. Preserve existing contracts and data when extending it.
- Keep one authoritative representation of a business fact. Reuse the project's schema, types and provider boundaries.
- Prefer existing platform capabilities and installed dependencies. Introduce an abstraction when it hides meaningful complexity or enforces a real invariant, not a hypothetical future use.
- Put business invariants where every entry point must obey them. UI guards complement authoritative server checks.
- Keep cohesive modules with small, intentional interfaces. Judge boundaries by the behavior they encapsulate, not file counts or line limits.
- Make invalid transitions hard to express. Use the existing type system, validators and atomic storage constraints where they provide actual guarantees.
- For concurrent or retried side effects, establish an atomic claim or idempotency boundary before provisioning. Preserve enough state to reconcile failures and avoid duplicate external resources.
- Verify external outcomes at the level promised to the user. A successful HTTP response alone does not prove the resulting business state.
- Compare alternatives when a difficult-to-reverse interface warrants it; record the consequential decision once. Do not require multiple designs for routine work.
