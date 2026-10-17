# Decision Request: S-1 readiness, crew and maintenance values

## Status

Resolved (2026-10-17) — owner chose **Option A** (research and author grounded
readiness, crew, and maintenance constants; classify every remaining unsourced
magnitude as an explicit `balance_adjustment` target). See the owner decision
below.

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

## Decision-ready packet (reconciled 2026-10-17)

**Exact question requiring owner authority.** What production values should S-1's
readiness, crew and maintenance mechanics use, where the manual supplies almost none —
research-grounded ruleset constants for the ungrounded numbers (A), immediate ADR-0213
labelled balance placeholders (B), or gate all value-bearing tickets and ship only the
value-free structure (C)?

**Affected scope.** S-1 tickets 02–09 (ticket 08 authors values; ticket 09 acceptance);
`packages/phase-engine/src/economyPhases.ts` (`computeMaintenanceCost`),
`packages/phase-engine/src/battlePhases.ts` (`resolveReadiness`),
`packages/campaign-engine/src/{opening-briefing,projection}.ts`,
`packages/combat/src/battleResolution/torpedoProjection.ts`
(`AUTO_TORPEDO_CREW_QUALITY_BP`); the ruleset constants; `golden/hashes.json`;
compatibility version. Acceptance: "maintenance by status" and the working-up battle
exclusion, driven from a compiled month.

**Known constraints and invariants.** Grounded and shippable: repair ≈ 2× active
maintenance and mothballing halts repair (manual p.51); mothballed = half maintenance
(p.30, already `mothballedMaintenancePerMonthMicro` / `preservationCostBp: 5000`); the
`AF`/`RF`/`MB`/`WU` states and the rule that working-up ships do not fight (pp.48, 51,
69). Ungrounded and escalated (ADR-0210): the absolute active rate, the state
multipliers, the wartime multiplier, crew ceilings and ramp, the working-up threshold,
and the battle readiness value (today a hard-coded `80`). ADR-0213 permits labelled
balance magnitudes; ADR-0210 forbids inventing values as fact.

**Options.** A — research high-trust sources, author ruleset constants with provenance,
mark the remainder `balance_adjustment`. B — author labelled placeholders immediately.
C — ship only the value-free structure (representation and seams; ticket 01 already
landed) and stop before any production charge or ramp.

**Consequences.** _Gameplay:_ the economy and the training curve (how cheaply a fleet
is laid up, how long a crew takes to fight) and wartime pressure. _Determinism:_
maintenance/readiness feeding the snapshot moves the goldens (understood cause,
re-pinned). _Saves:_ compatibility bump if the snapshot shape changes. _Wire:_ none.
_Balance:_ the core surface — every value is a balance target unless sourced. _Content:_
possibly a ruleset constants file. _Tests:_ re-pin goldens; parity test across the
phase, opening briefing and projection. _Migration:_ compat bump; prior saves refused
or migrated.

**Recommendation.** Option A. It grounds what can be grounded (the research note
exists at `docs/research/s-1-readiness-and-maintenance.md`), isolates every number as a
tunable ruleset constant, and follows the 0003/0004 precedent. Until it resolves, do not
ship placeholder rates as production; the value-free structure (ticket 01) has landed.

**Minimum owner response to unblock.** "Approve Option A: author the grounded constants
as above and mark the remaining numbers as `balance_adjustment` targets" — or supply the
values, or choose B/C.

**Must not be guessed.** The absolute active maintenance rate; the reserve/mothballed/
wartime multipliers; the per-state crew ceilings and monthly ramp; the working-up
threshold; the battle readiness value; whether structural tickets may carry fixture
constants (only if not shipped as production).

## Owner decision (2026-10-17)

**Chosen:** Option A — research and author grounded readiness, crew, and
maintenance constants; classify every remaining unsourced magnitude as an
explicit `balance_adjustment` target. Recorded in
[ADR-0223](../../docs/adr/ADR-0223-s1-readiness-crew-maintenance-ruleset-constants.md).

**Authorized production values or rules.** Preserve the documented rules that
repair costs approximately twice active maintenance, mothballing prevents
repair, mothballed ships cost half maintenance, the `AF`/`RF`/`MB`/`WU` states
remain distinct, and working-up ships cannot fight. Research the remaining
constants using high-trust sources. Store all resulting values as named,
centralized ruleset constants with provenance. Any value that cannot be grounded
may be selected only as an explicitly labelled ADR-0213 `balance_adjustment`,
covered by deterministic tests and designed for later tuning.

**Additional constraints.** Do not embed numeric gameplay constants directly in
`economyPhases.ts`, `battlePhases.ts`, `opening-briefing`, `projection`, or
`torpedoProjection.ts`. Remove or replace the hard-coded battle-readiness value
of `80` through the centralized ruleset mechanism. Ensure maintenance, readiness,
projections, and opening-briefing calculations consume the same authoritative
constants. Re-pin goldens only when observable deterministic output actually
changes, using the established same-commit procedure.
