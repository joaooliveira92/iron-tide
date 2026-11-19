# Decision Request: battle terrain source and battle placement

## Status

Blocked pending owner decision. The plumbing is shipped; the terrain input stays unsupplied in production.

## Trigger

#959 asks `resolve` and the player session to receive a battle terrain source. `ResolveBattleAutoInput` and `CreatePlayerBattleInput` now take an optional `terrain` (`TerrainView`), but nothing in production can build one.

## Evidence

- No runtime loader reads the sidecar `terrain-artifact.json` (`buildTerrainArtifact` in `@bluewave/content-compiler` only writes it).
- Battles start in `DEFAULT_AREA_BBOX` from the manifest; no battle position is tied to a map area, so any terrain polygon would be placed by guesswork.
- Supplying terrain moves battle outcomes (`TERRAIN_BLOCKED` records, steering clear of land), so goldens that fight near terrain would move.

## Why agent judgment is insufficient

Choosing which map area a battle occupies, and how the artifact reaches the engine, changes authoritative gameplay and the content pipeline. Inventing a placement would fabricate canonical information.

## Options

### Option A: Place each battle from its campaign area

- Behavior: the manifest carries an area anchor; a loader reads the artifact and clips `TerrainView` to the battle box.
- Advantages: real coasts matter in real areas.
- Risks: needs a loader, an anchor field and a manifest version.
- Compatibility impact: manifest and compat bump, golden moves with approvals.
- Migration impact: older manifests get no terrain.
- Scope and effort: large; its own issue.

### Option B: Keep battles in open sea

- Behavior: terrain stays unsupplied; only hull collision is active once content authors hull data.
- Advantages: no further golden moves.
- Risks: coasts never matter.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

## Recommendation

Option A as a follow-up issue; ship the optional inputs now (done).
