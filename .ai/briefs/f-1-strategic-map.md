# Milestone F-1: Strategic map

Spec for issue #222 (epic #220), roadmap row F-1. Resolves decision request 0036 as Option A. This is a specification;
nothing here is implemented. Evidence below is read from the repository at `dev` 5b8cd86d.

## Objective

A dedicated, production "Map" campaign screen where the player reads the world from compiled campaign state only and
orders a fleet one hop by dragging its marker. The drag issues exactly the command the Fleet screen issues, so the
envelope and the resulting hash are identical. No fixture world is reachable in a production build.

## Canonical requirements

- `.ai/SPRINT-PLAN.md` F-1: "pan/zoom, fog-of-war tooltips, drag-to-move, Suez and Panama gating, invasion range"
  (depends on S-5, U-4). Issue #222 acceptance: same envelope and hash as the Fleet screen; no fixture data in a production
  build (test); overlays honour preferences and non-colour palettes; `pnpm snap` evidence; ledger rows updated.
- ADR-0062 (one hop a month, `MoveFleet` is the only mutator), ADR-0159 (command programs), ADR-0202/0203 (presentation
  only), ADR-0266 (S-5 values), ADR-0267 (reachability ledger), BW-DET-001/003, BW-ARC-001/002, BW-STA-001.
- Shipping bar (AGENTS.md): playable, seen (`pnpm snap`), tunable, explainable, measured.
- Scope changes to the F-1 row need the owner: decision request 0039.

## Starting state (infrastructure present and reusable)

Verified, not assumed.

- `components/world-map/*` is production and reads the compiled campaign: `inspectMap` ->
  `buildWorldMapView` (all areas, ports, fleets, routes) -> `joinWorldMap` -> `useWorldMapModel` -> `WorldMapChart`. Three
  hosts: Overview (`variant="command"`), Fleet (`WorldMapPanel`) and the global F1 sheet (`shell/MapSheet.tsx`). Ledger
  row `read-world-map` is `reachable`; click-depth row `world-map` is Overview, 0 extra clicks.
- Camera (`useMapCamera`): wheel zoom, pointer-drag pan with pointer capture, horizontal wrap, vertical clamp, scales 0.9
  (fit) to 60, `focusOn`, `reset`, keyboard arrows, plus/minus and zero, minimap, scale bar, initial focus on the home area.
- Movement: `submitMovementCommand`, `replaceMovementCommand`, `cancelMovementCommand` (`main/commands/fleetCommands.ts`).
  Body `MoveFleet { nationId, fleetId, toAreaId }`; command id derived from turn and fleet, so a second order for the same
  fleet supersedes the first; queue mirrored to `pending-commands.json` outside the save hash; applied at `commitMonth`.
  Legality is `fleetMoveProblem` (`packages/campaign/src/movement.ts`): the fleet is the player's, not on foreign
  station, has an operational ship and none under rebuild, destination is a known non-land area directly joined by a
  `sea` route, and not the current area. Stable codes: `INVALID_COMMAND_PAYLOAD`, `INVALID_ROUTE`,
  `SHIP_NOT_OPERATIONAL`, `SHIP_UNAVAILABLE`, `FOREIGN_STATION_ASSIGNED`.
- `inspectFleetScreen` returns the player's fleets, `areaEdges`, queued `movementCommands`, `presence` and `overBaseShips`.
- Preferences: `measurementPreset` and per-category selections (including `range`), `tooltipDetail`
  (`shell/tooltip-detail.ts`), `theme` (includes `highContrast`), locale and language; `translate()` for strings.
- Accessibility seams: `map-a11y.ts`, an `sr-only` ownership table, `role="application"` with keyboard pan/zoom.
- Blockade state exists in the snapshot (`wars.blockadeState`) and the player's rows in the diplomacy projection.

## Findings that change the meaning of "promote the prototype"

1. A production map already exists and is the Overview's primary panel. Only `screens/map-prototype` (dev-only, fixture
   world, registered under `import.meta.env.DEV`) is a prototype. What is missing is a dedicated screen and orders.
2. The chart is not free of the fixture. `fixture-world.ts` is imported by the production chart: it supplies the 36
   polygons and labels (needed), but also nation ramp, possessions, fleets, ownership and passages (not canonical; its header
   says so). `fixtureWorldMapSource` draws that fixture world whenever there is no session or the bridge fails;
   `campaignWorldMapSource` falls back to fixture ownership for areas the campaign never mentions.
3. The map draws 36 polygons; the pack has 80 campaign areas joined many-to-one (`presentation.yaml` `mapJoin`). A drop
   on a polygon does not identify a `toAreaId` (decision request 0038).
4. `buildWorldMapView` returns every nation's fleets; nothing is hidden (decision request 0037).
5. The engine has no passage, canal or blockade-on-movement rule. Passages exist only in the fixture; Panama is not in
   the production pack (decision request 0039).
6. The Fleet screen offers every `areaEdges` neighbour and relies on the engine to reject; the map must not repeat that.
7. The scale bar formats nautical miles with `toLocaleString("en-US")`, ignoring `measurementPreset` and locale.
8. The presence values are decided (ADR-0266) but the production section is not authored (ticket #85), so
   `presence` is `{ configured: false }`. The pre-ADR-0266 statement in decision request 0036 that 0017-0023 and 0026 are
   open is stale.

## Decisions required before #222 can be implemented

| Decision                                                          | Request                                                                           | Blocks                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Fog-of-war tiers for foreign entities                             | `.ai/decision-requests/0037-f-1-fog-of-war-information-tiers.md`                  | Foreign fleet layer, tooltip content, the visibility filter |
| Drop-target granularity                                           | `.ai/decision-requests/0038-f-1-map-destination-granularity.md`                   | Drag-to-move (the drop flow)                                |
| Scope: passage gating, invasion range, blockade/presence overlays | `.ai/decision-requests/0039-f-1-scope-split-passage-gating-and-invasion-range.md` | Narrowing the F-1 row; legend copy                          |

This spec is written to the recommended option of each, so approval of the recommendations needs no further spec work;
any other option reopens the named section only.

## Behaviour that can be deferred

- Cross-launch persistence of camera and selection (in-session restore is required).
- Allied intelligence sharing and intelligence tiers (W-3, W-4); the "unidentified contact" class, which cannot exist
  before W-3.
- Passage gates and rules; invasion range (W-5); blockade overlays for blockades the player is not party to.
- A colour-vision palette preference (none exists; only `theme` incl. `highContrast`); touch-first gestures.
- Per-campaign-area anchors (0038 Option B); orders from the Overview, Fleet and F1 sheet surfaces.
- Multi-fleet selection and multi-hop route planning (the engine allows one hop a month).

## Infrastructure blocked by an unimplemented capability

| Need                                                  | Blocked by                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Invasion range overlay and any range query            | W-5 (depends on W-1, T-1); no engine query or ruleset value               |
| Suez and Panama gating                                | No engine passage rule or content; Panama is not in the pack (0039)       |
| Presence overlay with real values                     | Ticket #85 authors the production section; until then `configured: false` |
| Foreign fleet intelligence                            | W-3 (0037)                                                                |
| Penalty and revolt consequences of presence shortfall | No S-2/S-3 consumer yet (ADR-0266)                                        |

## In scope

1. Entry point and screen. A new campaign screen `strategic-map`, label "Map", registered always (not debug-gated) in
   `shell/campaign-screen-registry.tsx`, `campaign-screen-types.ts`, `campaign-screen-routes.tsx`, sidebar section and
   strings. Click-depth row `{ feature: "strategic-map", screen: "strategic-map", path: ["Map"] }` (1 click). The
   existing `world-map` row stays on Overview. Component `screens/strategic-map/StrategicMapScreen.tsx` is a thin host.
2. Reuse, extend, refactor. Reuse `WorldMapChart`, camera, model, minimap, area tree and inspector unchanged. Extend the
   chart with an optional `orders` capability, enabled only on `StrategicMapScreen`; Overview, Fleet and F1 stay
   read-only. Refactor the Fleet screen's order workflow (`useFleetScreen` submit/replace/cancel) into one shared hook
   `useMovementOrders` used by both screens, so there is a single code path to the bridge.
3. Remove the fixture world (see Fixture removal).
4. Disposition of `screens/map-prototype`: delete the directory (README "Deleting this"), the `map-prototype` union
   member, registry entry, route, sidebar entry, `nav.screen.map-prototype.*` strings and its exclusions in
   `feature-depth.test.ts`, `released-screen-theme.test.ts` and `type-floor.test.ts`. Variants B and C are recoverable
   from git history; the README already records the recovery commands. `components/world-map/map-contract.ts` stays
   (the chart uses `MapViewProps`).
5. Engine projection additions (read-only, no hash, no compatibility bump): a per-player-fleet `legalDestinations`
   list and `blockedReason`, derived by calling `fleetMoveProblem` for each neighbouring area; the visibility filter
   (0037); blockade rows the player is party to. Authoritative rules are not duplicated in the renderer.

## Selection

- Selectable: an area (polygon), the player's own fleet (marker), a port, a foreign fleet group where visible (0037).
  Selecting never issues a command. One selection at a time. The inspector shows the selection; an area selection lists
  its campaign areas (the many-to-one join) with controller, ports, visible fleets.
- Pointer: click selects; click on empty sea clears. Shift-click two areas still gives the route reading (existing).
- Keyboard: Tab enters the map, arrow keys pan (existing), `F` cycles the player's fleets in id order, Enter opens the
  fleet's order mode, Escape clears. A fleet list in the inspector is the equivalent non-spatial path.
- After a month commit the selection is kept by id; if the entity is gone the selection clears and a status message says
  so.

## Movement interaction

- Drag-to-move is permitted, from the player's own fleet markers only. Dragging anywhere else pans (the existing
  gesture); a marker drag starts after a 6 px threshold, so a click still selects.
- On pick-up the engine-derived `legalDestinations` are highlighted; illegal and unreachable areas dim, and a fleet with a
  `blockedReason` (for example on foreign station, no operational ship, under rebuild) does not lift, shows the reason
  verbatim and offers no drag. Escape or dropping outside cancels with no command.
- On drop on a legal polygon the destination is resolved per 0038 (recommended: auto when one legal campaign area lies
  in the polygon, else a keyboard-operable list). The renderer sends the same payload the Fleet screen sends, through the
  shared `useMovementOrders`: `submitMovementCommand { sessionId, divisionId = fleet id, fromAreaId, toAreaId,
  expectedRevision, transportRequestId }`. Submission is immediate; the order is reversible until the month commits
  (cancel or replace). A second drag for the same fleet uses `replaceMovementCommand` when an order is pending, which the
  main process already treats as a supersede.
- The keyboard path is the same flow: Enter on a fleet, choose a destination from the legal list, Enter submits.
- Legal destinations: exactly the set for which `fleetMoveProblem` returns null for that fleet in the current snapshot.
  Illegal: land, the current area, any area not one `sea` hop away, any destination for a blocked fleet, another
  nation's fleet. Blockade, closure and passage rules do not affect legality in F-1 (none exist).
- Identity rule (acceptance): for the same fleet, destination and revision the map and the Fleet screen produce the same
  `MoveFleet` body and `commandId`, and the same snapshot hash after `commitMonth`.

## Feedback, pending state, rejection, errors

- Pending order: a dashed route from the fleet's area to the destination with an arrowhead and a text label "Ordered:
  sails at month end"; the fleet's inspector row shows the order with a Cancel order button. Source of truth is
  `movementCommands` from `inspectFleetScreen`, refetched on revision change.
- Cancel: button or keyboard on the selected fleet (`cancelMovementCommand`); the dashed route disappears.
- Rejection: the engine's stable code and diagnostic message are shown verbatim in a live region
  (`role="status"`, `role="alert"` for errors); the fleet returns to its area; nothing is queued. The renderer does not
  map codes to prose it invented.
- Stale revision (`expectedRevision` mismatch): refetch, say "The campaign moved on; check your order", keep nothing
  pending locally.
- Bridge or read failure: an inline error state with Retry; never fixture data.
- No campaign (`sessionId === null`): "No campaign loaded"; no chart overlays.

## Camera

Reuse as is: wheel and trackpad-pinch zoom to the cursor (verify `ctrlKey` wheel is handled; add if not), pointer-drag
pan, keyboard pan/zoom, bounds (wrap east-west, clamp north-south, scale 0.9 to 60), `focusOn`, `reset`, minimap. Focus
restoration: the screen opens on the player's home area (existing `useInitialFocusArea`); returning to the screen in the
same session restores the last camera and selection from a shell context (not saved to disk, not authoritative).
Selecting an area from the tree focuses it. Touch is not a target; pointer events keep working.

## Fog of war: tiers and authoritative source

Source: the main-process `inspectMap` projection, filtered inside `@bluewave/campaign-engine` by one pure function of
`(snapshot, viewerNationId)`. The renderer never receives hidden entities and never filters. Tier table at the
recommended option of 0037:

| Class                     | Visible                                                                          |
| ------------------------- | -------------------------------------------------------------------------------- |
| Own fleets                | Name, area, ship count, ships and readiness (existing fleet view), pending order |
| Own and all ports         | Name, owner, level (public)                                                      |
| Area control              | Controller of every area (public)                                                |
| Allied and neutral fleets | Not shown (no intelligence; allied sharing deferred)                             |
| Hostile fleets            | Not shown                                                                        |
| Unidentified              | Does not exist before W-3; never rendered or worded                              |
| Blockades                 | Those the player is party to, from the diplomacy rows                            |

The legend states "Foreign fleet positions are not known: intelligence is not modelled yet". Tooltips follow the
`tooltipDetail` preference: `minimal` suppresses them; `standard` and `detailed` show them; no tooltip text may carry
information absent from the filtered projection. A change of option in 0037 changes only this table and its tests.

## Presence, blockade and invasion range

- Dormant presence data is activated read-only, not replaced: the overlay renders from `inspectFleetScreen.presence` per
  campaign area (required, present, shortfall tons; exempt flag) and only when `configured: true`; otherwise the layer is
  hidden and the layer toggle shows "Presence: not configured". Tests inject a configured readout; no production value is
  assumed until #85.
- Blockade overlay: rows the player is party to, drawn on the blockaded area with a hatch pattern and text, never colour
  alone. Blockade has no movement effect in F-1.
- Invasion range before W-5: not drawn, no placeholder radius and no number. The legend says "Invasion range is not
  modelled yet". F-1 and W-5 boundary: F-1 owns the layer slot, the legend row and the projection extension point; W-5
  owns the range value, the query and the geometry, and adds them without changing the screen contract.
- Suez and Panama gating: not drawn and not enforced (0039). Passage glyphs come out with the fixture.

## Fixture removal

- Split `fixture-world.ts` into `map-geometry.ts` (area rings, labels, tiles used by the chart, edges only if a campaign
  lane needs a fallback, `AREAS_BY_ID`) and delete the rest: nations, possessions, fleets, passages, derived control,
  `fixtureWorldMapSource`, the fixture nation ramp and the fixture branch of `useWorldMapController`.
- `campaignWorldMapSource` stops falling back to fixture ownership: an area the campaign does not mention is drawn
  "no campaign data" (existing `unavailable` styling). `lanes` come only from the campaign.
- Geometry is static presentation data, not state; area ids in it are joined by the authored `mapJoin`. Polygons stay
  coarse hand-authored art and are verified by `pnpm snap`.
- The ledger and `desktop-view` guide are updated; `map-prototype/README.md` is deleted with the directory.

## Save, resume and determinism

- Pending orders live in `pending-commands.json` beside the save (outside the save hash). After quit and resume the map
  shows the restored orders and the month applies them. Camera and selection are not saved.
- No authoritative change: projection additions are read-only functions of the immutable snapshot, ordered by id with
  `localeCompare` as today, with no clock, random or locale input. `CURRENT_COMPATIBILITY_VERSION` and every golden hash
  stay unchanged; any hash movement is a defect, not a re-pin.
- Presentation (measurement, locale, theme, density) never reaches a command: the payload is built from ids only.

## Accessibility

- Every function has a keyboard path (select, order, cancel, camera). The `application` region keeps its label,
  now naming the new keys. Focus is visible; focus moves to the status region message on rejection, and returns to the
  fleet afterwards.
- Never colour alone: ownership adds the nation tag on markers and rows; fleet markers use a glyph and a count; pending
  orders are dashed with a text label; blockades are hatched with a label; legal/illegal destinations use outline versus
  dim plus a list entry. The `sr-only` table gains each own fleet's order and each area's legal-destination state.
- The `highContrast` theme is honoured by the palette. A colour-vision palette preference does not exist and is not added.

## Measurement preset and localization

- Replace the scale bar's hard-coded `en-US` nautical miles with the presentation formatter for the `range`
  measurement category (preset, selections, locale), so the bar, route readout and tooltips follow preferences. The
  presentation-formatting baseline must not grow.
- All new strings go through `translate()` with complete en-US text. Names come from compiled content. A preference
  change re-renders text only and never changes the command payload or any hash (covered by the U-5 invariance suite).

## Required implementation order

1. Engine: filtered `buildWorldMapView`, `legalDestinations`/`blockedReason`, blockade rows, with unit tests.
2. Bridge: extend `inspectMap`/`inspectFleetScreen` schemas and contract types; boundary decode tests.
3. Renderer: shared `useMovementOrders`; Fleet migrated onto it with no behaviour change.
4. Fixture split and removal; no-fixture guard test.
5. Strategic Map screen, orders layer, pending/cancel/rejection UI, accessibility, formatter.
6. Registry, routes, sidebar, strings, click-depth row, delete `map-prototype`.
7. Ledger rows, `docs/reachability-report.md`, `desktop-view` guide, snapshots.

## Acceptance criteria and evidence

Unit:

- Filtered projection returns no foreign fleet for a viewer; tier table pinned per row.
- `legalDestinations` equals the set `fleetMoveProblem` accepts, and `blockedReason` reproduces its code and message,
  across land, same area, two hops, foreign station, no operational ship, rebuild.
- Shared `useMovementOrders` payload builder, drop-resolution (0038), pending-route model, tooltip gating by
  `tooltipDetail`, scale bar formatting per preset and locale.

Integration (production composition, only true external boundaries replaced):

- Map and Fleet submit the same `MoveFleet` body and `commandId`; replace and cancel behave identically; a rejected move
  queues nothing and shows the engine message; a stale revision refetches.
- No-fixture guard: the import graph of `StrategicMapScreen` and `WorldMapChart` contains no `fixture-world`; the built
  renderer bundle contains none of a list of fixture sentinel ids; no-session and bridge-failure render the empty and
  error states, never a world.
- Click-depth ledger test lists `strategic-map`; `released-screen-theme` and `feature-depth` tests no longer mention
  `map-prototype`.

Cross-process:

- Queue the same move through the Fleet payload and through the map payload in the production composition; the snapshot
  hash after `commitMonth` is identical and equals across two runs. The cross-process reference run and `golden/` are
  unchanged.

Screenshot (`pnpm snap`, evidence recorded in the report): default map; fleet picked up with legal and dimmed
destinations; pending order; rejection message; high-contrast theme; metric and imperial scale bar; empty and error
states; "not modelled" legend rows.

End to end (Playwright): open Map, drag an own fleet to a legal destination, see the pending route, quit and resume, see it
restored, advance the month, see the fleet at the destination; keyboard-only variant of the same flow; an illegal drop
changes nothing.

Gates: `pnpm preflight`, `pnpm test:scripts`, `pnpm check`, `pnpm check:reachability-ledger`. Ledger: `read-world-map`
gains the Map screen as its `renderer_screen` with an evidence test; `move-fleet` lists the Map screen; `docs/reachability-report.md`
regenerated with `node scripts/verify-reachability-ledger.mjs --write`.

## Out of scope

Passage rules, invasion range, intelligence levels, treaty-based visibility, new movement rules, multi-hop planning,
tactical map changes, new preferences, content authoring of polygons or anchors, changes to saves or wire formats.

## Stop conditions

- A golden or cross-process hash moves for any reason: stop (determinism cannot be shown).
- Implementing a gate, closure or visibility rule not in an approved decision request: stop and raise one.
- Any need to change `fleetMoveProblem` or the command schema: stop; that is a gameplay or compatibility change.

## Required delivery

Code and tests per the order above; report `.ai/reports/f-1-strategic-map.md` with exact commands and results; ledger and
report updated; `pnpm snap` evidence; Conventional Commits.

## Reassessment

Decision requests 0037 (fog of war), 0038 (drop-target granularity) and 0039 (scope split) are open, and #222 is blocked on
them as follows. Unblocked now and implementable against this spec: the dedicated screen and registration, the shared
`useMovementOrders` refactor, own-fleet selection, the legal-destination projection, pending/cancel/rejection UI,
fixture removal and the no-fixture guard, camera and accessibility work, scale-bar formatting, prototype deletion. Blocked:
the foreign-fleet layer and tooltips (0037), the drop flow of drag-to-move (0038) and the final F-1 row and legend (0039).
Verdict: #222 is not fully implementable; with the three recommendations approved it is, with no further spec work.
