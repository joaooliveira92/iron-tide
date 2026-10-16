# ADR-0214: Ten playable nations; the USA joins the 1880 playable roster

## Status

Accepted (2026-10-16). New record of decision DR-008.
Supersedes: ADR-0205.

## Context

The deliberately 1880-only first release commits fourteen production nations. Its
contract is ten playable nations. ADR-0205 demoted the United States to AI-only to
match the manual's own list of nine playable powers (manual p.18), but that
demotion was a lone `isPlayable` flag flip (commit `c86b1df`) against a nation
that was already authored end to end: 1880 start, construction queue, fleet,
economy, design identity, research programme, diplomacy, presentation, and
renderer art.

Repository evidence contradicts the nine-nation roster. The release gate
`packages/ship-design/test/productionNationCoverage.test.ts` asserts
`playable.length >= 10` ("1880 first release commits 14 nations (10 playable)") and
is red at HEAD with nine playable. The nine-nation roster is therefore a
regression, not the intended product behaviour.

## Decision

The USA is playable. The 1880 release has **fourteen committed nations and ten
playable nations**: Great Britain, Germany, France, Austria-Hungary, Russia,
Italy, Japan, China, Spain, and the United States. The remaining four nations are
AI-only until each passes the per-nation readiness gate.

- `content/production/1880/countries.yaml` marks the USA `isPlayable: true`.
- The renderer playable-slot manifest (`PLAYABLE_SLOT_COUNTRY_IDS`) includes `us`.
- The `>= 10` production coverage assertion is the intentional release invariant
  and must not be lowered to nine.
- ADR-0205 is superseded.

The executable release evidence — the `>= 10` coverage gate and the fully
authored USA content — prevails over the contradictory manual statement. The
manual is authoritative for mechanics and design intent, not for the scope of
Bluewave's single 1880 start (ADR-0201), so promoting the USA is a deliberate,
recorded divergence from manual p.18 rather than an error.

## Consequences

- Ten playable, fourteen committed nations for the 1880 release.
- The production campaign snapshot and the content lock change because the USA
  slot flips from `ai` to `playable`; those hashes are re-pinned by the canonical
  workflow (`content:build` and the pinned snapshot test), never by hand.
- Documentation and tests must remain synchronized with the ten-nation contract:
  the manual baseline, requirements, roadmap, and the roster tests all state ten.
- ADR-0205 stays on disk as the historical record of the superseded nine-nation
  baseline.
