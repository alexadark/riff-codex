---
name: debug
description: Diagnose and minimally fix a concrete failure within RIFF boundaries. Use when the user invokes $riff:debug or supplies a reproducible application bug.
---

# Debug a concrete failure

Read `.riff-codex/references/taste.md` and the relevant project conventions. For a UI failure, apply the relevant design skills and rendered checks from `.riff-codex/references/taste/frontend.md`. Persist a reusable prevention rule only when the diagnosis and correction establish it.

Reproduce only the reported failure. Identify the smallest supported cause, explain it, and implement a minimal correction when authorized. Validate the failed behavior once and add a narrow regression check only if necessary for this concrete case.

Respect an active wave and record its validation and review evidence through the wave commands. Do not generalize the fix into hardening, compatibility work, or an edge-case matrix.

Use `.riff-codex/references/learning.md` to check relevant prior lessons and merge a verified prevention rule before final validation when this failure teaches something reusable.
