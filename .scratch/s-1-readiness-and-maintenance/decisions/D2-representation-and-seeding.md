# D2: Representation and seeding

**Type:** grilling · **Status:** resolved

## Question

How are readiness and crew quality represented, and where do their initial values
come from?

## Answer

Two new **required** fields on every ship in authoritative state:

- a readiness state with the canonical vocabulary `ACTIVE`, `RESERVE`,
  `MOTHBALLED`, `WORKING_UP` (the manual's `AF`/`RF`/`MB`/`WU`, p.48/51), aligned
  with the readiness names combat already knows;
- a crew-quality value: a branded safe-integer `0..100` (ADR-0202 canonical integer).

Initial values are **derived at compile**, not newly authored: `isUnderConstruction`
becomes `WORKING_UP`, every other ship `ACTIVE` at its state's crew ceiling; the
launch site (`packages/phase-engine/src/constructionPhase.ts` `buildCompletedShip`)
sets a new ship to `WORKING_UP`. Production `fleets.yaml` is therefore untouched, and
there is no authored-value conflict of the kind that blocks S-2 (decision request
0006).

The new required fields change the compiled snapshot, so they ship under a
compatibility-version bump and a golden re-pin with cause "new required per-ship
readiness and crew state".

## Why

Readiness and crew are durable per-ship state — a player sets readiness, it ramps,
and repair counts down — so an absent-until-set optional field would hide a gap, the
same reasoning S-2's D2 used for prestige. Unlike prestige, no content must be
authored: the manual says commissioned ships are active and new or mobilized ships
are placed in working-up (p.51), so derivation is the sourced default, not an
invention.

## Gating

The new required fields move the golden reference run
(`packages/cross-process-test/src/run-child.ts` hashes `NationState` and
`compatibilityVersion`). With `golden/hashes.json` absent (`.ai/AUTHORITY-INDEX.md`),
that re-pin cannot be performed, so every snapshot-changing S-1 ticket is gated by
decision request **0005**, exactly like N-1 ticket 07. The alternative — an
optional, reference-run-neutral representation that avoids the bump — was rejected
for consistency with S-2 and the mine effort and because it weakens save safety
without an owner decision.
