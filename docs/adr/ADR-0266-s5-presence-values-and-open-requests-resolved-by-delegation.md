# ADR-0266: S-5 presence values and the other open decision requests, resolved by delegation

## Status

Accepted (2026-10-21). Resolves decision requests
[0015](../../.ai/decision-requests/0015-fc-incompatible-severity-on-1880-starters.md),
[0017](../../.ai/decision-requests/0017-s-5-base-value-limit-mapping-and-no-base-limit.md),
[0018](../../.ai/decision-requests/0018-s-5-base-slot-occupying-readiness-states.md),
[0019](../../.ai/decision-requests/0019-s-5-over-base-maintenance-and-crew-quality-effects.md),
[0020](../../.ai/decision-requests/0020-s-5-cramped-and-short-range-counting-fraction.md),
[0021](../../.ai/decision-requests/0021-s-5-colonial-service-displacement-proportion.md),
[0022](../../.ai/decision-requests/0022-s-5-home-area-requirement-and-blockade-exemption.md),
[0023](../../.ai/decision-requests/0023-s-5-presence-penalty-magnitudes-and-revolt-trigger.md),
[0024](../../.ai/decision-requests/0024-designer-gun-elevation-and-cross-deck-fire.md),
[0026](../../.ai/decision-requests/0026-s-5-cramped-and-short-range-ship-classification.md),
[0027](../../.ai/decision-requests/0027-s-5-possession-transfer-war-outcome-driver.md) and
[0035](../../.ai/decision-requests/0035-t-1-support-force-candidate-priority-mission-fit-and-ship-type.md),
decided by the owner's delegation, which is the explicit owner authorization R14 of
spec #73 requires for any `balance_adjustment` value. Completes the value set begun by
decision request 0016 (Option C). Same pattern as
[ADR-0239](ADR-0239-s2-prestige-values-balance-targets.md) and
[ADR-0254](ADR-0254-t1-battle-offer-values-balance-targets.md). Sprints: S-5, T-1.

## Context

The S-5 research note (`docs/research/s-5-presence-and-base-limits.md`) found that the
manual states each S-5 quantity exists but gives no number. The owner chose Option C for
0016 and has now delegated every remaining open request. Values the manual does not give
are admitted as labelled Bluewave balance decisions (`kind: balance_adjustment`,
`sourceStatus: BALANCE_TARGET`); nothing is presented as a sourced fact, and the
"simulation matches RTW3" constraint is waived for these values only.

## Decision: S-5 values (authored by ticket #85)

| Req | Item | Decision | Rationale |
| --- | --- | --- | --- |
| 0016 | Tonnage required | `requiredTonsPerPossessionWeight` 150; `noPortValueWeight` 2 | About 14,000 tons for the UK's 15 possessions and about 3,000 for Portugal's five: a standing obligation a real 1880 fleet can meet, not a cap on fleet size. |
| 0017 | Base limit | `limitByBaseLevel` = 2 x level (2, 4, ... 20); `noBaseLimit` 2 | Base value is the nation's best port level in the area (already the schema's input). Linear so it is legible: a level-10 dockyard hosts 20 ships, a level-4 coaling station 8; two cruisers can coal anywhere ("very limited"). |
| 0018 | Slot-occupying states | `ACTIVE`, `RESERVE`, `WORKING_UP`, `REPAIR` (not `MOTHBALLED`) | Mothballed hulls sit in laid-up basins and draw no base services; every other state works from the base. Active-only would let reserve fleets hide abroad. |
| 0019 | Over-base effects | `maintenanceAdderBp` 2500; `crewQualityReduction` 2 points per month end; both certain, not probabilistic | The manual's "may" is read as a standing risk, modelled as a deterministic cost so it is explainable. 25% extra upkeep is felt but not ruinous; 2 points on the 0..100 scale erodes a fleet in about two years abroad. |
| 0020 | Cramped / short-range fraction | `crampedOrShortRangeCountBp` 5000, applied once when either flag holds | Half credit, the simplest "less than displacement". Colonial 1.5x (sourced) multiplies the product; the single product `floor(kg x 3 x 5000 / 20000)` is order-independent and already implemented. |
| 0021 | Colonial displacement | `colonialServiceDisplacementBp` 1500 | 15% of target displacement: a real design cost (the p.42 trade-off) that a 1.5x presence credit repays only on a foreign station. |
| 0022 | Home area | Option A: the home area carries a requirement; the blockade exemption covers it | Literal reading of "each area where they have possessions"; a blockaded nation is pinned in port (p.50) and must not be punished twice. Matches R3 and R7; no spec amendment. |
| 0023 | Penalties | `penaltyRequests: true`. Requested magnitudes for the consumers: prestige loss 100 bp of current prestige per shortfall area per month (S-2 proportional arithmetic, ADR-0239); revolt pressure 1 unrest point per shortfall area per month, trigger = shortfall in the same area for 3 consecutive months | Small and proportional (p.62), below the 300 bp unpaid-funds loss so presence is a nag, not a war-loser. The schema stays a flag: magnitudes are recorded here for S-2/S-3 to adopt when they consume the requests (no consumer exists yet). |
| 0026 | Classification | cramped = accommodation `SPARTAN`; short-range = `rangeNmAtCruise` below 2500 nm. A compile step writes `crampedAccommodation` / `shortRange` on `CompiledDesignVersion` | Reuses existing design fields. Deliberately independent of the 3000 nm colonial advisory, which asks a different question. |

## Decision: other requests

| Req | Decision | Rationale |
| --- | --- | --- |
| 0027 possession transfer | Option C: defer. #165 stays open, unimplemented | No war-termination mechanic exists; building transfer first would expand into a deferred subsystem. Fixtures continue to set ownership. Revisit when a war-end design is chartered. |
| 0035 support-force ordering | Option A: keep the neutral placeholders (priority 0, fit 0, type `BB`; strongest ally first under the cap) | Deterministic and already pinned. Option B needs a campaign ship-type source that does not exist; Option C changes shared combat code for the same outcome. Revisit when campaign exposes design class. |
| 0024 elevation | Option A: out of scope for the 1880 start; document that shields, casemates and open mounts are mount types and cross-deck fire is arc placement | No invented combat constants, no schema change, no golden movement. |
| 0015 `FC_INCOMPATIBLE` | Option B: severity `ADVISORY` while no compatible director is introduced by the design month, `WARNING` afterwards | The player is still told about the accuracy cost, but the severity channel stays meaningful when there is no remedy. Finding ids and subjects unchanged. Needs a small rule-input change and a deliberate golden re-pin, as its own ticket. |

## Consequences

- **#85 is unblocked.** It authors the S-5 table above as one complete section with
  provenance (`balance_adjustment` for every value except the sourced 1.5x multiplier),
  cites this ADR, and re-pins the goldens in the same commit per
  `docs/agents/golden-repinning.md`. The section is all-or-nothing, so nothing partial
  ships. The classification compile step (0026) and the `FC_INCOMPATIBLE` change (0015)
  are separate tickets with their own re-pins.
- **#165 stays open and blocked** on a war-termination design (0027).
- **Tuning.** Every value is a ruleset constant; retuning is a ruleset version change with
  a re-pin. The balance sweep should check S-5 presence and base limits first.
- **Reopening.** A higher-trust source for any value replaces the balance value through a
  ruleset version change, and this ADR is amended.
