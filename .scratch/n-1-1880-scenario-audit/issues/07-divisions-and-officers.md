# 07: Seed 1880 divisions and de-duplicate the officer roster

**What to build:** Give the 1880 scenario a real command structure. Every nation
starts with `0` divisions and exactly `6` uniformly-shaped officers (e.g. every
nation has 3 CAPTAIN, 2 COMMODORE, 1 REAR_ADMIRAL with no nation-specific
identity), which reads as placeholder generation. Seed initial divisions for the
nations that had one and make officer rosters nation-appropriate and distinct.

**Blocked by:** None (can start immediately).

**Status:** partial (2026-10-17) — per-nation officer rosters landed with a
same-commit golden re-pin (commit `94aee73`; `closingSnapshotHash` and
`replayVerificationHash` moved with the recorded old/new values). **Remaining:**
seeded 1880 divisions (an authored `divisions` collection plus compile wiring in
`packages/campaign/src/nationCompilation.ts`, which still hard-codes `divisions:
[]`). See ADR-0224.

- [ ] Initial divisions are seeded for nations that had them in 1880 (or a cited
      decision explains their absence). — **remaining**
- [x] Officer rosters differ per nation and are not a uniform template (`officers.test.ts`).
- [ ] A deterministic test asserts the seeded division structure loads from the snapshot. — **remaining**
- [x] The cross-process golden is re-pinned in the same commit with cause; the
      `NationState` compatibility impact is assessed (officers are an existing
      optional field, so no bump/migration is required).

