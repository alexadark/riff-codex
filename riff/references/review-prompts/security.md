Review type: security.

Goal: decide whether the staged candidate opens a security or data-integrity weakness at the boundaries it touches.

Check in particular:

- Authentication and authorization on every new or changed entry point, including tenant or ownership checks.
- Input validation, injection (SQL, shell, template, path traversal) and unsafe deserialization.
- Secrets, tokens or personal data written to logs, responses, URLs or committed files.
- Migrations or writes that can lose or corrupt existing data.
- Webhooks, callbacks and public APIs: signature checks, replay, rate and size limits.

Review only the boundaries this candidate touches, not the whole application. For each finding, state what could happen, who or what is affected, and the fix.
