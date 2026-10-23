# Audit: era mechanics for 1940-1970 (E-1 ticket 10)

Status: audit only, no engine change (issue #259, spec #249). Evidence is the pack at `df769929` (1940-1949 technologies) read
against `packages/` on `dev` at `c57da2d2`. The list of technologies is the 14 authored in `content/production/1880/technologies.yaml`
plus the candidates ADR-0283 accepts for 1950-1970 (`docs/research/e-1-1940-1970-timeline.md`).

## How a technology takes effect today

A technology has no effect field. It does something only when another record names its id:

- Gun models, gun mounts and parts gate on it through `lifecycle.requires` / `requiredTechnologyIds`; ship types through
  `availability.requiresTech`.
- Combat code gates on a few hard-coded ids (jets, mines, submarines) and the aircraft phase on four aviation ids.

No record in the pack names any of the 14 new ids, so researching them changes nothing yet. Three groups follow.

- **Supported (gate only)**: the engine can gate content on the id and the behaviour the content would use exists. Awaits content in #254 and later.
- **Inert**: researching it cannot change a battle or a design until the linked follow-up lands.
- **Follow-up**: a gap in the engine, filed as an issue.

## Authored technologies (1940-1949)

| Technology                       | Verdict               | Evidence                                                                                                                                   | Follow-up            |
| -------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| `rad_search_radar`               | Inert                 | Gunnery `radar` accuracy factor is neutral everywhere; no radar part family                                                                | #279, #283           |
| `rad_gunnery_fire_control_radar` | Inert                 | same                                                                                                                                       | #279, #283           |
| `rad_blind_fire_director`        | Inert                 | no blind-fire rule reads it                                                                                                                | #279                 |
| `fc_proximity_fuze`              | Inert                 | air defence runs on empty input in campaign battles                                                                                        | #280                 |
| `fc_radar_directed_maa`          | Inert                 | `radarDiminishingReturnsBp` never populated from a design                                                                                  | #279, #280           |
| `gun_dp_rapid_5in`               | Supported (gate only) | gun models can require it; surface gunnery has no AA role for a dual-purpose mount                                                         | #280 for the AA role |
| `gun_auto_loading_turret`        | Supported (gate only) | gun models can require it                                                                                                                  | none                 |
| `torp_acoustic_homing`           | Supported (gate only) | torpedo parts can require it; the torpedo model has contact and magnetic fuzes only, no homing                                             | #282                 |
| `m_asw_influence_mine`           | Inert                 | `combat/src/mines` reads `magnetic_mine_technology` and `acoustic_mine_technology`, not this id; mines are not in the campaign battle path | #278, #282           |
| `m_asw_ahead_throwing`           | Inert                 | no surface ASW weapon model                                                                                                                | #282                 |
| `sub_snorkel`                    | Inert                 | submarines are not in the campaign battle path; the snorkel multiplier exists only in `submarines/seaStateProfile.ts`                      | #282                 |
| `hc_all_welded_hull`             | Supported (gate only) | hull parts can require it; no consumer found that gives it an effect of its own                                                            | none                 |
| `av_carrier_jet`                 | Inert                 | `determineJetCapability` reads `early_jet_carrier_operations`; the carrier phase never calls it; CV/CVL/AV have `requiresTech: null`       | #278, #280           |
| `mis_heavy_ssm`                  | Inert                 | no missile model                                                                                                                           | #281                 |

## Candidates accepted for 1950-1970 (not yet authored)

| Candidate (ADR-0283)                                                                              | Verdict                                                             | Follow-up  |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------- |
| Wire-guided and active-homing torpedo (1956)                                                      | Inert until homing exists                                           | #282       |
| Improved and variable-depth sonar (1952, 1955)                                                    | Inert                                                               | #282, #283 |
| High-speed submarine hull (1953)                                                                  | Inert                                                               | #282       |
| Marine gas turbine (1953)                                                                         | Supported (gate only) via propulsion plants                         | none       |
| Helicopter hangar (1955)                                                                          | Inert                                                               | #280, #283 |
| Steam catapult and angled deck (1950, 1952)                                                       | Inert: `determineJetCapability` takes both as booleans nothing sets | #278, #280 |
| Heavy and medium SAM, light SAM, quadruple SSM, cruise missile, data link, medium ASM (1955-1967) | Inert                                                               | #281, #283 |
| CIWS                                                                                              | outside 1970, not authored                                          | none       |

## Findings behind the verdicts

1. **Id mismatch.** Engine constants and the catalogue name different technologies (jets, mines, submarines, aviation). The aircraft
   development phase checks `early_aviation`, `aviation`, `flight` or `basic_aviation`; none exists, so it cannot start from research (#278).
2. **Combat subsystems exist but are unreached.** `air-combat`, `air-defense`, `carrier-operations`, `mines`, `submarines` and `coastal-defense` are
   implemented in `packages/combat`. The campaign battle path reaches only gunnery, torpedoes, damage, smoke and the air wiring with no air groups
   or installations; the desktop battle marks its air, missile, jet and radar elements `NOT_EVALUATED_BY_DESKTOP_SANDBOX`
   (`apps/desktop/src/main/commands/battleSandboxCommands.ts`) (#280, #282).
3. **Missiles are absent.** Only submarine mission eligibility and a carrier hazard mention them (#281).
4. **Part schema limit.** `PART_FAMILIES` has no radar, sonar, AA, missile or hangar family and `CAPABILITY_KINDS` no matching kind (#283).
   This bounds what #254 can author: hulls, guns, mounts, torpedoes, propulsion and fittings, but not sensors beyond fire control.

## Content notes

The inert technologies carry a provenance note saying so, so the catalogue promises no behaviour the engine lacks.

## Follow-up issues

| Issue | Gap                                                                                 |
| ----- | ----------------------------------------------------------------------------------- |
| #278  | Catalogue ids versus the ids the engine reads                                       |
| #279  | Radar has no effect from a design                                                   |
| #280  | Air groups, air defence and jet carriers unreachable from a campaign battle         |
| #281  | No missile combat model                                                             |
| #282  | ASW, sonar, snorkel and influence mines outside the campaign battle path            |
| #283  | Part families and capability kinds for radar, sonar, AA, missile launchers, hangars |
