# 07: Seed 1880 divisions and de-duplicate the officer roster

**What to build:** Give the 1880 scenario a real command structure. Every nation
starts with `0` divisions and exactly `6` uniformly-shaped officers (e.g. every
nation has 3 CAPTAIN, 2 COMMODORE, 1 REAR_ADMIRAL with no nation-specific
identity), which reads as placeholder generation. Seed initial divisions for the
nations that had one and make officer rosters nation-appropriate and distinct.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

Decision request **0005** resolved (2026-10-17, Option A): implement with a
same-commit golden re-pin. The golden baseline exists (`golden/hashes.json`,
`0117adc`). Roster/division magnitudes are ADR-0213 `balance_adjustment` values;
re-pin the reference hashes in the same behavioural commit with old/new/cause and
assess the `NationState` compatibility impact (ADR-0224). Do not use the
`not-needed` trailer.

- [ ] Initial divisions are seeded for nations that had them in 1880 (or a cited
      decision explains their absence).
- [ ] Officer rosters differ per nation and are not a uniform template.
- [ ] A deterministic test asserts the seeded structure loads from the snapshot.
- [ ] The cross-process golden is re-pinned in the same commit with cause; the
      `NationState` compatibility impact is assessed (migration or refusal).

