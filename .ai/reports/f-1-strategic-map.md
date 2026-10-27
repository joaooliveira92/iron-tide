# F-1 strategic map: acceptance report

Spec #231 (#222, epic #220). Branch `feat/f1-strategic-map`. Evidence is from the
worktree at the commits named below, on top of `dev` `dfa2bd35`.

## Delivered

The engine projection, the bridge field and the shared movement-orders hook had already
landed on `dev` (`ef81eda5`, `18de3c94`, `f5b2d3c1`). This batch finished the renderer:
the fixture world is gone, the Map screen is registered, and it orders fleets through the
same payload builder as the Fleet screen.

1. **Fixture split.** `fixture-world.ts` (1,298 lines) is deleted. `map-geometry.ts` keeps
   only presentation geometry: area ids, rings, labels, tiles and climate. Nations,
   possessions, fleets, passages, the fixture control ramp and the fixture BFS are gone.
   `campaignWorldMapSource` reads compiled campaign state only; an area the campaign does
   not mention renders as "no campaign data".
2. **No fixture in the bundle.** `scripts/check-renderer-bundle.mjs` fails a production
   build that contains `fleet_asiatic`, `passage_gibraltar`, `passage_suez` or
   `fleet_hochseeflotte`. `world-map-no-fixture.test.ts` walks the import graph from the
   chart, the Map screen and the F1 sheet and fails on any fixture module or collection.
3. **Route reading from campaign lanes.** The shift-click ruler now reads the campaign's
   own sea lanes; `readRoute(state, lanes)` has no fixture graph. The passage layer, the
   "avoiding closures" toggle and the closed-strait styling are removed with the fixture
   (DR-0039: no passage rule exists and Panama is not in the pack).
4. **Map screen.** `screens/strategic-map/StrategicMapScreen.tsx` is registered always as
   `strategic-map` ("Map"), one click from the bottom navigation, in the Operations
   section and the click-depth ledger. `screens/map-prototype`, its routes, strings and
   test exclusions are deleted.
5. **Orders.** `screens/strategic-map/useStrategicMapScreen.ts` joins the viewer-scoped
   `inspectMap.strategic` projection (own fleets, legal destinations, blocked reason,
   blockades the player is party to) with `inspectFleetScreen` (revision, queued
   movement commands, presence). It sends through the shared `useMovementOrders` hook:
   - drag an own fleet marker onto a legal polygon, or pick a destination in the panel;
   - one campaign area behind the polygon orders immediately, several open a keyboard
     list (DR-0038 Option A);
   - a second order for the same fleet replaces the pending one;
   - cancel from the panel;
   - a rejection shows the engine's own code and message verbatim in `role="alert"`; the
     Fleet workflow reloads on a stale revision;
   - a blocked fleet shows the engine's reason and never lifts.
6. **Map feedback.** Pending orders draw a dashed route with an arrow and the text
   "Ordered: sails for …". While a fleet is selected the legal polygons take the selection
   outline and every other polygon dims. Blockaded areas the player is party to take a
   dashed outline and a panel row. The legend states "Foreign fleet positions are not
   known: intelligence is not modelled yet" and "Invasion range is not modelled yet".
   `F` cycles own fleets, `Escape` clears; every order has a keyboard path in the panel.
7. **Presence and blockade readouts** come from the projection, never from a constant:
   presence rows give required/present/shortfall tonnes per area, and "Presence: not
   configured" when the section is absent; blockade rows name blockader, blockaded nation
   and area.
8. **Layout stability.** The chart and the orders panel have independent fixed heights.
   Selecting a fleet no longer resizes the chart mid-drag (found by the Playwright drag:
   the panel grew, the SVG rescaled and the drop landed on another polygon). The camera
   also holds position while a fleet is picked up.

## Validation

- `pnpm preflight` — 53/53 tasks, content gate 0.5.0, codemod determinism byte-identical.
- `pnpm format`, `pnpm lint`, `pnpm lint:effect` — clean (effect warnings pre-existing in
  packages, none in the changed files).
- `pnpm --filter @bluewave/desktop typecheck` — clean.
- Desktop unit suite (`pnpm --filter @bluewave/desktop test`) — 3,062 tests, 3,061 pass,
  1 skipped (pre-existing heavy skip). New: map orders, hit test, no-fixture guard,
  orders panel, screen, geometry/lane/route rewrites.
- Playwright `e2e/strategic-map.spec.ts` — 5/5: reads the campaign and states the not-modelled
  rows, orders from the panel and sails one hop on month advance, keyboard-only flow,
  drag to a legal polygon queues the order, drag to an illegal polygon queues nothing.
- `pnpm check:golden` — 11/11 hashes match. `pnpm check:replay-corpus` — 13/13 identical
  across two fresh processes. No compatibility version change.
- `pnpm check:reachability-ledger` — 35 reachable, 10 dormant, 14 internal; report
  regenerated. `read-world-map` and `move-fleet` now name the Map screen.
- `pnpm snap` (`.dev-data/view`): `map-default.png`, `map-fleet-selected.png`,
  `map-order-pending.png`. The pending screenshot shows the panel, the legal destinations,
  the order and the "Ordered: sails for English Channel" row.

## Deviations and open observations

- **Scale bar unit.** `formatNauticalMiles` formats through the presentation formatter
  (locale and number scale) but keeps `nm`. The `range` display units are yards and
  kilometres; using them for a chart scale would read worse for the sea domain. The
  original defect (hard-coded `en-US`) is gone.
- **Presence and blockade overlays** ship as panel readouts plus a dashed polygon outline,
  not as fill hatching with a layer toggle. No value is invented; the production presence
  section is configured and its figures are shown.
- **Area hit testing.** A drop resolves through `elementsFromPoint`, with a geometry
  fallback (`map-hit-test.ts`) when the DOM has no polygon under the cursor. Overlapping
  polygons resolve to the one drawn on top.
- **Not implemented by decision.** Passage gating, invasion range, treaty visibility,
  foreign-fleet intelligence, multi-hop planning. `F-1` owns the slots; W-3/W-5 own the
  rules and values.
