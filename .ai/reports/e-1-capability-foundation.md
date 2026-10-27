# E-1 capability foundation (#288-#291)

Date: 2026-10-26. Branch: `feat/e1-capability-foundation`. Scope: the unblocked slice of #283
under spec #249 — carry part capabilities into combat (#288), then add the radar, sonar/ASW and
AA/missile/hangar part families with their capability kinds (#289, #290, #291). No production part
uses a new family, so the content lock, goldens and replays are unchanged. One desktop production
snapshot pin moved because the reference design `majestic_like` carries `pumps_damage_control`: its
compiled hash now covers the capability and the first-month AI design study embeds the changed design.

## What landed

### #288 — compiled design capabilities reach combat

- `CompiledDesignVersion.capabilities` is optional and canonically ordered (kind, then canonical
  serialization). The ship-design compile stage collects it from every resolved part, and
  `toEngineDesign` / `buildDesignVersion` copy it into the campaign record.
- `TacticalShipUnit.capabilities` carries the list through battle projection. `buildDamageControlContexts`
  sums the `damage_control` effects (capped at 10,000 bp) and adds the bonus to the per-side training
  bonus before scaling pumping and firefighting; a unit without the capability keeps the previous
  resource values exactly.
- The save boundary decodes `designs` with `StorableCompiledDesignVersionSchema` (strict,
  `onExcessProperty: "error"`), including a closed capability union checked for kind order. Other
  nested design records stay `Unknown` because they already have compiled contracts.
- ADR: [ADR-0308](../../docs/adr/ADR-0308-e1-compiled-design-capabilities-reach-combat.md).

### #289-#291 — part families and capability kinds

- `content-schema` gains `radar`, `sonar`, `asw_weapon`, `aa_weapon`, `missile_launcher` and `hangar`
  families, their interfaces, and capability kinds `search_radar`, `fire_control_radar`,
  `sonar_detection`, `asw_attack`, `aa_engagement`, `missile_launch` and `aircraft_hangar`.
  Radar/sonar/ASW/AA levels are 1-3; missile classes are light/medium/heavy SSM, SAM and ASM.
- The ship-design catalogue maps each family to its designer category: `RADAR`, `SONAR`,
  `ASW_WEAPON`, `AA_WEAPON`, `MISSILE_LAUNCHER`, `AIRCRAFT_FACILITY`. `ASW_WEAPON` is added to the
  shared component-category vocabulary (29 -> 30) and sits in the armament "other" tab. Auxiliary
  loadout readers accept the new families.
- ADR: [ADR-0309](../../docs/adr/ADR-0309-e1-part-families-and-capability-kinds.md).

## Acceptance evidence

| Criterion                                                                      | Evidence                                                                                                                                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CompiledDesignVersion.capabilities` optional, ordered, strict at persistence  | `packages/persistence/test/design-capabilities-roundtrip.test.ts`; `StorableDesignCapabilitiesSchema`                                                                                       |
| A `damage_control` design gains pumping/firefighting; one without is unchanged | `packages/combat/test/battle-resolution/project.test.ts` ("carries design capabilities...")                                                                                                 |
| Compile copies and orders capabilities                                         | `packages/ship-design/test/compileProduction.test.ts`                                                                                                                                       |
| Save/load round trip                                                           | `packages/persistence/test/design-capabilities-roundtrip.test.ts`                                                                                                                           |
| New families decode strictly and reach the designer                            | `packages/content-schema/test/ship-parts-families.test.ts`, `packages/ship-design/test/partCatalogueView.test.ts`, `apps/desktop/src/renderer/screens/shipbuilding/design-sections.test.ts` |
| Category parity                                                                | `packages/ship-design/test/schemaCompat.test.ts`                                                                                                                                            |
| No hash movement                                                               | `pnpm check:golden` (11/11), `pnpm check:replay-corpus` (13/13), `pnpm content:verify`                                                                                                      |

## Validation

- `pnpm preflight`: 49/49 successful.
- Focused tests: content-schema 105, ship-design 50, combat 16, persistence 34, desktop 7.
- `pnpm check:golden`: all 11 hashes match.
- `pnpm check:replay-corpus`: 13 replays verified, identical across two fresh processes.
- `pnpm content:verify`: content lock verified, version 0.5.0, hash
  `adaf258f5937b366eb6c765b1478a688eb63081b5e2496baae8eb418491e0d89`.
- Desktop `commitMonth` production snapshot: re-pinned from `ad549b07…`/209361 to
  `a02b4659…`/210074 (rawHash `4d78a6e9…` to `3128b392…`), caused by the capability-bearing
  reference design `majestic_like`; all 11 goldens and all 13 replays are unchanged.
- Full `pnpm check`: green on `01e40912` (preflight 49/49, lint, typecheck, build, tests, heavy tests, goldens, determinism, replay corpus, reachability, explanation coverage, 28 desktop E2E).

## Open work and limits

- No production part uses a new family; the families are structural. Authored parts and values
  belong to the decade content tickets (#254, #256, #258).
- #292 (radar effect), #293 (SSM module), #295 (air groups), #296 (ASW combat) and the #278
  catalogue-technology tickets remain open and now have the seam they need (or, for #296, still
  wait on the W-2 submarine wiring assigned by ADR-0300).
- The capability list retains duplicate kinds (for example two pumps). Consumers choose sum or best
  explicitly; the schema only enforces the canonical kind order.
