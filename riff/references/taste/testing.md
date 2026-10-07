# Testing taste

- Verify the promised behavior with the smallest reliable check at the layer that can prove it. Add regression coverage for a concrete risk, not a mirror of implementation details.
- Use the existing test stack and noninteractive commands. Repeat successful checks only after relevant changes or inconclusive evidence.
- Keep mocks honest: simulated conflicts do not prove database concurrency, migration text does not prove applied SQL, and a build does not prove authentication, delivery or visual quality.
- Use real storage or integration checks where the claim depends on transaction semantics or a remote system. State the exact missing evidence when that access is unavailable.
- For UI changes, combine functional interaction checks with rendered visual inspection under [frontend taste](frontend.md). Static source review cannot establish visual acceptance.
- Prune as you go. A test earns its place by guarding a costly failure (money, delivery, authentication, data, security) or a bug already seen. Do not write render-only tests for components without logic, and do not keep tests that duplicate another test or only restate how the code is written. When a phase touches a test file, delete the tests that fail this bar and say so in the summary. Never delete a test that names a past incident, and keep tests in the costly areas above.
- Correct failures during construction, then use the existing RIFF validation and review boundary. Do not add a second approval process or an arbitrary testing quota.
