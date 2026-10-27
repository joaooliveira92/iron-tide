# Acceptance report: ship-designer in-era parity (#168)

Status: **accepted** on `feat/worktree-registry` (2026-10-26), against the spec in
[#168](https://github.com/joaooliveira92/iron-tide/issues/168), ADR-0232 and ADR-0233. This is an
acceptance pass, not a new implementation: every slice named in the spec is already on `dev`, and
this report maps each user story to its evidence.

## Evidence

| Check                                                                                | Result                                                                                    |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `pnpm --filter @bluewave/ship-design test`                                           | 94 files, 1499 tests passed                                                               |
| `pnpm --filter @bluewave/desktop exec vp test run src/renderer/screens/shipbuilding` | 27 files, 182 tests passed                                                                |
| Full `heavy pnpm check` on `f967f3a0`                                                | 49/49 steps green, including goldens, determinism, replay corpus, reachability and 28 e2e |
| Golden hashes                                                                        | unchanged (no new authoritative outcome)                                                  |

The acceptance pass found no missing slice. It also confirmed the deliberate gap recorded in
`docs/research/rtw-designer-parity-values.md`: the per-calibre gun-quality readout reports the neutral
value because no research source assigns a quality bonus yet.

## User-story coverage

### Armour regions (stories 1-7)

| Story                                                                                                      | Evidence                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 2, 3, 4, 5, 6: nine manual fields B/BU/BE/D/DE/T/TT/SEC/CT, T carries turret+barbette, DE/TT/SEC labels | `packages/ship-design/test/armour.test.ts` (new regions, weights, reduced-penetration set), `partBoundary.test.ts`, `schemaCompat.test.ts`     |
| 7: underwater/magazine surfaces keep working                                                               | `armour.test.ts` (scheme transformations keep `MAGAZINE_BOX`, `TORPEDO_BULKHEAD`, `SPLINTER_PLATING`, `TORPEDO_BELT`), `armourSchemes.test.ts` |

### Armour schemes (stories 8-12)

| Story                                                                       | Evidence                                                                                                                                      |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 8-10: named schemes, locked later schemes, diagrams                         | `armourSchemes.test.ts`, `apps/desktop/src/renderer/screens/shipbuilding/protection-view.test.ts`, `components/ArmourSchemeSelector.test.tsx` |
| 11-12: manual edit flips to Custom; scheme application is one undoable edit | `armourSchemes.test.ts` (manual edits clear `schemeId`, undo restores)                                                                        |

### Machinery, freeboard and gunnery (stories 13-21)

| Story                                                                   | Evidence                                                                                            |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 13-15: engine-priority axis, balanced default, shown trade              | `packages/ship-design/test/machinery.test.ts`, `compile.test.ts`, `apps/.../machinery-view.test.ts` |
| 16-17: low/normal freeboard and reserve-buoyancy warning                | `packages/ship-design/test/hull.test.ts`, `stability.test.ts`, `compile.test.ts`                    |
| 18-19: per-calibre gun-quality readout, read-only, neutral value stated | `apps/.../components/design-workspace/panels/gun-quality.test.ts`, `systems-view.test.ts`           |
| 20-21: fire-control positions and directors-without-positions warning   | `packages/ship-design/test/systems.test.ts`, `compile.test.ts`                                      |

### Batteries, display and asymmetry (stories 22-26)

| Story                                                                       | Evidence                                                                                                                                         |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 22-23: tertiary battery count, no fire-arc/role concept                     | `packages/ship-design/test/tertiary.test.ts`, `compile.test.ts`, `batteries.test.ts`                                                             |
| 24: power in kW and horsepower                                              | `apps/.../machinery-view.test.ts` (`formatPowerBoth`)                                                                                            |
| 25-26: independent port/starboard mounts and a visible asymmetry indication | `packages/ship-design/test/armamentCompile.test.ts`, `armamentPersistence.test.ts`, `apps/.../armament.test.ts`, `components/ArmamentEditor.tsx` |

### Persistence, content and boundaries (stories 27-35)

| Story                                                    | Evidence                                                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 27-28: old designs open; barbette merges into turret     | `packages/ship-design/test/persistence.test.ts` (v1 -> v2 migration, merge rule, deterministic re-migration)      |
| 29: armour weight and margin readouts with new regions   | `armour.test.ts`, `protection-view.test.ts`                                                                       |
| 30: ineffective-critical-armour finding                  | `armour.test.ts` (`ARMOUR_INEFFECTIVE_VS_ADVERSARY` set)                                                          |
| 31: new magnitudes are design choices, not sourced facts | `docs/research/rtw-designer-parity-values.md`, ADR-0232/ADR-0233 provenance tables                                |
| 32: 1880 reference designs carry the parity model        | `historicalStarters.test.ts`, `references1880.test.ts`, `content/production/1880/ship-building/reference-designs` |
| 33: content-schema mirror stays identical                | `armamentVocabularyParity.test.ts`, `schemaCompat.test.ts`                                                        |
| 34: combat armour zones align with the new regions       | `packages/combat/test/damage/armor-model.test.ts`, `hit-location.test.ts`                                         |
| 35: draft-schema v2 with forward-only migration          | `persistence.test.ts` (schema version 2, v1 migration, newer-schema refusal)                                      |

## Follow-ups, not gaps in this spec

- [#190](https://github.com/joaooliveira92/iron-tide/issues/190) covers increased gun elevation,
  cross-deck fire, gun shields and casemate-vs-turret choices; it remains `needs-info` because the
  owner decision on the in-era gun option set is unsettled.
- Per-calibre gun quality stays neutral until a research source assigns values; the readout says so
  rather than implying an unsourced bonus.
