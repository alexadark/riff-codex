Review type: security.

Goal: decide whether the staged candidate opens a security or data-integrity weakness at the boundaries this change touches.

Check in particular, for new or changed entry points only:

- Authentication and authorization, including tenant or ownership checks.
- Input validation, injection (SQL, shell, template, path traversal) and unsafe deserialization.
- Secrets, tokens or personal data written to logs, responses, URLs or committed files.
- Migrations or writes that can lose or corrupt existing data.
- Webhooks, callbacks and public APIs: signature checks, replay, rate and size limits.

Review only the boundaries this candidate touches, not the whole application. HIGH or CRITICAL needs an exposure an attacker or a normal user can reach. Defense in depth, hardening and theoretical attacks with no reachable path are MEDIUM at most.

For each finding, state what could happen, who or what is affected, and the fix.
