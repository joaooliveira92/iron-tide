# N-1 — 1880 scenario audit

Status: complete (investigation). Sprint N-1 in `.ai/SPRINT-PLAN.md` (Phase 1).
Scope: per-nation report on the compiled 1880 campaign — fleets, classes,
construction queues, budgets, maintenance, docks, tech state, research
priorities, relations, possessions, presence — plus the "every ship legal under
1880 tech" check. Findings become tickets under `.scratch/n-1-1880-scenario-audit/`.

## Method (deterministic, reproducible)

The audit reads the _compiled_ campaign snapshot, not the raw YAML, so it
measures what the engine actually loads.

```
pnpm --filter @bluewave/compiler-cli build
node apps/compiler-cli/dist/main.js campaign:compile \
  --manifest content/production/1880/pack.json \
  --content-dir content/production/1880 \
  --output-dir <tmp> --json
```

Observed at HEAD `c86b1df` (content lock `0.5.0`):
`contentHash 111f068841b381326de96085a049ee314bb80a42b710af6f8a58c10a5b3bd3fd`,
compiled `rawHash 9c97f3f72456cdbd5c25aa727c02ec5744a5d8711ce9e53df59c2502805c9a0b`.
The compiler reports no diagnostics; `content:verify` passes. Second runs were
byte-identical (same `rawHash`).

## Scenario totals

- 14 nations, 9 playable, 5 AI-only (`brazil`, `netherlands`, `ottoman_empire`,
  `portugal`, `usa`). 80 areas (62 coastal owned, 18 open seas unowned).
- 91 relation pairs (= C(14,2)); 88 ports; 86 routes.
- 37 designs / 37 design families; 20 ships; 9 under construction; 9
  construction projects; 0 divisions.

## Per-nation table (compiled 1880-01)

`tres/inc/exp` = treasury/income/expenses; `mnt` = snapshot maintenanceCost;
`fl/shp/bld` = fleets/ships/under-construction; `cns` = construction projects;
`rB/tech` = research budget / completed techs; `off/div` = officers/divisions;
`des` = own designs; `poss` = controlled areas.

| nation          | AI  | tres | inc | exp | mnt | fl  | shp | bld | cns | rB  | tech | off | div | des | poss |
| --------------- | --- | ---- | --- | --- | --- | --- | --- | --- | --- | --- | ---- | --- | --- | --- | ---- |
| uk              |     | 1000 | 100 | 38  | 0   | 3   | 4   | 1   | 1   | 60  | 8    | 6   | 0   | 10  | 15   |
| france          |     | 700  | 68  | 26  | 0   | 2   | 3   | 2   | 2   | 55  | 4    | 6   | 0   | 4   | 9    |
| russia          |     | 550  | 55  | 21  | 0   | 2   | 2   | 1   | 1   | 40  | 2    | 6   | 0   | 2   | 3    |
| italy           |     | 400  | 38  | 14  | 0   | 1   | 2   | 1   | 1   | 30  | 2    | 6   | 0   | 4   | 2    |
| germany         |     | 320  | 30  | 12  | 0   | 1   | 2   | 1   | 1   | 30  | 4    | 6   | 0   | 6   | 2    |
| usa             | AI  | 280  | 26  | 10  | 0   | 1   | 1   | 1   | 1   | 20  | 1    | 6   | 0   | 3   | 3    |
| austria_hungary |     | 240  | 22  | 9   | 0   | 1   | 2   | 1   | 1   | 20  | 1    | 6   | 0   | 1   | 2    |
| ottoman_empire  | AI  | 180  | 16  | 7   | 0   | 1   | 1   | 0   | 0   | 12  | 0    | 6   | 0   | 0   | 4    |
| spain           |     | 180  | 16  | 7   | 0   | 1   | 1   | 0   | 0   | 12  | 0    | 6   | 0   | 0   | 5    |
| japan           |     | 130  | 12  | 5   | 0   | 1   | 1   | 0   | 0   | 10  | 1    | 6   | 0   | 6   | 3    |
| qing            |     | 100  | 9   | 4   | 0   | 1   | 1   | 1   | 1   | 8   | 1    | 6   | 0   | 1   | 4    |
| netherlands     | AI  | 80   | 7   | 3   | 0   | 2   | 0   | 0   | 0   | 6   | 0    | 6   | 0   | 0   | 3    |
| brazil          | AI  | 60   | 5   | 2   | 0   | 1   | 0   | 0   | 0   | 4   | 0    | 6   | 0   | 0   | 2    |
| portugal        | AI  | 40   | 3   | 2   | 0   | 1   | 0   | 0   | 0   | 4   | 0    | 6   | 0   | 0   | 5    |

## Findings

### F1 — Initial fleet ships are not modelled against designs or technology (High)

Fleet ships carry hand-authored `hitPoints/speed/firepower/armor` independent of
any design, and **6 of 20 ships have no `designVersionId` at all**:
`aut_custoza`, `fra_courbet`, `fra_devastation`, `ott_mesudiye`, `esp_numancia`,
`gbr_malta_temp`. No compiler stage, test, or runtime path links an initial ship
to the components or technologies it requires. The design-tech gate
(`unlockedTechs`) lives only in `packages/ship-design` and is keyed off the
_global technology `year`_, never off a nation's completed techs
(`packages/ship-design/src/shipBuildingContent.ts:254`,
`armamentContent.ts` `unlockedTechs`). Therefore **"every ship legal under 1880
tech" cannot be certified either way** — the audit can only record the gap.
The 1880-legal tech set (year ≤ 1880) is:
`hc_wrought_iron_hull`, `mac_compound_engine`, `sd_ironclad_design`,
`gun_breech_rifled`, `torp_whitehead_torpedo`, `m_asw_contact_mine`,
`m_asw_spar_torpedo`, `infra_dry_dock`, `infra_coaling_station`,
`dc_iron_subdivision`.

### F2 — The construction design catalog exposes later-era designs at 1880 (High)

`buildConstructionDesignCatalog` (`packages/campaign-engine/src/construction.ts:126`)
returns **every** nation design, hardcodes `requiredTechnologyIds: []`
(comment at `:112`: "nothing in the current content pack links designs to
technology prerequisites"), and carries only an informational `year` from the
family's `familyCreationMonth`. The start path resolves the design from this
catalog with no era/tech gate (`apps/desktop/src/main/commands/constructionCommands.ts`

- `construction/design-validation.ts`, "design-exists-and-belongs-to-player").
  Result: a 1880 UK player's catalog lists Dreadnought (1906), Invincible (1908),
  Orion (1912), Queen Elizabeth (1915), Nelson (1927), King George V (1937); Japan
  lists Kongō (1913), Nagato (1920), Myōkō (1929), Yamato (1937). Later technology
  is present in the 1880 scenario.

### F3 — French construction queues reference the wrong designs (High, data)

`content/production/1880/constructions.yaml`:
`con_fra_courbet` (target `fra_courbet`) → `des_fra_redoutable`, and
`con_fra_devastation` (target `fra_devastation`) → `des_fra_amiral_duperre`.
Neither target class has its own design; both projects build against another
class's design version.

### F4 — Per-nation 1880 tech/ research seeds are uneven and partly inconsistent (Medium)

Completed techs: uk 8, france 4, germany 4, russia 2, italy 2,
austria/usa/japan/qing 1, and brazil/netherlands/ottoman/portugal/spain 0. Eight
nations own ironclads but lack the implied 1880 build set
(`sd_ironclad_design` + `gun_breech_rifled` + `mac_compound_engine`). Austria's
active project `gun_qf_light` requires `gun_breech_rifled`, which Austria has
not completed — an unmet prerequisite no validator catches. Seven nations have
no active project; all nations have `activeCandidates: {}` and
`discoveredTechs: []`.

### F5 — No initial tensions or rivalries (Medium)

All 91 relations are `neutral` with `tension` exactly `5`, `nap: false`,
`since: 1880-01`. There is no Franco-German, Anglo-French, Anglo-Russian or
Austro-Russian rivalry, so the political layer starts perfectly flat.

### F6 — Fleets are tiny and uneven; five AI-only nations are empty shells (Medium → N-2)

20 ships total across 14 nations. `brazil`, `netherlands`, `portugal` have zero
ships; `netherlands` (2 fleets), `brazil`, `portugal` have none. Five nations
(`brazil`, `netherlands`, `ottoman_empire`, `portugal`, `spain`) have zero own
designs and zero techs. AI-only nations are placeholders rather than viable
opponents.

### F7 — Divisions and officers are unseeded (Low) — resolved (ticket 07)

Every nation has `0` divisions and exactly `6` officers (uniform across nations,
e.g. uk: 3 CAPTAIN, 2 COMMODORE, 1 REAR_ADMIRAL) — placeholder seeding.
**Resolved** under ADR-0224: per-nation officer rosters (commit `94aee73`) and
seeded 1880 divisions (N-1 ticket 07, `divisions.yaml` + compile wiring). The
reference-run golden is unchanged (golden-neutral) because the in-code fixture
declares no divisions collection.

### F8 — Data hygiene (Low)

- `gbr_alyxandra` — "Alexandra" misspelled (`content/production/1880/fleets.yaml`).
- `gbr_malta_temp` — placeholder id (`_temp`) and composite name
  "HMS Mediterranean (Temeraire)".
- Cross-era class-name collisions: "Fusō" (1877 ironclad `des_jpn_fuso` vs 1915
  battleship `des_pw_japan_fuso`), "Dreadnought (1875)" vs "Dreadnought" (1906),
  "Courbet" (1880 ironclad vs 1913 `des_pw_france_courbet`).

### F9 — Informational (Low)

`nation.maintenanceCost` is `0` in the compiled snapshot for every nation
(populated only during a month); N-1 cannot read maintenance at turn 0 from the
snapshot alone. Not a defect.

## Open decision (not resolved here — gameplay-changing)

**D1.** Is initial-fleet legality judged against each nation's _completed_ techs
(F4 suggests that reading), or against the _global_ set of techs available by
1880 (legacy historical ships need no research)? The two readings change which
starting fleets are legal and how much research content must be seeded. Recorded
here and referenced by ticket 01; not guessed.

## Tickets

Findings became tickets under `.scratch/n-1-1880-scenario-audit/issues/`:
01 fleet-tech legality, 02 catalog era/tech gating, 03 French queue fix,
04 research/tech seed reconciliation, 05 initial relations/tension,
06 empty fleets / AI-only content, 07 divisions & officers, 08 data hygiene,
09 idle research seeding. Ticket 01 is gated by D1.

## Completion (2026-10-17)

Tickets 01–09 are done. Ticket 07's divisions half landed last (ADR-0224): the
authored `divisions` collection plus compile wiring replaced the hard-coded
`divisions: []`. The change is golden-neutral for the cross-process reference run
and moves only the authored content and the committed content lock. N-1 is
complete; the 1880 start now carries the era's squadrons, divisions, officer
corps, relations and research seeds.

N-1 completion unblocks **N-2** (1880 content completion) and **N-3**
(1880–1890 progression). Both are large separate sprints defined in
`.ai/SPRINT-PLAN.md` and are not started here; the residual content gaps the
audit recorded (F1–F6, F8) are the N-2 intake.

## Pre-existing validation baseline (2026-10-17)

These failures reproduce on a clean `origin/dev` checkout (`d6321b0`), not only
on this branch, and are recorded as the baseline rather than fixed here:

- **Performance tripwire (`quality` CI).** `BLUEWAVE_PERF=1` month-advance fails
  at month 10 with `NEGATIVE_TREASURY_OBLIGATION` for Portugal. Reproduced on
  clean `origin/dev` with the production content artifact; clearing
  `NationState.divisions` does not change it, so it is an economy/readiness
  baseline issue (S-1), not a seeded-divisions regression.
- **Determinism (`windows-latest`).** Three schema-discovery tests and the
  ship-building host-order test fail on Windows path separators /
  `fs` enumeration order (`schemaCoverage`, `manifestAuthority`,
  `shipBuildingDiscovery`). Reproduced only on Windows.
- **Desktop e2e (`debug` drill).** `campaign-battle-drill.debug.spec.ts` can
  stall on the battle dialog intercepting the bottom-nav click. The standard
  30/30 desktop e2e suite passes locally; the debug spec is a separate CI step.

Local `pnpm check` is green on this branch for every step except the same
pre-existing perf tripwire (and one one-off flaky `ship-types` e2e that passed
standalone and in the full 30/30 rerun).
