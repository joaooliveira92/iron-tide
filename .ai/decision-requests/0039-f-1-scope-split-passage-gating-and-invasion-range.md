# Decision Request: F-1 scope: route gating (Suez, Panama), blockade effects and invasion range

## Status

Blocked pending owner decision. The spec (`.ai/briefs/f-1-strategic-map.md`) proceeds on the recommendation but the F-1
row in `.ai/SPRINT-PLAN.md` cannot be narrowed without the owner.

## Trigger

The F-1 row and issue #222 list "Suez and Panama gating", "blockade and presence overlays" and "invasion range". None has
an authoritative rule or data in the repository that a map can draw truthfully.

## Evidence

- Movement (`packages/campaign/src/movement.ts`) knows no passage, canal, strait or closure concept. Suez is only the
  ordinary sea routes `r_med_eg`, `r_suez_canal` and `r_redsea_adden` (`content/production/1880/routes.yaml`). Panama is
  absent from the production routes and areas; the 1880 start predates the canal.
- The "passages" (`passage_suez`, `passage_panama`, open/closed flags, notes such as "1888 Convention" and "Opens 1914")
  exist only in the prototype fixture (`components/world-map/fixture-world.ts`), which states that nothing in it is
  canonical.
- `BlockadeState` exists in the snapshot (`blockaderId`, `blockadedNationId`, `areaId`, `establishedMonth`) and
  `DeclareBlockade` is applied, but no movement, presence or other rule reads it except the S-5 exemption.
- Invasion range is a W-5 deliverable (depends on W-1, T-1): "invasion range in nautical miles from a friendly port"
  (manual pp.74-76). No engine query or ruleset value exists.
- Presence values were decided by ADR-0266 but the production section is not authored (ticket #85 open), so the readout
  is `{ configured: false }`.

## Why agent judgment is insufficient

Drawing a gate as closed while the engine accepts the move (or the reverse) misinforms the player; adding a rule changes
authoritative outcomes, content and compatibility; drawing an invasion radius invents W-5's number and semantics.

## Options

### Option A: Defer gating and invasion range; ship blockade and presence as read-only overlays (recommended)

- Behavior: F-1 draws no passage gates and no invasion range, and states "Passage rules and invasion range are not
  modelled yet" in the map legend (the repo's explicit "not modelled" pattern). Blockades the player is party to are drawn
  from the snapshot; presence is drawn when `configured: true`. The F-1 row is amended to name Suez/Panama gating and
  invasion range as deferred to W-5 and a future passage-rules item.
- Advantages: truthful; no engine change; shippable now.
- Risks: two of the row's five phrases move out; owner must accept.
- Compatibility impact: none. Scope: as in the spec.

### Option B: Build passage rules inside F-1

- Behavior: add authored passages (open date, controller, transit policy) to content, enforce them in `fleetMoveProblem`,
  draw them.
- Risks: new gameplay policy needing its own decision (who may transit in war, Suez 1888 convention, closure by
  blockade); engine, compiler and content change; compatibility bump and golden re-pin. Scope: large.

### Option C: Hold F-1 until W-5

- Advantages: F-1 delivered whole. Risks: the production map screen waits behind an unbuilt capability. Scope: delay.

## Recommendation

Option A, with passage rules chartered separately if the owner wants them. Do not draw closed gates or an invasion radius
from fixture data.

## Work safely completed while blocked

The spec defines the legend copy, the blockade and presence overlay contracts, and the reserved extension points
(projection fields that W-5 and a future passage item can fill).
