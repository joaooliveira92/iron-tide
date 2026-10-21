# Decision Request: T-1 support-force candidate priority, mission fit and ship type

## Status

Resolved (2026-10-21) by owner delegation: **Option A**, recorded as
[ADR-0266](../../docs/adr/ADR-0266-s5-presence-values-and-open-requests-resolved-by-delegation.md).

## Trigger

The support force (R12, ADR-0259) orders and caps its candidates with the existing allied-candidate ordering, which reads
`treatyCommitmentPriority`, `missionFit` and, through the shared generation resolver, the ship type. No authoritative
source supplies any of the three, so `applySupportForces` (`packages/phase-engine/src/supportForce.ts`) feeds `0`, `0`
and `"BB"` (`resolveGenerationShipType` in `packages/phase-engine/src/battles.ts`). With every priority and fit equal, the
ordering reduces to effective strength (descending), then nation id, then asset id. These are neutral placeholders, not
decisions; they were flagged in the T-1 review.

## Evidence

- `packages/combat/src/generation/allied.ts`: `orderAlliedCandidates` sorts by `treatyCommitmentPriority` ascending, then
  `missionFit` descending, then strength, nation id, asset id.
- The campaign snapshot carries no per-ship battle type, no treaty commitment ranking and no mission-fit measure.
- Manual p.67 and p.99 say only that friendly AI forces are sometimes present; decision request 0034 and ADR-0254 cover
  presence, share of cap and source, not selection.
- Battle generation uses the same `"BB"` resolver for every ship, so the support force is consistent with it today.

## Why agent judgment is insufficient

Each choice changes which allied ships join and therefore battle outcomes and the recorded presence-draw inputs
(`candidates` digest), i.e. authoritative hashes. Inventing a treaty ranking or a mission-fit table is gameplay design.

## Options

### Option A: Keep the neutral values (status quo)

- Behavior: priority 0, fit 0, type "BB" for all; strongest allied ship first under the cap.
- Advantages: deterministic, simple, matches generation; no re-pin.
- Risks: a player may see the strongest ally always chosen irrespective of treaty or mission; ship-type-dependent rules (if
  later added) treat every ship as a battleship.
- Compatibility impact: none. Migration impact: none. Effort: none.

### Option B: Derive priority and fit from existing campaign data

- Behavior: priority from the relation record (for example `since` month, earliest alliance first); fit from a ruleset
  table authored by the owner (mission type to preferred ship types); ship type from the ship's design class once the
  campaign exposes it.
- Advantages: closer to the intent of the ordering fields.
- Risks: needs owner-authored values (BALANCE_TARGET-style, ADR-0213 pattern) and a campaign ship-type source that does not
  exist yet; changes outcomes.
- Compatibility impact: new ruleset keys (optional, absent = Option A) and likely a content-lock and replay `contentHash` re-pin.
- Migration impact: none for saves if optional. Effort: medium, plus an ADR.

### Option C: Remove the placeholders from the contract

- Behavior: order support candidates by strength, nation id, asset id only, with a purpose-built ordering instead of the
  allied-candidate shape carrying dummy fields.
- Advantages: no fake data in the call site.
- Risks: duplicates ordering logic or changes shared combat code; same outcome as A today.
- Compatibility impact: none if the order is identical. Effort: small.

## Recommendation

Option A for now, documented as intentional, and revisit with Option B when the campaign gains per-ship battle types
(the same prerequisite generation already has). Do not implement Option B or C without owner approval, since B needs
owner-authored values and a re-pin.

## Work safely completed while blocked

Shared the generation seed formula version and ship type resolver between generation and the support force (no behavior
change), and pinned the support-force cap clamp with a test.
