Review type: functional.

Goal: decide whether the staged candidate delivers the phase outcome and every `done_when` criterion, without breaking existing behavior.

Check in particular:

- Each `done_when` criterion and the phase outcome, traced to the code that implements it.
- Regressions in behavior the phase didn't mean to change, in callers of the functions it modified.
- Error and empty states a user will reach on the paths the criteria describe.
- Reuse: new code that duplicates an existing component, service or helper (MEDIUM at most).
- Tests: flag a test that cannot fail or only restates the implementation, and a costly behavior left with no check at all (MEDIUM at most). Never ask for more tests for coverage.
