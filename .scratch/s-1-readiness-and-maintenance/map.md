# Map: S-1 Ship readiness and maintenance

**Label:** wayfinder:map · **Status:** charted; route decisions resolved; one value
decision escalated, and the snapshot-changing route is gated by the missing golden
baseline.

## Destination

A spec and a ticket set for sprint S-1 (`.ai/SPRINT-PLAN.md`): every commissioned
ship carries an authoritative readiness state and crew quality; maintenance is
charged by readiness; repair costs about twice active maintenance and wartimes raise
it; working-up ships cannot fight; and all of it is deterministic, save-safe and
re-pinned. No implementation happens in this effort.

## Notes

- Authority order per ADR-0210. The manual (authority 3) governs the mechanic; the
  citation map is [`rtw3-manual-baseline.md`](../../docs/research/rtw3-manual-baseline.md)
  and the new [`s-1-readiness-and-maintenance.md`](../../docs/research/s-1-readiness-and-maintenance.md).
  Simulation matches RTW3; only UI/UX may deviate.
- Resolved by the orchestrator without a live human (user directive: run
  autonomously). Each decision derives from a higher authority, not a gameplay
  preference; values the manual lacks are escalated, not invented.
- Existing surfaces S-1 builds on: a `maintenance` phase already charges a
  status-blind per-ship cost (`packages/phase-engine/src/economyPhases.ts`); combat
  already declares readiness states, a `resolveReadiness` input and a crew-quality
  band (`packages/combat/src/generation`, `.../battleResolution`); the campaign
  passes hard-coded constants (`resolveReadiness: () => 80`, crew neutral `7_000`).
  S-1 wires readiness between them rather than adding a parallel model.
- Skills: `to-spec`, `to-tickets`, `tdd` for implementation later.

## Decisions so far

- [D1 Scope boundary](decisions/D1-scope-boundary.md): S-1 owns per-ship readiness
  and crew state, status-driven maintenance, the repair premium, wartime
  maintenance and the battle exclusion; special training, over-base effects,
  division/officer nudges, mission assignments and docks are named seams.
- [D2 Representation and seeding](decisions/D2-representation-and-seeding.md):
  required readiness + crew quality on `Ship`, derived at compile (no new
  authoring); moved under a compatibility bump; gated by decision request 0005.
- [D3 Maintenance by readiness](decisions/D3-maintenance-by-readiness.md): the
  existing maintenance phase charges by state; repair ×2 and mothball-half grounded;
  the rest via decision request 0007.
- [D4 Crew quality and ramp](decisions/D4-crew-quality-and-ramp.md): a `0..100`
  integer ramps to a per-state ceiling and feeds combat's existing crew/readiness
  inputs.
- [D5 Battle eligibility](decisions/D5-battle-eligibility.md): real readiness gates
  battles; working-up excluded; reserve/mothballed only in surprise attacks.
- [D6 Repair and wartime](decisions/D6-repair-and-wartime.md): repair as a state at
  ×2, mothball halts it; one wartime multiplier from war state.
- [D7 Production values](decisions/D7-production-values.md): escalated as decision
  request 0007; structural tickets use fixture-class values.

## Not yet specified

- Special training (pp.52-53) and the annual fleet exercise (p.53): grounded
  maintenance/crew mechanics that raise cost for crew gain, but not on S-1's
  acceptance path. Their own effort.
- Over-base deployment degrading maintenance and crew quality (p.45): belongs to
  S-5 foreign stations and base capacity.
- Division experience and officer ability nudging crew quality (pp.55-57): N-1
  ticket 07 and W-6.
- Whether Raider / Foreign Station / Trade Protection (p.48) are readiness states
  or mission assignments: S-5/W-1; do not resolve in S-1.
- Repair capacity semantics (does repair consume dock or shipyard capacity?): the
  manual is silent; owner unassigned.

## Out of scope

- Implementing special training and fleet exercise.
- Any repair-capacity, repair-time or rebuild interaction (manual silent; rebuilds
  are pp.31-32, their own effort).
- Per-nation maintenance or crew multipliers beyond Japan's training discount.
- Strategic movement rules for reserve/mothballed ships (the manual does not define
  them).
- National characteristic modifiers (for example Cautious): blocked until
  characteristics exist.
- Changing any existing maintenance constant before decision request 0007 resolves.
