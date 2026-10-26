# ADR-0304: Displayed numbers carry an explanation tree; gunnery accuracy is the first slice

## Status

Accepted (2026-10-25), amended 2026-10-26 by [#299](https://github.com/joaooliveira92/iron-tide/issues/299). Starts
[#265](https://github.com/joaooliveira92/iron-tide/issues/265) story 49 and the "Explainable" bar of `AGENTS.md`. Builds on
[ADR-0221](ADR-0221-structured-explanation-data.md). Does not complete the story: the coverage manifest and the per-area
tickets in `.ai/reports/story-49-explanation-inventory.md` track the rest.

## Decision

1. **Contract.** An explanation is the existing `ExplanationTree` of `@bluewave/events`: `formulaId`, `formulaVersion`,
   `inputs`, `intermediate`, `result`, `unit`, `operation`, `source`, `children`. It is built by `ExplanationBuilder`, which
   freezes it and rejects non-finite numbers. The domain emits the tree with canonical integers and stable ids; the
   presentation boundary turns it into text and numbers (ADR-0221), so the tree holds no prose and no locale.
2. **Operation and source.** A node may name what it does and where the rule comes from. `operation` is one of `identity`,
   `add`, `subtract`, `multiply`, `divide`, `round`, `clamp`. `source` is `{ kind, ref }` with `kind` one of `ruleset`,
   `content`, `manual`, `code`. Both are optional and additive: a tree written before this decision still decodes. The builder
   rejects an unknown operation and an empty source reference.
3. **Node identity and labels.** A node's `formulaId` is stable and dotted (`gunnery_accuracy`, `gunnery_accuracy.training`).
   A labelled node id is exactly `<formula>.<node>`. The renderer derives its message key as `<area>.<formula>.<node>` through
   one helper, so `gunnery_accuracy.crew` in the battle area reads `battle.gunnery_accuracy.crew`. A catalogue test fails when
   an id the engine can emit has no label, and the helper rejects an id that does not follow the convention.
4. **Order.** Children appear in the engine's canonical factor order, never in insertion or locale order. Every node of the
   accuracy tree is one multiplication of the base in basis points, with the floor recorded as an intermediate.
5. **Hidden information.** An explanation is attached only to the viewer's own side. The player-battle view carries
   `gunneryAccuracy` for the player's gunned ships and omits it for the enemy's, so it never reveals the enemy's crew, training
   or officer factors.
6. **First slice (gunnery accuracy).** `explainGunneryAccuracy` (`@bluewave/combat/gunnery`) calls the same `resolveAccuracy`
   that resolves fire, so the explanation cannot disagree with the result; only factors different from neutral become
   children. Every node names `operation: "multiply"` and the `gunnery_accuracy_v1` ruleset source. The player-battle view
   carries it as `PlayerBattleShipView.gunneryAccuracy` (additive, omitted when empty). The battle screen shows it in a native
   `<details>` disclosure listing the base, each modifier as a signed percentage change, and the final accuracy, with
   locale-aware percent formatting, and passes an automated axe audit.
7. **Coverage gate.** `scripts/data/explanation-coverage.json` lists each displayed view contract under coverage with its
   numeric and `ExplanationTree` fields, the covered formula per field, and a reason per exemption. The gate
   (`scripts/verify-explanation-coverage.mjs`, `pnpm check:explanation-coverage`) fails when a listed field has neither an
   explanation nor an exemption, when an entry is stale, or when the covered percentage falls below
   `minimumCoveredPercentBp`. Each area ticket adds its contract and removes exemptions as it explains numbers; the ratchet
   only moves up. The manifest replaces the one-time inventory as the machine-checked source of coverage.

## Not delivered (tracked, not hidden)

- Every area except the battle accuracy slice is exempt in the manifest with its tracking issue (#300–#306). The report lists
  the areas and their approximate field counts.
- The ship designer has partial `ExplanationText` findings (ADR-0221) and is tracked by #168; the debug-only screens are not
  player-facing and are not in the manifest.

## Compatibility

Additive and unhashed: the new tree fields and the new view field are not part of the session hash or any snapshot, replay or
save. The replays and golden hashes verify unchanged.
