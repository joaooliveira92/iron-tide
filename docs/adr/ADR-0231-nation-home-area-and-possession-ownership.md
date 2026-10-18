# ADR-0231: Authoritative nation home area and possession ownership in campaign state

## Status

Accepted (2026-10-18). Implements decision F of the wayfinder map
[#54](https://github.com/joaooliveira92/iron-tide/issues/54) via ticket
[#76](https://github.com/joaooliveira92/iron-tide/issues/76) (S-5 02, spec
[#73](https://github.com/joaooliveira92/iron-tide/issues/73), R3 and R13).

## Context

S-5 (foreign stations and presence) needs each nation's home area and the areas
where it owns possessions. The home area existed only as presentation content
(`presentation.mapJoin.nationHomeArea`), which the simulation must not read, and
possession ownership was compiled away, so a possession could never change hands.

## Decision

1. `homeArea` is an optional `Nation` field in `countries.yaml`. The compiler
   validates it against the area set: a nation without one fails with
   `HOME_AREA_MISSING`, one naming an unknown area with `HOME_AREA_UNKNOWN`. The
   values are the existing presentation-join values (a parity test pins this);
   the presentation join stays presentation.
2. `NationState.homeAreaId` and `WorldState.possessions` (`id`, `nationId`,
   `areaId`, ordered by id) are additive, optional snapshot fields.
3. A nation's presence areas are derived, never stored: the distinct areas of the
   possessions it currently owns, ordered by area id (`presenceAreaIds`). Updating
   a possession's `nationId` changes the answer on the next evaluation.
4. `WorldMapView` nations expose `homeAreaId` and `presenceAreaIds`.

## Consequences

- **Compatibility:** `CURRENT_COMPATIBILITY_VERSION` stays `3.1.0`. Both snapshot
  fields are optional and the persistence schema accepts them absent, so saves
  from earlier builds still load with them absent (round-trip parity test
  `presence-roundtrip.test.ts`). No authoritative outcome changes.
- **Golden re-pin:** content, snapshot, ledger and replay hashes move because the
  compiled state now carries the new fields and the fixture nations carry
  `homeArea`. The cause is understood and no simulation value changed.
- No tonnage, requirement or penalty value is introduced; those stay gated behind
  S-5 01 (#75).
