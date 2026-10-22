# Decision Request: F-1 strategic map has no spec or brief; production scope unclear

## Status

Resolved (2026-10-22) by the owner: **Option A**. The F-1 spec is [.ai/briefs/f-1-strategic-map.md](../briefs/f-1-strategic-map.md).
It raised three narrower requests, which gate #222 until decided:
[0037](0037-f-1-fog-of-war-information-tiers.md),
[0038](0038-f-1-map-destination-granularity.md) and
[0039](0039-f-1-scope-split-passage-gating-and-invasion-range.md).
Note: the Evidence below predates ADR-0266, which resolved 0017-0023 and 0026; only the production authoring (#85) is open.

## Trigger

Issue #222 promotes the map prototype to a production screen and overlaps roadmap
item F-1. F-1 has no spec, brief, wayfinder map or ticket set. Its prerequisites
are only partly production-real, and a production map surface already exists in
part, so "promote the prototype" has more than one reading.

## Evidence

- `.ai/SPRINT-PLAN.md` F-1 row (depends on S-5, U-4): "pan/zoom, fog-of-war
  tooltips, drag-to-move, Suez and Panama gating, invasion range". There is no
  `.ai/briefs/f-1-*`, no `.scratch/f-1-*`, and no GitHub `Spec: F-1` issue (S-5 had
  spec #73, T-1 had #109). Ticket 06 (`.scratch/bluewave-milestone-6`) is absent.
- U-4 is done. S-5 is done "under fixture values only": the production `presence`
  section is dormant (decisions 0017-0023, 0026 open), so presence overlays have no
  production data.
- Invasion range belongs to W-5 (not built); no engine query exists for it.
- `components/world-map/*` (WorldMapChart, WorldMapPanel, camera, minimap, strategic
  layers, `campaign-map-join`) is already production and reads the compiled
  campaign via `inspectMap`/`buildWorldMapView`; ledger row `read-world-map` is
  `reachable`. Only `screens/map-prototype` (dev-only, fixture world) is
  unregistered. Pan/zoom already exists in `useMapCamera`.
- `fixture-world.ts` is still imported by production-adjacent code paths (to be
  confirmed in a spec).
- Ledger row `move-fleet` is reachable from the Fleet screen; drag-to-move needs a
  rule for illegal drops, one hop per month, and which fleets can be dragged.

## Why agent judgment is insufficient

Scope changes what ships: a new dedicated "Map" campaign screen vs. promoting the
existing panel; whether invasion range (W-5) and presence overlays (dormant data)
are in or out; fog-of-war rules (what the player may know) are a gameplay and
intelligence rule (W-3) not defined anywhere. Drag-to-move semantics affect
authoritative commands and replay hashes if they differ from the Fleet path.
AGENTS.md requires a spec and brief before implementing a milestone, and says to
stop when two plausible interpretations change gameplay.

## Options

### Option A: Write the F-1 spec first (recommended)

- Behavior: run the spec step (wayfinder map and `Spec: F-1` issue), settling
  fog-of-war, drag legality, overlays and what is deferred, then implement.
- Advantages: matches the pipeline; ticketed, testable scope.
- Risks: delays #222.
- Compatibility impact: none until implementation.
- Scope: small spec, then M implementation.

### Option B: Owner approves a reduced scope now, no spec

- Behavior: register one dedicated Map screen reusing `components/world-map`,
  delete `map-prototype` and the fixture world from production bundles; drag-to-move
  dispatches the existing `submitMovementCommand` (identical envelope and hash);
  Suez/Panama gating and blockade overlays from `buildWorldMapView`; presence and
  invasion range explicitly deferred (dormant data, W-5); fog-of-war limited to
  what the projection already exposes.
- Advantages: delivers the issue's four acceptance criteria.
- Risks: deviates from the F-1 row until the sprint plan is amended.
- Compatibility impact: none (same command path).
- Scope: medium.

### Option C: Full F-1 including invasion range and presence

- Behavior: as the F-1 row reads.
- Risks: blocked by W-5 and by the dormant presence values; expands into deferred
  subsystems.
- Scope: large.

## Recommendation

Option A, or Option B if the owner records that reduced scope (and amends the F-1
row). Do not implement before approval.

## Work safely completed while blocked

Read-only verification of prerequisites, ledger rows and the existing world-map
components. No code changed.
