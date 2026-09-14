# Runtime lessons

## Dashboard phase routes

When linking a roadmap phase, preserve its identifier as an opaque string. Codex IDs such as `phase-local-parcours` and legacy numeric IDs must both reach the details API; numeric coercion silently prevented modals from opening. Evidence: `riff/dashboard/public/app.js` (`parseHash`, `handleRoute`), verified against the Mologo phase modal on 2026-09-14.

## Dashboard process detection

A failed HTTP probe does not prove a port is free: a stalled Bun process may still own its IPv6 listener. Probe bind availability using the server's address family before starting a replacement, and keep diagnostics. A recorded PID alone is not authority to terminate a process. Evidence: `test/dashboard.test.mjs` and the occupied port 4027 launch failure on 2026-09-14.

## Interrupted delivery

Reuse candidate-bound validation and review evidence only while intact. Recover a committed phase through the normal completion gates; preserve dirty files and never manufacture a second commit to advance state. Evidence: the interrupted-delivery regression in `test/riff-codex.test.mjs`.

## Historical observations

Group nonblocking historical checks behind native disclosure controls; do not present every recorded heuristic as a current security incident. Keep severe findings visible and preserve all grouped history. Phase diagnostic scripts are executed directly, and route-shaped test files are not production endpoints. Exclude them from the corresponding orphan/route heuristics while retaining secret detection. Evidence: `test/dashboard.test.mjs`, the diagnostic and route-fixture hook tests, and the StoryCollector dashboard on 2026-09-14.
