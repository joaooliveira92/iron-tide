# 07: Seed 1880 divisions and de-duplicate the officer roster

**What to build:** Give the 1880 scenario a real command structure. Every nation
starts with `0` divisions and exactly `6` uniformly-shaped officers (e.g. every
nation has 3 CAPTAIN, 2 COMMODORE, 1 REAR_ADMIRAL with no nation-specific
identity), which reads as placeholder generation. Seed initial divisions for the
nations that had one and make officer rosters nation-appropriate and distinct.

**Blocked by:** None (can start immediately).

**Status:** blocked

Blocked on `.ai/decision-requests/0005-officer-rosters-and-divisions-golden-repin.md`:
both parts change the reference-run `NationState` (officers/divisions), so the
golden-repin guard requires a `golden/hashes.json` re-pin that is impossible while
the baseline is Phase 1 and absent from this checkout. Recommended resolution:
defer ticket 07 to Phase 1.

- [ ] Initial divisions are seeded for nations that had them in 1880 (or a cited
      decision explains their absence).
- [ ] Officer rosters differ per nation and are not a uniform template.
- [ ] A deterministic test asserts the seeded structure loads from the snapshot.

