# ADR-0299: `pnpm check` serialises across worktrees and reports machine load

Applies to: repository

Rule: Run long gates through `pnpm heavy`, which serialises across worktrees and caps vitest workers at 4.

## Status

Accepted (2026-10-25). Resolves [#218](https://github.com/joaooliveira92/iron-tide/issues/218), options 1 and 3.

## Context

With several sessions active, load averages of 53 to 100 on a 10-core machine made `pnpm check` fail on `Test timed out in 15000ms`.
The failing test changed from run to run and passed alone. Raising per-test timeouts only moved the failure, and capping workers per
package changed nothing measurable. The serialising lock existed only as a personal shell script outside the repository.

## Decision

- `scripts/heavy.mjs` runs a command under a machine-wide lock directory (`/tmp/bluewave-heavy.lock`, holder pid and command
  recorded) and caps `VITEST_MAX_WORKERS` at 4 unless set. A second run waits and names the holder. A lock whose holder process is
  gone, or that never recorded a holder and is older than ten seconds, is reclaimed. A run launched by a process that already holds
  the lock proceeds, so wrapping a command twice cannot deadlock. The lock format matches the earlier shell script, so both
  interoperate.
- Before starting it prints a warning when the one-minute load average exceeds the core count, so a timeout failure under load is
  recognisable as environmental.
- `pnpm check` is now `node scripts/heavy.mjs pnpm check:steps`; the step chain moved unchanged to `check:steps`, and the CI parity
  gate reads `check:steps`. `pnpm heavy <cmd>` wraps any other long run.
- The timeout baseline (option 2) and a documented quiet-machine requirement (option 4) are not adopted: serialising removes the
  contention instead of tolerating it.

## Compatibility

No product, state or hash change. `pnpm check:steps` is the old `pnpm check`; CI runs the individual steps and is unaffected. On
Windows the lock lives under the OS temp directory and ancestor detection is skipped.
