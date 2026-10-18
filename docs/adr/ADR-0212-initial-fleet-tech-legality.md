# ADR-0212: Initial-fleet tech legality uses the global 1880 tech set

## Status

Accepted (2026-10-15). New record of decision DR-012; no prior ADR file existed
for it and none is restored (see ADR-0210). Resolves decision request
`.ai/decision-requests/0002-initial-fleet-tech-legality.md` (D1) and unblocks N-1
ticket 01.

## Context

The sole 1880 scenario (ADR-0201) opens with hand-authored starting fleets
(`content/production/1880/fleets.yaml`) whose ships mostly lack a
`designVersionId`, and with per-nation completed-technologies that are uneven (UK
8, five nations 0). Two readings of "whose starting ships are legal under 1880
technology" were plausible and not decidable from the content or code (N-1 report
F1/F4):

1. a starting ship is legal only if its nation has *completed* every technology
   its design requires; or
2. a starting ship is legal if the technologies it requires were available by
   1880 *globally*, research gating new construction, modernization and design
   rather than inherited service.

The only ship↔technology link in the code is the designer-side `unlockedTechs`,
keyed off the global technology `year`, never a nation's `completedTechs`
(`packages/ship-design/src/shipBuildingContent.ts:144`,
`packages/ship-design/src/shipBuildingContent.ts:254`,
`packages/ship-design/src/armamentContent.ts:403`,
`packages/ship-design/src/armamentContent.ts:475`). No prior ADR covers
initial-fleet legality.

## Decision

Reading 2. A ship is legal if the technologies its design requires were available
by 1880 (year ≤ 1880) in the global technology set. Per-nation `completedTechs`
do not gate inherited starting ships. As implemented, they also do not gate new
construction, modernization, or design availability: the designer's unlock gate
is global and calendar-only (ADR-0229).

Starting ships that cannot be tied to a modeled design are carried by an explicit,
documented exemption (a recorded reason), never a fabricated design or technology
link. No starting ship may be silently illegal: each is either design-linked and
1880-legal or explicitly exempted.

## Consequences

- N-1 ticket 01 links each starting ship to a design and adds a validation that
  every ship is either design-linked and 1880-legal or explicitly exempted;
  silently illegal ships fail the gate.
- N-1 ticket 04 reconciles research seeds for internal consistency (prerequisites
  met, active projects legal, no idle research) but is not required to make the
  starting fleets legal.
- A nation that is behind on research may still sail legacy ships it could not
  build today. This is intended (a service-vs-build distinction) and must be
  stated so it is not read as a defect.
- No wire-format or schema change; the effect is content and validation only.


## Amendment (2026-10-17): `completedTechs` does not gate construction

The Decision sentence above originally read that per-nation `completedTechs`
"gate new construction, modernization, and design availability at order time".
That described an intention, not the shipped code: no consumer in
`packages/*/src` or `apps/desktop/src` reads a nation's completed technologies
when gating construction or design. The gate is
`unlockedTechIds`/`unlockedTechs`, keyed only off the global technology `year`
(ADR-0229). The sentence is corrected in place above; the initial-fleet legality
decision itself is unchanged.
