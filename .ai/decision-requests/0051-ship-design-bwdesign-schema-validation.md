# Decision Request: Decode the bwdesign file with a strict schema

## Status

Blocked pending owner decision.

## Trigger

`packages/ship-design/src/persistence.ts` decodes the frozen `bwdesign` format with a hand-written validator (`validateDraftShape`, about 140 lines) and then asserts the type with `cur.draft as unknown as DesignDraft` and `raw as CompiledDesign`. The validator checks a subset of fields and accepts everything else, so unknown keys inside `hull`, `machinery` and `armour` are accepted today. Replacing it with a strict `Schema` rejects those files. That changes which files on a player's disk the application opens, on a frozen wire format (AGENTS.md stop condition: wire formats frozen, schema change needs a parity test).

## Evidence

- `packages/ship-design/src/persistence.ts:63` (`validateDraftShape`), `:240`, `:288`, `:359` (`JSON.parse`), `:263` and `:293` (the two casts).
- Effect audit #371, ranked item 1: "Decision + expand/contract".
- AGENTS.md "Schema and boundaries": decode with `{ onExcessProperty: "error" }`; no `JSON.parse(...) as T`.
- `packages/persistence/AGENTS.md`: save formats are frozen; schema changes need a parity test from existing fixtures.

## Why agent judgment is insufficient

Strict decoding is the repository rule, but applying it retroactively rejects any `bwdesign` file that carries an extra key. Whether such files exist in player data, and whether they should be refused, repaired or tolerated, is a compatibility and product outcome. Repair would also risk fabricating canonical design data.

## Options

### Option A: Strict schema with expand/contract

- Behavior: introduce `DesignFile` as a `Schema.Struct`, decode with `onExcessProperty: "error"`, delete the validator and both casts. First release logs files that the strict schema would refuse but still opens them (expand); a later release refuses them (contract).
- Advantages: reaches the repository rule without surprising players; the parity fixtures show exactly what changes.
- Risks: two releases; a temporary second decode path.
- Compatibility impact: none during expand; files with unknown keys are refused after contract.
- Migration impact: parity fixtures from every existing `bwdesign` file in `content/` and test fixtures.
- Scope and effort: large.

### Option B: Strict schema, refuse immediately

- Behavior: as A without the expand phase.
- Advantages: smallest code; one decode path.
- Risks: a player's saved design with an unknown key stops opening.
- Compatibility impact: breaking for such files.
- Migration impact: none provided.
- Scope and effort: medium.

### Option C: Keep the validator, remove only the casts

- Behavior: derive the types from the validator's shape and keep tolerant acceptance.
- Advantages: no acceptance change.
- Risks: leaves the duplicate validator and the lenient boundary the rule forbids.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: small.

## Recommendation

Option A. It satisfies the boundary rule and keeps existing designs openable until the parity fixtures show no file would be refused. Do not implement before approval.

## Work safely completed while blocked

None needed. No code touches `bwdesign` decoding.
