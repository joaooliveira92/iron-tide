# ADR-0213: The 1880 opening posture is authored canon; magnitudes are balance choices

## Status

Accepted (2026-10-15). New record of decision DR-013; no prior ADR file existed
for it and none is restored (see ADR-0210). Covers the N-1 opening-posture tickets
05 (diplomacy), 06 (squadrons/fleets) and 07 (divisions/officers).

## Context

The sole 1880 scenario (ADR-0201) compiled with a flat opening posture: every one
of the 91 nation pairs was neutral at tension 5 (N-1 report F5), every nation had
zero divisions (F6), and the officer rosters were uniformly shaped (F8). These
are not defects — nothing was inconsistent — but they leave the scenario without
the alignments, rivalries, deployments and command structures that make a January
1880 start meaningful.

Unlike the tickets that fixed contradictions (01-04, 08-09), these tickets require
*authoring* values, not reconciling facts. The repository holds no authored
diplomacy, division or officer source, and the manual baseline
(`docs/research/rtw3-manual-baseline.md`) defines the relevant vocabularies (e.g.
a 0..10 tension scale) but not the values. A tension magnitude, a squadron
composition and a division establishment are therefore design choices, not
citable facts. The *directions*, however, are well-documented history (the Dual
Alliance of 1879, revanchism after 1871, the Great Game, the state of the naval
powers in 1880).

## Decision

The 1880 opening posture is authored canon. For each opening-posture collection:

- The **direction** of a value (who is aligned or rivalrous, which ship is the
  flagship, which arm is a nation's strength) follows citable history.
- The **magnitude** (a 0..10 tension, a squadron strength, a division count) is an
  admitted balance choice, recorded through the standard provenance record with
  `kind: balance_adjustment` and `sourceStatus: BALANCE_TARGET`, and explained in
  its `note`. Values are never presented as sourced facts.

The compiled artifact remains the single source of truth: relations, squadrons and
divisions are validated content, not runtime invention, and each posture ticket
carries a test asserting the authored values load and differ from the uniform
baseline.

## Consequences

- Ticket 05 authors the notable 1880 alignments and rivalries in
  `content/production/1880/diplomacy.yaml` (default neutral@5 still covers the
  unauthored pairs).
- Ticket 06 authors starting squadrons for the nations that had them and gives the
  five AI-start nations producing designs and technologies.
- Ticket 07 authors initial divisions and nation-appropriate, distinct officer
  rosters (removing the uniform shape).
- Balance magnitudes may be retuned later without a schema change; retuning is a
  balance adjustment, not a factual correction, and should update the provenance
  note rather than a source citation.
- No wire-format or schema change.
