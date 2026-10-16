# Decision Request: S-1 readiness, crew and maintenance values

## Status

Blocked pending owner decision.

## Trigger

S-1 "Ship readiness and maintenance" must charge maintenance by readiness state and
ramp crew quality, but the manual supplies almost none of the numbers. The S-1
scoping note (`docs/research/s-1-readiness-and-maintenance.md`, "What the manual does
not supply") confirms the gaps. Without these values the structural tickets can be
built and tested against fixture-class constants, but no production behaviour can be
authored, and the sprint's acceptance criterion "maintenance by status" cannot be met
with sourced numbers.

## Evidence

- Grounded (may ship as canonical): repair ≈ **2× active** maintenance and
  mothballing halts repair and its premium (manual p.51); mothballed construction =
  half mothballed maintenance (p.30), already in content as
  `mothballedMaintenancePerMonthMicro` / `preservationCostBp: 5000`; the readiness
  states and names `AF`/`RF`/`MB`/`WU` (pp.48, 51); working-up ships, and otherwise
  reserve/mothballed ships, do not fight (pp.51, 69).
- **Not grounded, required by S-1:** the absolute active maintenance rate; the
  reserve and mothballed multipliers; the wartime maintenance multiplier ("rises
  sharply", p.52); the per-state crew-quality ceilings and the monthly ramp rate;
  the working-up "decent crew quality" threshold (p.51); and the readiness value
  combat should receive now that the campaign supplies it (today a hard-coded `80`).
- Existing code constants these replace or bound: `computeMaintenanceCost`
  (`packages/phase-engine/src/economyPhases.ts:25`, `floor(hitPoints * 10 / 100)`,
  duplicated in `packages/campaign-engine/src/opening-briefing.ts` and
  `.../projection.ts`); `resolveReadiness: () => 80`
  (`packages/phase-engine/src/battlePhases.ts`); the neutral crew band
  `AUTO_TORPEDO_CREW_QUALITY_BP = 7_000`
  (`packages/combat/src/battleResolution/torpedoProjection.ts`).
- ADR-0213 establishes that opening-posture magnitudes with no manual source are
  recorded as balance choices; ADR-0210 forbids inventing values as fact.
- `.ai/decision-requests/0003` (prestige) and `0004` (mine inventory) are the
  precedent: structural tickets use fixture-class values; only the value ticket is
  gated.

## Why agent judgment is insufficient

The active maintenance rate, the state multipliers, the wartime multiplier and the
crew ramp are gameplay balance, not derivable from the manual or from a higher
authority. Choosing them silently would contradict ADR-0210 ("values the manual omits
are escalated, never invented") and would set the game's economy and training curve
without an owner. Different choices materially change play — how cheaply a fleet can
be laid up, how long a crew takes to reach fighting standard, how hard war presses
the budget — so the outcome is not a routine local design choice.

## Options

### Option A: Research high-trust sources, then author ruleset constants

- Behavior: research RTW3 (and its documented formulas/community references) against
  primary sources, then set the ruleset constants from that evidence, recording
  provenance per value; values with no source are marked explicit balance targets
  (ADR-0213).
- Advantages: keeps values grounded where possible; isolates all numbers as tunable
  ruleset constants; matches the S-2/S-1 mechanism of a single escalated value ticket.
- Risks: RTW3's exact formulas may be undocumented (closed source); some values will
  still be balance targets.
- Compatibility impact: none until ticket 08; fixture-class constants carry tickets
  01-07.
- Migration impact: none.
- Scope and effort: a research pass plus ticket 08.

### Option B: Accept ADR-0213 balance-adjustment placeholders now

- Behavior: choose documented-balance placeholder magnitudes immediately (like the
  opening-posture choices), mark them `provenance.kind: balance_adjustment`, and tune
  later.
- Advantages: unblocks tickets 02-06 and 08 at once; no external research.
- Risks: sets the economy and crew curve by fiat without a source; likely to be
  retuned, so the reference hashes churn.
- Compatibility impact: the chosen numbers move goldens (already gated by 0005).
- Migration impact: none.
- Scope and effort: ticket 08 only.

### Option C: Gate all value-bearing tickets on the owner

- Behavior: build only the value-free structure (representation, seams) and stop
  before any production charge or ramp.
- Advantages: asserts nothing ungrounded.
- Risks: S-1 cannot be accepted; "maintenance by status" stays unimplemented.
- Compatibility impact: the representation still moves goldens (0005).
- Migration impact: none.
- Scope and effort: defer everything after ticket 01.

## Recommendation

Option A. It grounds what can be grounded, isolates every number as a ruleset constant
so tuning never changes the model, and follows the precedent set by decision requests
0003 and 0004. Until it resolves, tickets 02-06 carry fixture-class constants and
ticket 08 stays blocked.

## Work safely completed while blocked

- S-1 charted and sliced: `.scratch/s-1-readiness-and-maintenance/` (map, D1-D7, spec,
  tickets 01-09), `.ai/specs/s-1-readiness-and-maintenance.md` pointer.
- Grounded research written: `docs/research/s-1-readiness-and-maintenance.md`.
- No engine, content, test or golden change.
