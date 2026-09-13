# Security taste

These implementation conventions complement the [security review boundary](../security.md).

- Enforce authentication and authorization at the server/data boundary for every relevant entry point. Derive identity and tenant from trusted context, not request parameters.
- Validate ownership of both sides of a relationship, including the requested parent and child. Scope reads, listings and mutations to the caller's permitted resources.
- Recheck current permissions and lifecycle state before a protected action. A signed token proves integrity, not continued authorization.
- Validate boundary inputs and required configuration using the project's tools. Keep secrets and private provider responses out of browser bundles and logs.
- Verify webhooks using the provider's supported verifier and original signed bytes before processing; make retries and replay handling safe.
- Use established cryptographic libraries and token patterns. Do not invent a token construction or bypass verification for convenience.
- Claim limited or non-idempotent operations atomically before the side effect. Exercise an unauthorized path as well as the authorized path when changing access control.
- Keep logs useful without exposing personal data, credentials or raw SDK errors that may echo request bodies.
