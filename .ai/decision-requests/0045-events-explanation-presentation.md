# Decision Request: Move battle explanation rendering out of the authoritative events package

## Status

Blocked pending owner decision.

## Trigger

ADR-0221 says no authoritative package owns presentation text: the domain emits structured explanation data and
the presentation boundary renders it. `packages/events/src/format.ts` still turns an `ExplanationTree` into a
multi-line display string (`formulaId vVersion = result unit`, `inputs:`, `intermediate:`), and
`packages/combat/src/battleResolution/resolver.ts:130` stores that string in `BattleResult.explanation`. That field
is persisted and included in the campaign snapshot hash. Moving the renderer therefore changes a frozen persisted
channel, which needs an owner decision rather than an implementation choice.

## Evidence

- **The leak.** `packages/events/src/format.ts` is the only authoritative formatter left after the ADR-0221 sweep. It
  renders labels, units and line layout with `String(...)` (deterministic, so not a locale bug), and
  `resolver.ts:11-12,130` is its only production consumer in the engine.
- **The channel.** `BattleResult.explanation: string[]` is declared at `packages/campaign/src/state.ts:176`. The store
  decodes `wars.battles` as `Schema.Array(Schema.Unknown)` (`packages/persistence/src/schemas.ts:91`), and
  `hashableCampaignSnapshot` spreads `wars` into the semantic hash (`packages/campaign/src/snapshotHash.ts:24-30`).
  The string is therefore persisted, hashed and save-loaded, not a transient view value.
- **Three producers.** Besides the resolver's formatted tree, `packages/phase-engine/src/battles.ts:303` writes
  `auto-resolved (...) after N battle minutes` and `packages/phase-engine/src/interruption.ts:282` writes
  `player-resolved`. A structured replacement has to represent literal facts as well as trees.
- **Consumers.** 25 battle-specific files reference `explanation`: the resolver, phase-engine producers and tests,
  `campaign-engine` turn summaries (`src/simulation.ts:51`), cross-process acceptance
  (`src/t2-acceptance.ts:53,230`), compiler-cli fixtures, and the desktop views
  (`BattleOutcomeRow.tsx:48-50`, `TurnReportTab.test.tsx`). The unrelated ship-design `explanation` field is not part
  of this count.
- **Artifacts today.** No file under `golden/replays/` contains `"resolved"` or `explanation`, and
  `golden/hashes.json` carries only `battleGenerationHash`, so no current reference hash moves. A future replay
  checkpoint that resolves a battle would move under any shape change (ADR-0279 approvals).
- **Compatibility rules.** ADR-0264 (with ADR-0231) allows additive optional fields without a compatibility bump and
  requires a bump or a refusal path when an existing field becomes required or is reinterpreted. ADR-0265 confirms
  event wire changes are refused, not defaulted, and applies the same discipline.

## Why agent judgment is insufficient

The options produce materially different authoritative outcomes:

- an explicit exception to ADR-0221 versus a real move of presentation ownership;
- a save-shape change that needs a compatibility decision (bump, legacy union, or refusal) versus an additive field;
- moving hashes and needing replay approvals versus no artifact movement;
- whether the old rendered strings remain the player-visible battle history.

Choosing without the owner would either weaken a standing ADR or silently reinterpret persisted state.

## Options

### Option A: Keep the formatter and record a scope exception

- **Behavior:** `events/format.ts` stays; amend ADR-0221 to allow deterministic tree rendering in `events` until a
  presentation home owns battle history.
- **Advantages:** no save, hash, UI or test change; no migration; no replay approvals.
- **Risks:** an authoritative package keeps owning labels, units and layout; locale-aware rendering cannot move
  independently later; ADR-0221's invariant is weakened by exception.
- **Compatibility impact:** none. **Migration impact:** none. **Scope and effort:** one ADR amendment.

### Option B: Structured-only replacement

- **Behavior:** `BattleResult.explanation` becomes structured (for example `ExplanationTree[]` plus literal nodes for
  the auto- and player-resolved paths); `formatExplanation` moves to the presentation home; no authoritative package
  renders display text.
- **Advantages:** satisfies ADR-0221 completely; the UI renders the tree with locale-aware formatting; persisted state
  keeps the derivation rather than a pre-rendered string.
- **Risks:** a persisted, hashed shape becomes required in a new form; older saves with resolved battles hold
  `string[]` that cannot be converted back into a tree without fabricating structure; a compatibility bump or a
  permanent legacy branch is unavoidable.
- **Compatibility impact:** a bump (older saves refused) or a decode-time legacy branch; new saves differ from old
  readers' expectations. **Migration impact:** none possible for the tree; old strings must be preserved as literal
  nodes if a legacy branch is chosen. **Scope and effort:** large (25 files across six packages plus the desktop).

### Option C: Additive structured channel with a legacy string fallback

- **Behavior:** keep `explanation: string[]` as the legacy, read-only channel; add an optional structured field to
  `BattleResult` (for example `explanationTree?: ExplanationTree`, or a small node union covering literal facts).
  Producers write the structured value, stop rendering the tree into a string, and delete `events/format.ts`; the
  presentation boundary renders the tree and falls back to the legacy strings for old saves.
- **Advantages:** satisfies ADR-0221 for new state; every legacy save loads and displays unchanged; no fabricated
  data; no compatibility bump under ADR-0264/ADR-0231; the renderer lives in one presentation home.
- **Risks:** two representations coexist until the legacy field is retired; new resolved-battle snapshots gain a
  hashed field, so any future replay checkpoint that resolves a battle needs an approval entry (ADR-0279); the legacy
  field's write policy must be explicit to avoid long-term duplication.
- **Compatibility impact:** additive optional field, so old saves load unchanged and an old reader that preserves
  unknown battle data still re-hashes consistently; no bump. **Migration impact:** none. **Scope and effort:** medium
  (roughly 10-15 production files plus tests; the 25 references above).

## Recommendation

Option C. It removes the presentation leak from `events` without breaking any save, keeps the existing player-visible
history readable, and confines the compatibility risk to an optional hashed field that ADR-0264 already covers. Do not
implement the disputed behavior before approval; in particular, do not change `BattleResult.explanation`, delete
`formatExplanation`, or touch replay approvals until this decision is accepted.

## Work safely completed while blocked

The events schema-ownership refactor (schemas derive the body types) and the parser-boundary freeze are complete and
verified; neither touches `formatExplanation`, `BattleResult`, persistence or replay artifacts. The authoritative
events package no longer depends on `campaign` or `diagnostics`, so the remaining direction of this decision is not
blocked by a package cycle.
