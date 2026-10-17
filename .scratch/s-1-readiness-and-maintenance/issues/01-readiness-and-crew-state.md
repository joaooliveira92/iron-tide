# 01: Readiness state and crew quality on every ship

**What to build:** Every ship in a compiled campaign carries a readiness state
(active by default, working-up when under construction) and a bounded crew-quality
value, derived at compile from existing content rather than newly authored. A fixture
campaign compiles with the fields present and bounded, a ship launched mid-run enters
working up, a save round-trips them, and the authoritative snapshot changes as a
reviewed, re-pinned change. Introduces the compatibility-version bump (map D2).

**Blocked by:** None (can start immediately).

**Status:** blocked

Gated by `.ai/decision-requests/0005-officer-rosters-and-divisions-golden-repin.md`,
the same blocker as N-1 ticket 07: the new required per-ship fields and the
compatibility bump move the golden reference run
(`packages/cross-process-test/src/run-child.ts` hashes `NationState` and
`compatibilityVersion`), and `check:golden` cannot run because `golden/hashes.json`
does not exist. Do not start until the golden baseline exists or the owner decides.

- [ ] A compiled fixture campaign exposes a readiness state for every ship, derived
      (`isUnderConstruction` → `WORKING_UP`, otherwise `ACTIVE`), and a crew-quality
      integer within `0..100`.
- [ ] A ship completed by the construction phase enters `WORKING_UP`; a rebuilt ship
      releases into its state without losing the fields.
- [ ] Non-integer, out-of-range and excess-key values are rejected at the compile
      boundary with a `_tag`-discriminated diagnostic.
- [ ] `F.Ship` (`snapshotClone.ts`), the ship schema and `buildShips` carry the
      fields, so compile and clone do not drop them.
- [ ] Save and load restore readiness and crew exactly; a save from the previous
      compatibility version is refused before decode.
- [ ] The reference run is re-pinned in the same commit with cause "new required
      per-ship readiness and crew state"; two cross-process compiles are
      byte-identical.
- [ ] Production 1880 content is untouched (no new authoring); fixtures are
      classified as fixture.
