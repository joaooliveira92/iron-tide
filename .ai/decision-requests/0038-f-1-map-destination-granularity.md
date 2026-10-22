# Decision Request: F-1 how a map drop identifies a campaign destination area

## Status

Resolved (2026-10-22): **Option A** (disambiguate at the drop). Ruled by the implementation agent under the owner's
standing delegation of implementation decisions for the #220 run (2026-10-22); the owner reviews on merge.

## Resolution

Option A. A drop on a polygon resolves the engine-derived legal one-hop campaign areas inside it: one legal area is
chosen automatically, several open a small keyboard-operable list, none shows the engine's reason. No content,
geometry or hash change. Option B (authored per-area anchors) remains available as a later refinement if playtesting
shows the second step is a nuisance.

## Trigger

`submitMovementCommand` takes a campaign `toAreaId`. The map draws 36 hand-authored polygons while the 1880 pack has 80
campaign areas (18 sea, 62 coastal) and 86 routes. The authored join `mapJoin.campaignAreaToFixture`
(`content/production/1880/presentation.yaml`) is many-to-one: for example `sea_mediterranean_w`, `sea_mediterranean_c`,
`sea_mediterranean_e`, `med_gibraltar`, `med_malta`, `med_cyprus`, `ita_tyrrhenian_coast` and others all sit on
`area_mediterranean`. A drop on a polygon therefore does not identify one destination.

## Evidence

- `apps/desktop/src/renderer/components/world-map/campaign-map-join.ts` and `world-map-source.ts` draw at polygon
  granularity; fleets are anchored on the polygon's label point, so two fleets in different campaign areas of one polygon
  are drawn at the same place.
- The engine rule (`packages/campaign/src/movement.ts`, `fleetMoveProblem`) allows one hop along a `sea` route to a
  non-land area; the legal set is defined per campaign area, never per polygon.
- The Fleet screen avoids the issue by listing campaign areas by name.
- The area tree (`AreaTreePanel`) already lists campaign areas by name.

## Why agent judgment is insufficient

Every option sends a different `toAreaId` for the same gesture, so the choice changes authoritative commands; options B
and C change authored content or the map's geography.

## Options

### Option A: Disambiguate at the drop (recommended)

- Behavior: dropping a fleet on a polygon lists the legal one-hop campaign areas inside that polygon (engine-derived). One
  legal area is chosen automatically; several open a small list (keyboard operable) to pick; none shows "no legal
  destination here" with the engine's reason. Markers still sit at polygon anchors.
- Advantages: no content or geometry change; uses the existing join; the same list serves the keyboard path.
- Risks: a second step for multi-area polygons; two fleets in one polygon are indistinguishable by position (mitigated by
  the fleet list).
- Compatibility impact: none. Migration impact: none. Scope: small to medium.

### Option B: Author per-campaign-area anchors in presentation content

- Behavior: add a map anchor (lon/lat) for each campaign area to `presentation.yaml`; markers and drop targets use
  campaign areas.
- Advantages: precise, one-step drop.
- Risks: 80 authored points and a compile/validation change; content hash and golden content-lock re-pin; geography owner
  needed.
- Compatibility impact: new optional presentation keys, content hash moves. Scope: medium.

### Option C: Draw campaign areas instead of polygons

- Behavior: replace the 36-polygon wash with 80 areas.
- Risks: large geometry authoring and originality review. Scope: large.

## Recommendation

Option A for F-1, with Option B as a later refinement if playtesting shows the second step is a nuisance. Do not implement
drag-to-move before approval; selection, camera and Fleet-driven movement are unaffected.

## Work safely completed while blocked

The spec defines the legal-destination projection and the drop flow parametrically, so choosing A needs no further spec
work.
