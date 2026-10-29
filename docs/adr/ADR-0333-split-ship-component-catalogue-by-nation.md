# ADR-0333: Split the ship-component catalogue by family and nation, with per-record source provenance

Applies to: content, content-schema, ship-design

## Status

Superseded by: ADR-0346

Accepted (2026-10-29).

## Context

`ship-building/components.yaml` held 51 legacy components in 1674 lines: 39 guns of six navies and
four generations, three torpedo tubes and nine nation-neutral fittings. It was the only
single-collection file in the ship-building subtree; `parts/`, `armament/`, `naval-profiles/` and
`reference-designs/` are already split per record kind. Adding a nation or a later decade meant
growing the same file, and the file carried three unrelated reading audiences.

Provenance was pinned to that one file: `gunPartAdapter`, `fittingPartAdapter` and
`torpedoPartAdapter` hard-coded `"ship-building/components.yaml"` as the `origin.sourceFile` of every
derived part. Splitting the file would therefore have made the compiled artifact cite a path that no
longer exists, and any future re-split would need the same code edit again.

YAML anchors cannot solve the sharing problem here: `parseYamlSafe` caps aliases at 100 per file and
`schema: "core"` leaves merge keys (`<<`) as literal keys, which the strict decoders reject.

## Decision

1. **Layout.** `components/` is the authored catalogue, one file per family, and within a family one
   file per nation or technology generation: `guns/british-rml.yaml`,
   `guns/british-breech-loading.yaml`, `guns/british-quick-firing.yaml`, `guns/french.yaml`,
   `guns/german-krupp.yaml`, `guns/united-states.yaml`, `torpedo-tubes/british.yaml`,
   `torpedo-tubes/united-states.yaml` and `equipment.yaml`. Moving a component between files is a
   content move only.
2. **Declaration.** Every file is listed in `pack.json`'s `shipBuilding.shipComponents`. The existing
   fail-closed discovery (CAH-MAN-1/2) is unchanged: an undeclared or missing file is an error.
3. **Per-record provenance.** `validate` records `componentSources` (component id → authored file)
   from the same declaration. `compile` stamps it onto each shipped component as `sourceFile`, and
   the adapters use that value for the `origin` of a derived part instead of a module constant.
   `ComponentDef.sourceFile` is optional, so in-memory fixtures need not carry it, and
   `LEGACY_COMPONENT_SOURCE` (`ship-building/components`) is the fallback for a record without one.
4. **Wire format.** `ShipBuildingCatalogueSchema` decodes components with
   `ShipComponentWithSourceSchema` — `ShipComponentSchema` plus an optional `sourceFile`. The
   authored-file schema stays strict, so content YAML still cannot declare its own provenance path.
   The change is additive; `compatibilityVersion` is unchanged.

## Consequences

- The 51 components are byte-identical after the move; only `origin.sourceFile` values differ, and
  every one now names a file that exists.
- The content-lock hash moves (provenance is inside the ship-building body that the bundle hash
  covers) and `content-lock.json` was refreshed deliberately; `golden/hashes.json` did not move,
  because no authoritative outcome depends on a source path.
- A new nation or era costs one file and one manifest line, and needs no adapter change.
- `pnpm content:check` remains the single gate that proves the declaration and the tree agree.

## Alternatives rejected

- **Keep one file, split only by category.** Leaves three 100-600-line files and still mixes navies
  and generations; adding a nation keeps growing a shared file.
- **Hard-code the per-file path in each adapter.** Re-splitting would silently lie about provenance
  until someone remembered the code edit.
- **Share formulas through YAML anchors or merge keys.** Aliases are capped at 100 per file, and
  merge keys are not resolved under the `core` schema, so the strict decoders reject them.
- **Move the gun values into `armament/gun-families.yaml` now.** That is the eventual end state for
  duplicate gun formulas, but it changes the armament read path and needs a sourcing pass; this ADR
  is the layout it can land on.
