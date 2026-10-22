# Decision Request: F-1 fog of war: what the strategic map may show about other nations

## Status

Blocked pending owner decision. Blocks implementation of the F-1 map overlays for foreign entities (spec
`.ai/briefs/f-1-strategic-map.md`, section Decisions required before #222).

## Trigger

The SPRINT-PLAN F-1 row and issue #222 ask for "fog-of-war tooltips". No document defines what the player is allowed to
know about another nation's fleets, ports, blockades or intentions. The only rule on record is the mine-warfare one
(`.scratch/mine-warfare-campaign/decisions/D6-knowledge.md`: enemy mines are invisible until they bite), and the opening
briefing explicitly leaves "intel-quality tiering" out as a fog-of-war concept (`packages/campaign-engine/src/opening-briefing.ts`).
Intelligence (W-3) is not built, so no detection, contact or intelligence-level data exists.

## Evidence

- `buildWorldMapView` (`packages/campaign-engine/src/world-map.ts`) returns every fleet of every nation with its area and
  ship count to the renderer through `inspectMap`. Nothing is filtered: the shipped Overview and F1 map already show all
  fleets of all nations.
- `.ai/SPRINT-PLAN.md` W-3 (Intelligence, depends on S-4): "Levels with ramp-up, detection raises tension, restricted
  enemy data." Not started. F-2 (production intelligence screens) depends on W-3.
- `docs/research/rtw3-manual-baseline.md` records no map visibility rule; the manual's strategic map shows ownership and
  the player's own forces.
- Relations (`allied`, `neutral`, war) exist in `snapshot.politics`; blockades the player is party to are already
  projected by `buildDiplomacyScreenProjection`.
- There is no "unidentified contact" concept at campaign level (contacts exist only in tactical combat).

## Why agent judgment is insufficient

Each rule is a gameplay and information rule. Showing all fleets makes the map an omniscient threat display (a different
game from one with intelligence), hiding them removes information the player has today, and a co-location rule invents a
detection mechanic that W-3 will later own. The choice also fixes what the engine projection must withhold, which is
tested behaviour.

## Options

### Option A: No fog until W-3 (status quo, flagged PROVISIONAL)

- Behavior: the map shows every nation's fleets as today; tooltips carry no hidden-information rule.
- Advantages: no change; no invented rule.
- Risks: contradicts the "fog-of-war tooltips" wording; W-3 later removes information players had, a visible regression.
- Compatibility impact: none. Migration impact: none. Scope: none.

### Option B: Own forces plus public facts only (recommended)

- Behavior: the engine projection returns the player's fleets in full; for other nations only public facts: area
  controllers, ports (name, owner, level) and blockades the player is party to. Foreign fleets are not drawn and not
  listed; the map says "Foreign fleet positions are not known: intelligence is not modelled yet". No allied sharing.
- Advantages: no invented detection mechanic; the filter is one engine function, testable; W-3 later adds tiers by widening
  the projection.
- Risks: hostile fleets are invisible, so threats surface only through battles and blockades; allied sharing deferred to
  W-3/W-4.
- Compatibility impact: none to saves or hashes (read projection only). Migration impact: none.
- Scope: small (projection filter, tests, copy).

### Option C: Co-location detection

- Behavior: a foreign fleet is visible when a player fleet or port is in the same campaign area, shown as "N ships,
  nation" with no composition.
- Advantages: gives threat information without W-3.
- Risks: invents a detection rule W-3 will replace; reveals a different amount for sea and coastal areas; needs balance.
- Compatibility impact: none to saves; behaviour to re-spec at W-3. Scope: medium.

## Recommendation

Option B: it never shows what the player could not know and never fabricates intelligence. Do not implement the foreign
fleet layer, tooltips or the visibility filter before approval; the player-fleet, port, ownership and movement parts of
the spec do not depend on this decision.

## Work safely completed while blocked

The F-1 spec separates the parts that do not depend on it (own-fleet selection, movement, pending orders, camera,
accessibility) and defines the filter as one engine function with the tier table left to this decision.
