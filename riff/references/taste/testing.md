# Testing taste

- Verify the promised behavior with the smallest reliable check at the layer that can prove it. Add regression coverage for a concrete risk, not a mirror of implementation details.
- A test earns its place by guarding a costly failure (money, delivery to customers, authentication, data, security) or a bug already seen. Don't write render-only tests for components without logic, permutation matrices, or tests that only restate how the code is written.
- Budget: add or materially expand at most five tests per phase or quick change. Exceed it only for a concrete costly risk, and name that risk in the summary. A review finding is fixed in the code; it gets a new test only when it sits in one of the costly areas above.
- Prune as you go. When a phase touches a test file, delete the tests there that fail this bar or duplicate another test, and say so in the summary. Never delete a test that names a past incident, and keep tests in the costly areas.
- While building, run only the tests related to the changed files (for example `vitest related` or `vitest --changed`). Run the full suite once on the final candidate, not after every review round. Repeat a successful check only after a relevant change.
- Use the existing test stack and noninteractive commands.
- Keep mocks honest: simulated conflicts do not prove database concurrency, migration text does not prove applied SQL, and a build does not prove authentication, delivery or visual quality.
- Use real storage or integration checks where the claim depends on transaction semantics or a remote system. State the exact missing evidence when that access is unavailable.
- For UI changes, combine functional interaction checks with rendered visual inspection under [frontend taste](frontend.md). Static source review cannot establish visual acceptance.
- CI on a pull request runs the typecheck, the tests related to the change and the build, so it stays within a few minutes. The full suite runs on the target branch after the merge; a failure there is fixed right away like any other failure.
