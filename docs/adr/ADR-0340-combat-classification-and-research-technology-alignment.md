# ADR-0340: Combat classification & research technology alignment

Consolidates: ADR-0228, ADR-0310, ADR-0315

Applies to: content, combat, ship-design, phase-engine, campaign, desktop

Rule: The combat ship-type classifier, catalogue technology ids and research screen projection each align engine or UI behaviour to authored scenario content without changing save or wire formats.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0228
Supersedes: ADR-0310
Supersedes: ADR-0315
Consistent with: ADR-0339
Consistent with: ADR-0348
Consistent with: ADR-0350

## Context

Three disjoint gaps prevented the engine and UI from reflecting authored scenario content. The combat ship-type classifier (`packages/combat/src/tactical/shipType.ts`) used modern boundaries (≥5 000 000 kg, ≥6 in belt, ≥6 in gun, <20 kn) that excluded seven 1880 ironclad designs from tactical promotion, because `CompiledDesignVersion` carried no ruleset pointer for the guard to read the scenario ruleset at runtime (ADR-0228). The research phase had no catalogue entry for five engine technology constants (`modern_jet_carrier_operations`, `controlled_mine_technology`, `minelaying_submarine_technology`, `missile_submarine_technology`, and the four aviation ids in `hasAviationTech`), so researching an authored technology changed nothing (ADR-0310). The research screen showed budget and 15 field weights but projected points over all 15 fields regardless of eligibility and displayed nothing the engine actually does with the inputs (ADR-0315). Each resolution aligns a consumer — combat engine, phase engine, desktop renderer — to authored content without altering authoritative data models.

## Rules

### 1. Combat ship-type classifier (1880 ruleset v2)

1. The classifier version is bumped from `ship_type_classifier_v1` to `ship_type_classifier_v2`.
2. The four opening-era armoured families (`monitor`, `coast_defence_ship`, `central_battery_ship`, `ironclad_turret_ship`) use the v2 opening band: `minDisplacementKg` 1 500 000, `minArmorUm` 4 in (101 600 µm), `minCaliberUm` 6 in (152 400 µm), `maxSpeedUms` 18 kn (9 259 992 µm·s⁻¹).
3. The modern `pre_dreadnought` band stays at v1 (5 000 000 kg / 6 in / 6 in / 20 kn).
4. The design-side classification ruleset (ADR-0116, `DESIGN_22_EARLY`) remains the content authority; the guard mirrors the fields the compiled design exposes.

### 2. Catalogue technology ids for engine constants

1. One catalogue technology is authored per missing engine constant id, dated from the historical-analogue policy and marked `BALANCE_TARGET`.
2. Engine constants move to the authored ids per the mapping in ADR-0310.
3. Costs and discovery weights are copied from the nearest existing technology in the same field and named in each entry's provenance note; no value is invented without a stated derivation.
4. Aircraft development starts from research: `hasAviationTech` reads the single authored id (`av_early_aviation`, 1912) so the monthly aircraft phase can begin for a nation that discovers it.

### 3. Research screen projection

1. `ResearchScreenProjection` carries `technologies` (status, cost, invested points, prerequisites, availability, discovery weight, timing modifier, draw weight, draw odds), `fields` (eligibility, totals, active candidate), `turnNumber`, and the low-spending flag.
2. Technology status is derived once in `campaign-engine` from the same eligibility functions the month phase uses: `discovered`, `researching`, `open`, `locked`, `future`.
3. `historicalTimingModifierBp` and `discoveryDrawWeight` move to `@bluewave/campaign` beside eligibility rules; `phase-engine` and the projection both call them.
4. Authored technology names come from the content artifact; the renderer falls back to a humanised id.
5. The renderer projects points over eligible fields only, matching the engine's largest-remainder split.
6. Draw odds shown are the engine's own weights, never an estimate; exact technology selection stays prohibited.
7. `RESEARCH_SPEED` multipliers are defined in `@bluewave/campaign` but not applied by the research phase, so the screen does not show them.