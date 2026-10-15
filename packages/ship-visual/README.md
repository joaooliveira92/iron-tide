# @bluewave/ship-visual

Pure, presentation-only ship visual parts (ADR-0148): the `VisualEra` / `NationStyle` /
`SizeBand` / `MountClass` vocabulary, the generated part catalog, the key resolver with its
fallback chain, and pure placement maths. No runtime dependencies and no `effect` import; only
the desktop renderer depends on it, and nothing it produces enters authoritative state.

- **Catalog source:** [`content/ship-visual/parts.yaml`](../../content/ship-visual/parts.yaml),
  validated by `ShipVisualCatalogSchema` in `@bluewave/content-schema`.
- **Regenerate** after editing the YAML: `pnpm --filter @bluewave/content-schema build &&
  pnpm --filter @bluewave/ship-visual catalog:generate`. `test/catalog-sync.test.ts` fails on drift.
- **Spec:** `.scratch/ship-visualization/spec.md`.
