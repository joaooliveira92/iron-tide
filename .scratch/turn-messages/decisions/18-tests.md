# D-18: Test requirements

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

What automated tests must the implementation carry?

## Answer

- **Unit:** strict schema reject; projection totality/determinism;
  aggregation/dedup stability; ordering.
- **Parity:** `@bluewave/messages` schema fixtures; desktop↔engine DTO parity.
- **Determinism:** re-executed paused turn byte-identical; resumed hash equals the
  uninterrupted single-run hash.
- **Save/load:** legacy save (no sidecars) loads; resume after reload; stale
  pending-turn rejected without mutation; summary rebuilt by replay.
- **Interruption:** pause→persist→reload→resume exactly once; multiple
  interruptions per turn; missing/extra/mismatched inputs rejected.
- **Rollback:** domain-validation failure aborts pre-commit, restores state.
- **E2E:** several turns across economy/construction/research/diplomacy with one
  decision + one battle, verifying finances, construction, research, diplomacy,
  messages, and save/load consistency.
- **Gate:** `pnpm preflight`, `pnpm test:scripts`, `pnpm check`.

(Locked round 3.)

## Consequence

Consumed by D-17, D-19. Grounded by R-20/R-21.
