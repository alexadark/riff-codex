# Backend taste

- Reuse the repository's service, authentication, provider and error conventions. Do not import route-specific exception patterns into unrelated frameworks.
- Validate untrusted input at authoritative boundaries. Keep authorization and business transitions close to the protected data or side effect.
- Use bounded, indexed reads and atomic operations for competing writes. Keep external calls outside database transactions that may retry.
- Distinguish optional telemetry from required security, billing and audit records. Optional telemetry failures should not break a successful operation; required controls must not silently fail open.
- Await required work or hand it to the platform's durable scheduler. An unawaited promise with a catch handler does not guarantee execution after a server response.
- Represent conflicts explicitly when multiple records match an external identity. Do not silently select the first candidate and mutate it.
- Make provider retries safe, redact logs, and retain actionable failure state. Verify remote configuration separately from local tests.
