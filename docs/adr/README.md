# Architecture decision records

One ADR per durable decision: `ADR-NNNN-<slug>.md`. New decisions take the
highest existing number + 1 (the next number is ADR-0255).
Refresh this table from each file's H1 when one is added or re-titled.
Records numbered below 0201 are unavailable and unverified legacy references;
see the [authority index](../../.ai/AUTHORITY-INDEX.md).
See [DESIGN amendments](AMENDMENTS.md) for which ADRs amend which DESIGN doc.
Work an ADR records as deferred is tracked in [DEFERRALS](../DEFERRALS.md).
Older records kept as provenance are listed in [archive/README.md](archive/README.md).

Rows are grouped by area; the Status and Superseded-by cells mirror each ADR's
own `## Status` / `Superseded by:` lines (`pnpm preflight` fails when either
drifts). Process-only records are kept together under Process & documentation.

## Scope & horizon

The sole 1880 start, the 1939 authored horizon, and the ten-nation roster.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0201 | [ADR-0201-sole-1880-start.md](ADR-0201-sole-1880-start.md) | Sole 1880 start | accepted | — |
| 0204 | [ADR-0204-horizon-1939-and-scenario-ids.md](ADR-0204-horizon-1939-and-scenario-ids.md) | Authored horizon through 1939; no empty scenario IDs | accepted | — |
| 0205 | [ADR-0205-nine-playable-nations.md](ADR-0205-nine-playable-nations.md) | Nine playable nations; the rest AI-only behind a readiness gate | superseded | ADR-0214 |
| 0214 | [ADR-0214-ten-playable-nations-usa.md](ADR-0214-ten-playable-nations-usa.md) | Ten playable nations; the USA joins the 1880 playable roster | accepted | — |

## Values, currency & language

Canonical values and the presentation-only units, currency, and language modes over them.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0202 | [ADR-0202-canonical-internal-values.md](ADR-0202-canonical-internal-values.md) | Canonical internal values, presentation-only units and currency | accepted | — |
| 0206 | [ADR-0206-naval-credits.md](ADR-0206-naval-credits.md) | Naval Credits (NC) as the standardized comparison currency | accepted | — |
| 0207 | [ADR-0207-budget-points.md](ADR-0207-budget-points.md) | Budget Points (BP) as an abstract display unit | accepted | — |
| 0208 | [ADR-0208-no-custom-display-currency.md](ADR-0208-no-custom-display-currency.md) | Custom display currency excluded from the initial release | accepted | — |
| 0209 | [ADR-0209-ui-language-and-formatting-locale.md](ADR-0209-ui-language-and-formatting-locale.md) | UI language, formatting locale, and externalized strings | accepted | — |
| 0211 | [ADR-0211-default-and-national-historical-currency.md](ADR-0211-default-and-national-historical-currency.md) | Default currency Naval Credits; National Historical is conditional | accepted | — |
| 0215 | [ADR-0215-canonical-units-module.md](ADR-0215-canonical-units-module.md) | Canonical units module and its home in the contracts package | accepted | — |
| 0216 | [ADR-0216-money-type-and-treasury-bridge.md](ADR-0216-money-type-and-treasury-bridge.md) | Fixed-precision money type, treasury-unit scale, and the micro→unit bridge | accepted | — |
| 0217 | [ADR-0217-rounding-and-authoritative-float-gate.md](ADR-0217-rounding-and-authoritative-float-gate.md) | Rounding and fixed-point rules and the authoritative-float gate | accepted | — |
| 0218 | [ADR-0218-conversion-and-locale-boundary.md](ADR-0218-conversion-and-locale-boundary.md) | Conversion and locale boundary — canonical↔display only at presentation, language distinct from locale | accepted | — |
| 0219 | [ADR-0219-combat-and-capacity-fixed-point-repin.md](ADR-0219-combat-and-capacity-fixed-point-repin.md) | Combat and construction-capacity float→fixed conversion and its re-pin | accepted | — |
| 0221 | [ADR-0221-structured-explanation-data.md](ADR-0221-structured-explanation-data.md) | Structured explanation data for domain display values | accepted | — |

## Preferences & interfaces

The versioned preferences domain behind the Options screen.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0203 | [ADR-0203-options-and-preferences-architecture.md](ADR-0203-options-and-preferences-architecture.md) | Options screen and preferences architecture | accepted | — |

## Repository authority & re-baselining

Unavailable-artifact policy and the project authority order.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0210 | [ADR-0210-unavailable-artifacts-and-authority-order.md](ADR-0210-unavailable-artifacts-and-authority-order.md) | Unavailable artifacts are unverified legacy references; authority order | accepted | — |

## Process & documentation

Concurrent-agent worktree coordination and repository process rules.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0220 | [ADR-0220-worktree-per-effort-coordination.md](ADR-0220-worktree-per-effort-coordination.md) | Worktree-per-effort coordination for concurrent agents | superseded | ADR-0234 |
| 0227 | [ADR-0227-pipeline-tracker-on-github.md](ADR-0227-pipeline-tracker-on-github.md) | Pipeline issues live on GitHub, not local markdown | accepted | — |
| 0234 | [ADR-0234-single-checkout-local-merge-workflow.md](ADR-0234-single-checkout-local-merge-workflow.md) | Single checkout with local feature branches merged to dev locally | accepted | — |
| 0236 | [ADR-0236-up-to-three-worktrees.md](ADR-0236-up-to-three-worktrees.md) | Up to three concurrent worktrees | accepted | — |
| 0237 | [ADR-0237-up-to-five-worktrees.md](ADR-0237-up-to-five-worktrees.md) | Up to five concurrent worktrees | accepted | — |
| 0238 | [ADR-0238-golden-repin-commit-time-guard.md](ADR-0238-golden-repin-commit-time-guard.md) | Golden re-pin guard at commit time | accepted | — |
| 0246 | [ADR-0246-replay-corpus-supersedes-single-scenario-golden.md](ADR-0246-replay-corpus-supersedes-single-scenario-golden.md) | A replay corpus supersedes the single-scenario golden as the determinism baseline | accepted | — |

## Scenario content & research

Legality, consistency and authored posture of the 1880 scenario's starting content and research state.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0212 | [ADR-0212-initial-fleet-tech-legality.md](ADR-0212-initial-fleet-tech-legality.md) | Initial-fleet tech legality uses the global 1880 tech set | accepted | — |
| 0213 | [ADR-0213-opening-posture-balance-choices.md](ADR-0213-opening-posture-balance-choices.md) | The 1880 opening posture is authored canon; magnitudes are balance choices | accepted | — |
| 0228 | [ADR-0228-combat-classifier-1880-ruleset-v2.md](ADR-0228-combat-classifier-1880-ruleset-v2.md) | The combat ship-type classifier aligns to the 1880 classification ruleset v2 | accepted | — |
| 0229 | [ADR-0229-technology-year-global-designer-unlock.md](ADR-0229-technology-year-global-designer-unlock.md) | Technology `year` is the global designer unlock year, not a research claim | accepted | — |

## Campaign economy

The monthly appropriation, ledger, research, deficit policy and construction capacity as one model.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0230 | [ADR-0230-campaign-economy-model.md](ADR-0230-campaign-economy-model.md) | Campaign economy model — one appropriation, one ledger, one set of calculators | accepted | — |
| 0240 | [ADR-0240-s3-unrest-values-and-government-classification.md](ADR-0240-s3-unrest-values-and-government-classification.md) | S-3 unrest and economy values are researched then tunable; government type derives from political system | accepted | — |

## Turns, interruptions & save/resume

Turn identity and the suspend/resume interruption model.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0222 | [ADR-0222-turn-identity-stable-across-resume.md](ADR-0222-turn-identity-stable-across-resume.md) | A turn's interruption identity is stable across suspend and resume | accepted | — |
| 0235 | [ADR-0235-main-owned-recent-campaigns-and-reopen-allow-list.md](ADR-0235-main-owned-recent-campaigns-and-reopen-allow-list.md) | Main-owned recent campaigns and reopen allow-list | accepted | — |

## Fleet readiness, command & prestige

Readiness and maintenance ruleset constants, the 1880 command structure, and the prestige value path.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0223 | [ADR-0223-s1-readiness-crew-maintenance-ruleset-constants.md](ADR-0223-s1-readiness-crew-maintenance-ruleset-constants.md) | S-1 readiness, crew and maintenance values are centralized ruleset constants | accepted | — |
| 0224 | [ADR-0224-1880-command-structure-divisions-and-officers.md](ADR-0224-1880-command-structure-divisions-and-officers.md) | 1880 command structure — per-nation officer rosters and seeded divisions | accepted | — |
| 0225 | [ADR-0225-prestige-required-field-and-research-first.md](ADR-0225-prestige-required-field-and-research-first.md) | Prestige is a required authored field; values are research-first and S-2 is gated on 0003 | accepted | — |
| 0226 | [ADR-0226-rtw3-prestige-research-outcome.md](ADR-0226-rtw3-prestige-research-outcome.md) | RTW3 prestige research outcome — the model is grounded, the production values are not | accepted | — |
| 0239 | [ADR-0239-s2-prestige-values-balance-targets.md](ADR-0239-s2-prestige-values-balance-targets.md) | S-2 prestige values: the grounded model plus labelled balance targets | accepted | — |
| 0245 | [ADR-0245-player-nation-id-in-campaign-state.md](ADR-0245-player-nation-id-in-campaign-state.md) | The player nation is stored in authoritative campaign state | accepted | — |

## Foreign stations & presence

The authoritative home area and possession ownership behind per-area presence, the foreign-station assignment state, and the colonial-service fitting with its dormant ruleset section.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0231 | [ADR-0231-nation-home-area-and-possession-ownership.md](ADR-0231-nation-home-area-and-possession-ownership.md) | Authoritative nation home area and possession ownership in campaign state | accepted | — |
| 0241 | [ADR-0241-foreign-station-assignment-state.md](ADR-0241-foreign-station-assignment-state.md) | Foreign-station assignment is optional ship state, orthogonal to readiness | accepted | — |
| 0242 | [ADR-0242-colonial-service-fitting-and-presence-ruleset-section.md](ADR-0242-colonial-service-fitting-and-presence-ruleset-section.md) | Colonial-service fitting is optional design state; its cost is a value of the dormant S-5 ruleset section | accepted | — |
| 0247 | [ADR-0247-presence-measurement-and-shortfall.md](ADR-0247-presence-measurement-and-shortfall.md) | Presence is measured at month end from the dormant S-5 section and reported as typed shortfall events | accepted | — |
| 0248 | [ADR-0248-blockade-exemption-and-typed-penalty-requests.md](ADR-0248-blockade-exemption-and-typed-penalty-requests.md) | A blockaded nation at war is exempt from presence, and shortfalls emit typed penalty requests | accepted | — |
| 0249 | [ADR-0249-foreign-station-deployment-routes-ships-to-the-largest-shortfall.md](ADR-0249-foreign-station-deployment-routes-ships-to-the-largest-shortfall.md) | Foreign-station ships are routed one hop a month toward the largest shortfall | accepted | — |
| 0250 | [ADR-0250-base-limits-flag-and-consequences-at-month-end.md](ADR-0250-base-limits-flag-and-consequences-at-month-end.md) | Base limits are checked last each month; over-base ships are flagged and take the S-1 consequences | accepted | — |
| 0251 | [ADR-0251-fleet-screen-foreign-station-status-assign-and-presence-readout.md](ADR-0251-fleet-screen-foreign-station-status-assign-and-presence-readout.md) | The fleet screen shows manual p.48 status, assigns foreign station, and reads presence from the projection | accepted | — |
| 0253 | [ADR-0253-battle-offer-ruleset-section-player-nation-input-and-offer-response.md](ADR-0253-battle-offer-ruleset-section-player-nation-input-and-offer-response.md) | Battle-offer values live in a dormant ruleset section; the month takes the player nation; the offer response is an additive interruption input | accepted | — |
| 0254 | [ADR-0254-t1-battle-offer-values-balance-targets.md](ADR-0254-t1-battle-offer-values-balance-targets.md) | T-1 battle-offer values: labelled balance targets | accepted | — |

## Ship design & construction

The ship-designer model, its armour regions, named schemes, and the design draft schema.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0232 | [ADR-0232-armour-region-model-and-manual-parity.md](ADR-0232-armour-region-model-and-manual-parity.md) | Armour region model and manual parity | accepted | — |
| 0233 | [ADR-0233-designer-draft-schema-v2-and-canonical-vocabulary.md](ADR-0233-designer-draft-schema-v2-and-canonical-vocabulary.md) | Designer draft-schema v2 and canonical vocabulary | accepted | — |
| 0243 | [ADR-0243-design-edits-are-guarded-by-the-design-session.md](ADR-0243-design-edits-are-guarded-by-the-design-session.md) | Every design edit is guarded in the design session, and a newly broken design is explained at once | accepted | — |
| 0252 | [ADR-0252-designer-options-magazine-box-aluminium-superstructure-and-aa.md](ADR-0252-designer-options-magazine-box-aluminium-superstructure-and-aa.md) | Magazine box, aluminium superstructure and AA fit are additive designer options with provisional values | accepted | — |

## World map

How the presentation-only strategic map's baked geography is produced.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0244 | [ADR-0244-nation-borders-are-clipped-to-the-map-coastline.md](ADR-0244-nation-borders-are-clipped-to-the-map-coastline.md) | Nation borders are baked clipped to the map's coastline | accepted | — |

## Archive

0 records retained for provenance (older or absorbed decisions).
They stay on disk and searchable, but are not part of the active index; find
them with titles and links in [archive/README.md](archive/README.md).
