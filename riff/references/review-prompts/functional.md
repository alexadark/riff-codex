Review type: functional.

Goal: decide whether the staged candidate delivers the phase outcome and every `done_when` criterion, without breaking existing behavior.

Check in particular:

- Each `done_when` criterion and the phase outcome, traced to the code that implements it.
- Regressions in behavior the phase didn't mean to change, including callers of modified functions.
- Error states, empty states and edge cases a user would reach.
- Reuse: new code that duplicates an existing component, service or helper.
- Tests: do they exercise the real behavior, or only restate the implementation?
