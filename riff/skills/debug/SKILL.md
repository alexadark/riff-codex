---
name: debug
description: Diagnose and minimally fix a concrete failure within RIFF boundaries. Use when the user invokes $riff:debug or supplies a reproducible application bug.
---

# Debug a concrete failure

Reproduce only the reported failure. Identify the smallest supported cause, explain it, and implement a minimal correction when authorized. Validate the failed behavior once and add a narrow regression check only if necessary for this concrete case.

Respect an active wave and record its validation and review evidence through the wave commands. Do not generalize the fix into hardening, compatibility work, or an edge-case matrix.
