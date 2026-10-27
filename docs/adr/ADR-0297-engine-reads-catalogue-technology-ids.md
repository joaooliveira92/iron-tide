# ADR-0297: The engine reads the catalogue's technology id where one matches, and leaves the rest named

Applies to: combat, content

## Status

Accepted (2026-10-25). Resolves part of [#278](https://github.com/joaooliveira92/iron-tide/issues/278), found by the era mechanics
audit (`.ai/reports/e-1-era-mechanics-audit.md`). The owner delegated the per-id choice.

## Context

Engine code gated on technology ids no catalogue entry carries, so researching the authored technology changed nothing. Either
side can move; both are golden re-pins in principle.

## Decision

The catalogue is the player-facing, research-tied, provenance-carrying source, so the engine constant moves, never the catalogue id
(moving a catalogue id would also move the content hash and every replay).

| Engine id | Now reads | Reason |
| --- | --- | --- |
| `early_jet_carrier_operations` | `av_carrier_jet` | the only carrier-borne jet technology |
| `magnetic_mine_technology`, `acoustic_mine_technology` | `m_asw_influence_mine` | its authored name is "Magnetic and Acoustic Influence Mines" |
| `long_range_submarine_technology` | `sub_ww1_ocean_boat` | the ocean-going submarine, "Ocean-Going WWI Submarine" |

These ids stay as they are because the catalogue has no counterpart and choosing one would invent a mapping: `modern_jet_carrier_operations`
(no heavy-jet technology), `controlled_mine_technology`, `minelaying_submarine_technology`,
`missile_submarine_technology` (no matching entry; `m_asw_mine_laying` is surface minefield laying), and the aviation ids in
`hasAviationTech` (no aviation technology). Each needs a sourced catalogue technology first, a content ticket under E-1.

A cross-process test (`engine-technology-ids.test.ts`) fails if a migrated id leaves the production catalogue.

## Compatibility

No hash moves: these combat modules are not reached from a campaign month (#225, #282). All golden hashes and replays verify
unchanged. The technology notes in `technologies.yaml` still say the engine reads other ids; they are left so the content hash
stays put and are corrected with the next content change.
