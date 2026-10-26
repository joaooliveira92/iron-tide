# ADR-0311: Fire-control radar sets the gunnery radar factor, and level 3 allows blind fire

## Status

Accepted (2026-10-26) for [#292](https://github.com/joaooliveira92/iron-tide/issues/292), part of
[#279](https://github.com/joaooliveira92/iron-tide/issues/279) under
[#249](https://github.com/joaooliveira92/iron-tide/issues/249). Applies the capability seam of
[ADR-0308](ADR-0308-e1-compiled-design-capabilities-reach-combat.md), the family vocabulary of
[ADR-0309](ADR-0309-e1-part-families-and-capability-kinds.md), and the balance-target policy of
[ADR-0283](ADR-0283-e1-1940-1970-content-decisions.md).

## Context

The gunnery accuracy model has a neutral `radar` factor and the air-defence model has a
`radarDiminishingReturnsBp` input, but nothing set either from a ship design. The manual (p.121)
says fire control "from level 3 will allow blind fire" and gives no accuracy figure; it also says
more than 4 radar-directed medium AA has diminishing returns and more than 8 is redundant (p.127).
Part capabilities now reach combat, and the radar family and capability kinds exist, so the
remaining work is a consumer with values.

## Decision

1. **One authored ruleset block.** `rulesets.yaml` gains a `gunnery.radar` section with three-level
   tables `accuracyBpByFireControlLevel`, `airDefenseSaturationBpBySearchLevel`, and
   `blindFireMinLevel`. The values are `BALANCE_TARGET` and carry provenance; no constant is hidden
   in code. The section is optional, so a pack without it keeps neutral radar behaviour.
2. **The best fire-control level sets the factor.** Combat projection reads the design's
   `capabilities`, takes the highest `fire_control_radar.level`, and sets the existing `radar`
   accuracy factor from the table. A design with no radar keeps the neutral factor exactly.
3. **Blind fire is a level check, not a hidden constant.** When the level reaches
   `blindFireMinLevel`, the projected battery carries `blindFireAllowed`. Gunnery resolution then
   accepts a contact track whose `confidence` is zero for that battery only; every other battery
   still fails with `TACTICAL_FOG_OF_WAR_VIOLATION`. A missing track is never a legal target.
4. **Search radar has a saturation value for the air-defence consumer.** The same helper maps the
   best `search_radar.level` to `airDefenseSaturationBpBySearchLevel`. Populating installations on a
   battle manifest belongs to [#295](https://github.com/joaooliveira92/iron-tide/issues/295); this
   ADR records the mapping and does not claim the air-defence module is reachable.
5. **Three radar parts make the effect reachable from the designer.** One search set (level 2, 1940)
   and two fire-control sets (levels 2 and 3, 1941 and 1943) are authored in
   `ship-building/parts/radar.yaml`; sensor slots accept the `radar` interface. Their mass, cost,
   crew and range are balance targets derived from the optical rangefinder part.
6. **The ruleset is threaded, not read ad hoc.** `gunneryRules` is an optional member of
   `MonthExecutorEngineOptions`, decoded once from the content bundle at the desktop boundary and
   passed to the auto resolver, the player-battle projection and the tactical replay verifier. A
   caller without it gets the previous neutral behaviour.

## Compatibility

Additive and optional on every persisted and content surface; the save compatibility version stays
4.0.0. The content hash moves and the content lock is refreshed. No production 1880 design carries
a radar capability, so the replay checkpoint hashes are unchanged and the re-record only refreshes
the content hash; the approvals file already covers the earlier world-technology delta. A design
that carries radar moves its own compiled hash, as ADR-0308 already decided.

## Consequences

- A player design with a fire-control radar resolves gunnery with the configured factor and, at
  level 3, can blind-fire at a zero-confidence track.
- The manual's 4/8 radar-MAA limits remain a separate air-defence wiring task under #295.
- Retuning the tables is a ruleset version change with replay re-approval.
