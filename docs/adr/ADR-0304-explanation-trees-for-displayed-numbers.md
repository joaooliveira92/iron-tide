# ADR-0304: Displayed numbers carry an explanation tree; gunnery accuracy is the first slice

## Status

Accepted (2026-10-25). Starts [#265](https://github.com/joaooliveira92/iron-tide/issues/265) story 49 and the "Explainable" bar of
`AGENTS.md`. Builds on [ADR-0221](ADR-0221-structured-explanation-data.md). Does not complete the story: see the inventory in
`.ai/reports/story-49-explanation-inventory.md`.

## Decision

1. **Contract.** An explanation is the existing `ExplanationTree` of `@bluewave/events`: `formulaId`, `formulaVersion`, `inputs`,
   `intermediate`, `result`, `unit`, `children`. It is built by `ExplanationBuilder`, which freezes it and rejects non-finite numbers.
   The domain emits the tree with canonical integers and stable ids; the presentation boundary turns it into text and numbers
   (ADR-0221), so the tree holds no prose and no locale.
2. **Node identity and labels.** A node's `formulaId` is stable and dotted (`gunnery_accuracy`, `gunnery_accuracy.training`). The
   renderer finds a label by the message key `battle.accuracy.factor.<last segment>`, so a locale catalogue can translate it, and a
   test fails when an id the engine can emit has no label.
3. **Order and operation.** Children appear in the engine's canonical factor order, never in insertion or locale order. Every node of
   the accuracy tree is one multiplication of the base in basis points; a future node type that is not a product needs an explicit
   `operation` field, which is a tracked gap (below) rather than an implied convention.
4. **Hidden information.** An explanation is attached only to the viewer's own side. The player-battle view carries
   `gunneryAccuracy` for the player's gunned ships and omits it for the enemy's, so it never reveals the enemy's crew, training or
   officer factors.
5. **First slice (gunnery accuracy).** `explainGunneryAccuracy` (`@bluewave/combat/gunnery`) calls the same `resolveAccuracy` that
   resolves fire, so the explanation cannot disagree with the result; only factors different from neutral become children. The
   player-battle view carries it as `PlayerBattleShipView.gunneryAccuracy` (additive, omitted when empty). The battle screen shows it
   in a native `<details>` disclosure listing the base, each modifier as a signed percentage change, and the final accuracy, with
   locale-aware percent formatting, and passes an automated axe audit.

## Not delivered (tracked, not hidden)

- The tree has no `operation` field and no explicit source reference beyond `formulaVersion`. Adding them is a contract ticket that the
  other tickets depend on.
- No coverage gate yet measures which displayed numbers have a tree. The inventory is a one-time audit.
- Every other displayed number is unexplained or only broken down, listed by area in the inventory with a child ticket each.

## Compatibility

Additive and unhashed: the new view field is not part of the session hash or any snapshot, replay or save. The 13 replays and all 11
golden hashes verify unchanged.
