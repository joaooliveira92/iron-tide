# ADR-0306: Campaign projections may carry explanation trees; `@bluewave/events` moves to layer 4

## Status

Accepted (2026-10-26). Unblocks the area slices of [ADR-0304](ADR-0304-explanation-trees-for-displayed-numbers.md)
(economy, research, construction, fleet). Applies to the package graph gate in
`packages/cross-process-test/test/package-graph.test.ts`.

## Context

ADR-0304 requires the domain to emit the `ExplanationTree` of a displayed number next to the number itself. The
desktop readout projections live in `@bluewave/campaign-engine` (layer 5), and the tree contract lives in
`@bluewave/events` (also layer 5). The graph gate rejects equal-layer dependencies, so the projection could not
carry the tree without either duplicating the contract, enriching the view in the desktop main process, or
changing the layer.

Duplicating the tree type in `campaign-engine` would create two contracts that drift, and the coverage gate only
recognises the literal `ExplanationTree` field type. Enriching in `apps/desktop/src/main` would move the
explanation away from the calculation and force every renderer import to switch to a desktop-only view type.

`@bluewave/events` depends only on `@bluewave/contracts` and `@bluewave/deterministic`. No layer-4 package depends
on it, so lowering it introduces no cycle.

## Decision

1. `@bluewave/events` is a layer-4 package. Layer 4 already holds authoritative value packages (`campaign`,
   `content-codemod`, `test-support`); events is an authoritative contract package on the same foundation.
2. `@bluewave/campaign-engine` may depend on `@bluewave/events` and carry `ExplanationTree` fields on its readout
   projections. The tree is built from the same engine output the projection exposes, so a tree cannot disagree
   with the displayed value.
3. The graph rule stays strict: every dependency still points to a strictly lower layer. Moving events down is
   the only change; campaign-engine does not move and no equal-layer edge is introduced.
4. The trees remain view-only and unhashed. No wire format, save layout or authoritative hash changes.

## Alternatives rejected

- **Duplicate the tree interface in campaign-engine.** Two drifting contracts and a coverage gate blind to the
  duplicate.
- **Build trees in the desktop main process.** Leaves the calculation and the tree on different sides of a
  boundary and forces the renderer onto a second view type.
- **Raise campaign-engine to layer 6.** `ai`, `combat` and `messages` are layer 6 and depend on it, which would
  create equal-layer edges and break the graph.

## Compatibility

Additive. The existing `ExplanationTree` contract is unchanged. The only package-manifest change is the
`@bluewave/events` dependency in `@bluewave/campaign-engine`; the golden and replay gates verify that authoritative
output is unchanged.
