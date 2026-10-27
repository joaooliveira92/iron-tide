# ADR-0229: Technology `year` is the global designer unlock year, not a research claim

Applies to: content-schema, ship-design, phase-engine

## Status

Accepted (2026-10-17). Records decision D4 of the N-3 map (#42), closed on
[#46](https://github.com/joaooliveira92/iron-tide/issues/46) and resolved by
delegation in
[decision request 0013](../../.ai/decision-requests/0013-n-3-progression-acceptance-and-technology-timing.md).
Sprints: N-3.

## Context

The RTW3 manual makes research priority-driven and uncertain (pp.16–17) and
describes technologies as available **for research** at their historical time
(p.19); its earliest start is 1890 (p.21), so it supplies no 1880–1889
technology list. The repository nonetheless ships an 1880 production pack with
84 technologies, each carrying an optional integer `year`
(`packages/content-schema/src/technology.ts`, bounds 1880–1970).

Two consumption paths disagree. The designer's construction and armament
catalogues treat `year` as a global calendar unlock:
`unlockedTechIds` (`packages/ship-design/src/shipBuildingContent.ts:145`, used
at `:254`) and `unlockedTechs`
(`packages/ship-design/src/armamentContent.ts:403`, used at `:475`) return every
technology with `year <= calendarYear(month)`, regardless of nation. The runtime
research phase does not see content technologies at all: it resolves the six
stub ids in its own `TECH_DEFINITIONS` table
(`packages/phase-engine/src/research.ts`) and returns no eligible content
technology; `packages/phase-engine/test/foreign-insight.test.ts:325` pins that
reachability gap deliberately. No `year` is read by the research phase.

ADR-0212 stated that per-nation `completedTechs` "gate new construction,
modernization, and design availability at order time". No shipped consumer does
that; the sentence described intent, not implemented behaviour. N-3 needs one
documented meaning before it can assert progression, and the owner delegated D4
as engineering-resolved.

## Decision

- **`year` is the global designer/construction unlock year, as implemented.** A
  technology with `year <= calendar year` is available to every nation's designer
  from January of that year. The designer gate is calendar-only and
  nation-independent.
- **This is not a claim about RTW3 research or per-nation discovery.** The game
  diverges from the manual's research-driven unlock model; the repository records
  the divergence rather than presenting `year` as RTW3 behaviour.
- **Per-nation research wiring is deferred.** Connecting content technologies to
  the research phase, introducing nation-specific discovery, or gating designs by
  a nation's completed technologies is a future milestone. It would change
  authoritative outcomes, saves and goldens, and needs its own compatibility and
  fidelity decision (decision request 0013, options D2/D3).
- **ADR-0212's `completedTechs` sentence is corrected to the code** (amendment
  recorded in that ADR). The global 1880 technology set still governs
  initial-fleet legality as ADR-0212 decided; what changes is the claim about
  construction-time gating.

## Consequences

- N-3 asserts progression as per-year availability events: a technology `year`
  or a part/component introduction (spec #47 R1–R3). Quiet technology years
  (1883, 1884, 1887) are not gaps because part/component introductions cover
  them; no technology is authored to satisfy a count (decision B4, #44).
- No content, schema, compatibility version, content lock or golden changes.
  The production pack's declared dates are reported with their provenance; dates
  flagged ESTIMATE/UNVERIFIED stay labelled, not certified.
- A future research-wiring milestone must supersede or amend this record. Until
  then, a designer availability test that depends on per-nation tech state would
  be asserting behaviour the engine does not have.
