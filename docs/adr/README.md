# Architecture decision records

One ADR per durable decision: `ADR-NNNN-<slug>.md`. New decisions take the
highest existing number + 1 (the next number is ADR-0370).
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

The sole 1880 start, the 1970 authored horizon, and the ten-nation roster.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0348 | [ADR-0348-authored-scope-and-horizon.md](ADR-0348-authored-scope-and-horizon.md) | Authored scope and horizon | accepted | — |
| 0349 | [ADR-0349-ten-playable-nations-roster.md](ADR-0349-ten-playable-nations-roster.md) | Ten playable nations roster | accepted | — |
| 0350 | [ADR-0350-e1-1940-1970-content-values.md](ADR-0350-e1-1940-1970-content-values.md) | E-1 1940-1970 content and values | accepted | — |
| 0201 | [ADR-0201-sole-1880-start.md](ADR-0201-sole-1880-start.md) | Sole 1880 start | superseded | ADR-0348 |
| 0204 | [ADR-0204-horizon-1939-and-scenario-ids.md](ADR-0204-horizon-1939-and-scenario-ids.md) | Authored horizon through 1939; no empty scenario IDs | superseded | ADR-0348 |
| 0205 | [ADR-0205-nine-playable-nations.md](ADR-0205-nine-playable-nations.md) | Nine playable nations; the rest AI-only behind a readiness gate | superseded | ADR-0349 |
| 0214 | [ADR-0214-ten-playable-nations-usa.md](ADR-0214-ten-playable-nations-usa.md) | Ten playable nations; the USA joins the 1880 playable roster | superseded | ADR-0349 |
| 0282 | [ADR-0282-authored-horizon-through-1970.md](ADR-0282-authored-horizon-through-1970.md) | Authored horizon through 1970; no empty scenario IDs | superseded | ADR-0348 |
| 0283 | [ADR-0283-e1-1940-1970-content-decisions.md](ADR-0283-e1-1940-1970-content-decisions.md) | E-1 1940-1970 content decisions | superseded | ADR-0350 |
| 0284 | [ADR-0284-e1-1940s-ship-and-part-values.md](ADR-0284-e1-1940s-ship-and-part-values.md) | E-1 1940-1949 ship and part values | superseded | ADR-0350 |
| 0290 | [ADR-0290-e1-1940s-cruiser-values.md](ADR-0290-e1-1940s-cruiser-values.md) | E-1 1940-1949 cruiser values | superseded | ADR-0350 |
| 0291 | [ADR-0291-e1-1950s-destroyer-values.md](ADR-0291-e1-1950s-destroyer-values.md) | E-1 1950-1959 destroyer values and the limit of 1950-1970 ship content | superseded | ADR-0350 |

## Values, currency & language

Canonical values and the presentation-only units, currency, and language modes over them.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0351 | [ADR-0351-canonical-values-units-fixed-point.md](ADR-0351-canonical-values-units-fixed-point.md) | Canonical internal values, units and fixed-point arithmetic | accepted | — |
| 0352 | [ADR-0352-currency-display-language-formatting-boundary.md](ADR-0352-currency-display-language-formatting-boundary.md) | Currency display modes, UI language, and formatting boundary | accepted | — |
| 0353 | [ADR-0353-strategic-report-explanation-provenance.md](ADR-0353-strategic-report-explanation-provenance.md) | Provenance for strategic-area and monthly-report explanations | accepted | — |
| 0202 | [ADR-0202-canonical-internal-values.md](ADR-0202-canonical-internal-values.md) | Canonical internal values, presentation-only units and currency | superseded | ADR-0351 |
| 0206 | [ADR-0206-naval-credits.md](ADR-0206-naval-credits.md) | Naval Credits (NC) as the standardized comparison currency | superseded | ADR-0352 |
| 0207 | [ADR-0207-budget-points.md](ADR-0207-budget-points.md) | Budget Points (BP) as an abstract display unit | superseded | ADR-0352 |
| 0208 | [ADR-0208-no-custom-display-currency.md](ADR-0208-no-custom-display-currency.md) | Custom display currency excluded from the initial release | superseded | ADR-0352 |
| 0209 | [ADR-0209-ui-language-and-formatting-locale.md](ADR-0209-ui-language-and-formatting-locale.md) | UI language, formatting locale, and externalized strings | superseded | ADR-0352 |
| 0211 | [ADR-0211-default-and-national-historical-currency.md](ADR-0211-default-and-national-historical-currency.md) | Default currency Naval Credits; National Historical is conditional | superseded | ADR-0352 |
| 0215 | [ADR-0215-canonical-units-module.md](ADR-0215-canonical-units-module.md) | Canonical units module and its home in the contracts package | superseded | ADR-0351 |
| 0216 | [ADR-0216-money-type-and-treasury-bridge.md](ADR-0216-money-type-and-treasury-bridge.md) | Fixed-precision money type, treasury-unit scale, and the micro→unit bridge | superseded | ADR-0351 |
| 0217 | [ADR-0217-rounding-and-authoritative-float-gate.md](ADR-0217-rounding-and-authoritative-float-gate.md) | Rounding and fixed-point rules and the authoritative-float gate | superseded | ADR-0351 |
| 0218 | [ADR-0218-conversion-and-locale-boundary.md](ADR-0218-conversion-and-locale-boundary.md) | Conversion and locale boundary — canonical↔display only at presentation, language distinct from locale | superseded | ADR-0352 |
| 0219 | [ADR-0219-combat-and-capacity-fixed-point-repin.md](ADR-0219-combat-and-capacity-fixed-point-repin.md) | Combat and construction-capacity float→fixed conversion and its re-pin | superseded | ADR-0351 |
| 0221 | [ADR-0221-structured-explanation-data.md](ADR-0221-structured-explanation-data.md) | Structured explanation data for domain display values | accepted | — |
| 0307 | [ADR-0307-strategic-and-report-explanation-provenance.md](ADR-0307-strategic-and-report-explanation-provenance.md) | Provenance for strategic-area and monthly-report explanations | superseded | ADR-0353 |

## Preferences & interfaces

The versioned preferences domain behind the Options screen.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0338 | [ADR-0338-options-and-preferences-and-campaign-command-registry.md](ADR-0338-options-and-preferences-and-campaign-command-registry.md) | Options, preferences and the campaign command registry | accepted | — |
| 0203 | [ADR-0203-options-and-preferences-architecture.md](ADR-0203-options-and-preferences-architecture.md) | Options screen and preferences architecture | superseded | ADR-0338 |
| 0270 | [ADR-0270-campaign-command-table-is-the-registry.md](ADR-0270-campaign-command-table-is-the-registry.md) | The campaign command descriptor table is the command registry | superseded | ADR-0338 |

## Repository authority & re-baselining

Unavailable-artifact policy and the project authority order.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0347 | [ADR-0347-repository-authority-and-rebaselining.md](ADR-0347-repository-authority-and-rebaselining.md) | Repository authority order and unavailable-artifact policy | accepted | — |
| 0210 | [ADR-0210-unavailable-artifacts-and-authority-order.md](ADR-0210-unavailable-artifacts-and-authority-order.md) | Unavailable artifacts are unverified legacy references; authority order | superseded | ADR-0347 |

## Process & documentation

Worktree and git workflow, agent task lifecycle, verification gates and CI infrastructure, ADR corpus and replay practices.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0220 | [ADR-0220-worktree-per-effort-coordination.md](ADR-0220-worktree-per-effort-coordination.md) | Worktree-per-effort coordination for concurrent agents | superseded | ADR-0364 |
| 0227 | [ADR-0227-pipeline-tracker-on-github.md](ADR-0227-pipeline-tracker-on-github.md) | Pipeline issues live on GitHub, not local markdown | superseded | ADR-0365 |
| 0274 | [ADR-0274-scratch-removed-from-tree.md](ADR-0274-scratch-removed-from-tree.md) | The frozen `.scratch/` tree is removed | superseded | ADR-0365 |
| 0275 | [ADR-0275-tsgo-gate-reads-installed-toolchain.md](ADR-0275-tsgo-gate-reads-installed-toolchain.md) | The tsgo gate compares pins to the installed toolchain | superseded | ADR-0365 |
| 0234 | [ADR-0234-single-checkout-local-merge-workflow.md](ADR-0234-single-checkout-local-merge-workflow.md) | Single checkout with local feature branches merged to dev locally | superseded | ADR-0364 |
| 0236 | [ADR-0236-up-to-three-worktrees.md](ADR-0236-up-to-three-worktrees.md) | Up to three concurrent worktrees | superseded | ADR-0364 |
| 0237 | [ADR-0237-up-to-five-worktrees.md](ADR-0237-up-to-five-worktrees.md) | Up to five concurrent worktrees | superseded | ADR-0364 |
| 0238 | [ADR-0238-golden-repin-commit-time-guard.md](ADR-0238-golden-repin-commit-time-guard.md) | Golden re-pin guard at commit time | superseded | ADR-0365 |
| 0246 | [ADR-0246-replay-corpus-supersedes-single-scenario-golden.md](ADR-0246-replay-corpus-supersedes-single-scenario-golden.md) | A replay corpus supersedes the single-scenario golden as the determinism baseline | superseded | ADR-0366 |
| 0267 | [ADR-0267-reachability-ledger-maps-engine-capability-to-desktop-path.md](ADR-0267-reachability-ledger-maps-engine-capability-to-desktop-path.md) | The reachability ledger maps engine capability to desktop path | superseded | ADR-0365 |
| 0268 | [ADR-0268-code-carries-no-comments.md](ADR-0268-code-carries-no-comments.md) | Code carries no comments | superseded | ADR-0366 |
| 0269 | [ADR-0269-worktree-ledger-is-local-untracked-state.md](ADR-0269-worktree-ledger-is-local-untracked-state.md) | The worktree ledger is local, untracked state | superseded | ADR-0364 |
| 0279 | [ADR-0279-replay-approvals-carry-a-change-class.md](ADR-0279-replay-approvals-carry-a-change-class.md) | Replay approvals carry a verified change class | superseded | ADR-0366 |
| 0280 | [ADR-0280-property-based-replay-scenarios.md](ADR-0280-property-based-replay-scenarios.md) | Property-based replay scenarios use fast-check as a test-only dependency | superseded | ADR-0366 |
| 0295 | [ADR-0295-war-bearing-replay-scenarios.md](ADR-0295-war-bearing-replay-scenarios.md) | A replay scenario may name a player nation and a deterministic start setup so the corpus fights a battle | superseded | ADR-0366 |
| 0299 | [ADR-0299-gate-runs-serialise-across-worktrees.md](ADR-0299-gate-runs-serialise-across-worktrees.md) | `pnpm check` serialises across worktrees and reports machine load | superseded | ADR-0365 |
| 0300 | [ADR-0300-unreachable-combat-modules-wire-by-owner-dormant-until-then.md](ADR-0300-unreachable-combat-modules-wire-by-owner-dormant-until-then.md) | Unreachable combat modules are wired by their roadmap owner and stay dormant until then | superseded | ADR-0365 |
| 0313 | [ADR-0313-worktree-registry-under-git-common-dir.md](ADR-0313-worktree-registry-under-git-common-dir.md) | The worktree inventory is a locked registry under the Git common directory | superseded | ADR-0364 |
| 0318 | [ADR-0318-adrs-declare-their-scope-and-packages-link-them.md](ADR-0318-adrs-declare-their-scope-and-packages-link-them.md) | ADRs declare the scopes they govern, and each scope's AGENTS.md links its generated index | superseded | ADR-0366 |
| 0319 | [ADR-0319-debug-screens-stay-internal.md](ADR-0319-debug-screens-stay-internal.md) | Debug-only screens stay internal and leave the production renderer bundle | superseded | ADR-0366 |
| 0335 | [ADR-0335-agent-navigation-and-scoped-verification.md](ADR-0335-agent-navigation-and-scoped-verification.md) | Agent navigation and scoped verification are repository tools | superseded | ADR-0365 |
| 0336 | [ADR-0336-adr-corpus-integrity-gate.md](ADR-0336-adr-corpus-integrity-gate.md) | Every current ADR states its `Rule:`, holds one area, and supersedes acyclically | superseded | ADR-0366 |
| 0364 | [ADR-0364-worktree-and-git-workflow.md](ADR-0364-worktree-and-git-workflow.md) | Worktree and git workflow | accepted | — |
| 0365 | [ADR-0365-verification-gates-and-infrastructure.md](ADR-0365-verification-gates-and-infrastructure.md) | Verification gates and infrastructure | accepted | — |
| 0366 | [ADR-0366-adr-code-and-replay-practices.md](ADR-0366-adr-code-and-replay-practices.md) | ADR, code and replay practices | accepted | — |
| 0367 | [ADR-0367-agent-task-lifecycle-and-merge-authority.md](ADR-0367-agent-task-lifecycle-and-merge-authority.md) | Agent task lifecycle, merge authority and rollback | accepted | — |

## Scenario content & research

Legality, consistency and authored posture of the 1880 scenario's starting content and research state.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0339 | [ADR-0339-scenario-opening-conditions-and-technology-unlock.md](ADR-0339-scenario-opening-conditions-and-technology-unlock.md) | Scenario opening conditions & technology unlock discipline | accepted | — |
| 0340 | [ADR-0340-combat-classification-and-research-technology-alignment.md](ADR-0340-combat-classification-and-research-technology-alignment.md) | Combat classification & research technology alignment | accepted | — |
| 0212 | [ADR-0212-initial-fleet-tech-legality.md](ADR-0212-initial-fleet-tech-legality.md) | Initial-fleet tech legality uses the global 1880 tech set | superseded | ADR-0339 |
| 0213 | [ADR-0213-opening-posture-balance-choices.md](ADR-0213-opening-posture-balance-choices.md) | The 1880 opening posture is authored canon; magnitudes are balance choices | superseded | ADR-0339 |
| 0228 | [ADR-0228-combat-classifier-1880-ruleset-v2.md](ADR-0228-combat-classifier-1880-ruleset-v2.md) | The combat ship-type classifier aligns to the 1880 classification ruleset v2 | superseded | ADR-0340 |
| 0229 | [ADR-0229-technology-year-global-designer-unlock.md](ADR-0229-technology-year-global-designer-unlock.md) | Technology `year` is the global designer unlock year, not a research claim | superseded | ADR-0339 |
| 0315 | [ADR-0315-research-workspace-projection.md](ADR-0315-research-workspace-projection.md) | The research screen reads a technology-chart projection, and the draw weight has one home | superseded | ADR-0340 |
| 0310 | [ADR-0310-e1-catalogue-technologies-for-carrier-mine-and-submarine-ids.md](ADR-0310-e1-catalogue-technologies-for-carrier-mine-and-submarine-ids.md) | E-1 catalogue technologies for carrier, mine and submarine engine ids | superseded | ADR-0340 |

## Campaign economy

The monthly appropriation, ledger, research, deficit policy and construction capacity as one model.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0337 | [ADR-0337-campaign-economy-model-and-budget-pressure.md](ADR-0337-campaign-economy-model-and-budget-pressure.md) | Campaign economy — one appropriation, one ledger, one set of budget-pressure values | accepted | — |
| 0230 | [ADR-0230-campaign-economy-model.md](ADR-0230-campaign-economy-model.md) | Campaign economy model — one appropriation, one ledger, one set of calculators | superseded | ADR-0337 |
| 0240 | [ADR-0240-s3-unrest-values-and-government-classification.md](ADR-0240-s3-unrest-values-and-government-classification.md) | S-3 unrest and economy values are researched then tunable; government type derives from political system | superseded | ADR-0337 |

## Turns, interruptions & save/resume

Turn identity, the suspend/resume interruption model, and strict save-file decoding.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0342 | [ADR-0342-turn-identity-and-campaign-resume-workflow.md](ADR-0342-turn-identity-and-campaign-resume-workflow.md) | Turn identity and campaign resume workflow | accepted | — |
| 0343 | [ADR-0343-save-file-integrity-retention-and-hashing.md](ADR-0343-save-file-integrity-retention-and-hashing.md) | Save file integrity, retention and hashing | accepted | — |
| 0368 | [ADR-0368-persistence-cancellation-and-typed-failure-guard.md](ADR-0368-persistence-cancellation-and-typed-failure-guard.md) | Persistence has no abort signal; its typed failures are guarded by the ratchet | accepted | — |
| 0222 | [ADR-0222-turn-identity-stable-across-resume.md](ADR-0222-turn-identity-stable-across-resume.md) | A turn's interruption identity is stable across suspend and resume | superseded | ADR-0342 |
| 0235 | [ADR-0235-main-owned-recent-campaigns-and-reopen-allow-list.md](ADR-0235-main-owned-recent-campaigns-and-reopen-allow-list.md) | Main-owned recent campaigns and reopen allow-list | superseded | ADR-0342 |
| 0278 | [ADR-0278-save-files-decode-strictly.md](ADR-0278-save-files-decode-strictly.md) | Save files decode strictly, campaign.json included | superseded | ADR-0343 |
| 0285 | [ADR-0285-campaign-snapshot-hash-covers-map-fields.md](ADR-0285-campaign-snapshot-hash-covers-map-fields.md) | The campaign snapshot hash covers Map fields | superseded | ADR-0343 |
| 0305 | [ADR-0305-save-retention-policy-and-effect-suffixed-persistence-apis.md](ADR-0305-save-retention-policy-and-effect-suffixed-persistence-apis.md) | Saves are retained by an opt-in count with a protected head; Effect-returning persistence methods carry an `Effect` suffix | superseded | ADR-0343 |
| 0330 | [ADR-0330-unified-snapshot-hash.md](ADR-0330-unified-snapshot-hash.md) | One versioned, domain-separated snapshot hash | superseded | ADR-0343 |
| 0331 | [ADR-0331-save-manifest-integrity.md](ADR-0331-save-manifest-integrity.md) | Saves are sealed by a complete-file manifest, not a signature | superseded | ADR-0343 |

## Fleet readiness, command & prestige

Readiness and maintenance ruleset constants, the 1880 command structure, and the prestige value path.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0354 | [ADR-0354-prestige-and-career-system.md](ADR-0354-prestige-and-career-system.md) | Prestige and Career System | accepted | — |
| 0355 | [ADR-0355-readiness-command-structure-and-division-state.md](ADR-0355-readiness-command-structure-and-division-state.md) | Readiness, Command Structure and Division State | accepted | — |
| 0356 | [ADR-0356-fleet-management-gates-values-and-ship-use.md](ADR-0356-fleet-management-gates-values-and-ship-use.md) | Fleet Management — Gates, Values and Ship Use | accepted | — |
| 0357 | [ADR-0357-training-exercises-division-growth-and-explanation-trees.md](ADR-0357-training-exercises-division-growth-and-explanation-trees.md) | Training, Exercises, Division Growth and Explanation Trees | accepted | — |
| 0223 | [ADR-0223-s1-readiness-crew-maintenance-ruleset-constants.md](ADR-0223-s1-readiness-crew-maintenance-ruleset-constants.md) | S-1 readiness, crew and maintenance values are centralized ruleset constants | superseded | ADR-0355 |
| 0224 | [ADR-0224-1880-command-structure-divisions-and-officers.md](ADR-0224-1880-command-structure-divisions-and-officers.md) | 1880 command structure — per-nation officer rosters and seeded divisions | superseded | ADR-0355 |
| 0225 | [ADR-0225-prestige-required-field-and-research-first.md](ADR-0225-prestige-required-field-and-research-first.md) | Prestige is a required authored field; values are research-first and S-2 is gated on 0003 | superseded | ADR-0354 |
| 0226 | [ADR-0226-rtw3-prestige-research-outcome.md](ADR-0226-rtw3-prestige-research-outcome.md) | RTW3 prestige research outcome — the model is grounded, the production values are not | superseded | ADR-0354 |
| 0239 | [ADR-0239-s2-prestige-values-balance-targets.md](ADR-0239-s2-prestige-values-balance-targets.md) | S-2 prestige values: the grounded model plus labelled balance targets | superseded | ADR-0354 |
| 0245 | [ADR-0245-player-nation-id-in-campaign-state.md](ADR-0245-player-nation-id-in-campaign-state.md) | The player nation is stored in authoritative campaign state | superseded | ADR-0354 |
| 0260 | [ADR-0260-prestige-application-and-unpaid-funds-source.md](ADR-0260-prestige-application-and-unpaid-funds-source.md) | Prestige application seam and the unpaid-funds source | superseded | ADR-0354 |
| 0261 | [ADR-0261-fixed-loss-rule-and-declined-battle-reason-code.md](ADR-0261-fixed-loss-rule-and-declined-battle-reason-code.md) | A fixed-loss prestige rule and an optional DECLINED_BATTLE reason code | superseded | ADR-0354 |
| 0281 | [ADR-0281-sacking-phase-and-terminal-career.md](ADR-0281-sacking-phase-and-terminal-career.md) | The sacking phase and the terminal career | superseded | ADR-0354 |
| 0314 | [ADR-0314-fleet-management-values-and-repair-entry.md](ADR-0314-fleet-management-values-and-repair-entry.md) | Fleet-management v2 values are balance targets, and REPAIR entry stays out of scope | superseded | ADR-0356 |
| 0286 | [ADR-0286-fleet-management-gate-evaluator-and-dormant-ruleset-section.md](ADR-0286-fleet-management-gate-evaluator-and-dormant-ruleset-section.md) | Ship use is decided by one gate evaluator; fleet-management values live in a dormant ruleset section | superseded | ADR-0356 |
| 0287 | [ADR-0287-battle-absence-record.md](ADR-0287-battle-absence-record.md) | A battle record explains the player's absent ships with gate reasons | superseded | ADR-0356 |
| 0288 | [ADR-0288-monthly-division-cohesion-growth.md](ADR-0288-monthly-division-cohesion-growth.md) | Division cohesion grows monthly through a pure rule applied after readiness evolution | superseded | ADR-0357 |
| 0289 | [ADR-0289-division-doctrine-command-and-speed-advisory.md](ADR-0289-division-doctrine-command-and-speed-advisory.md) | Role and formation changes are one division command priced from the ruleset; speed mismatch is a derived advisory | superseded | ADR-0357 |
| 0316 | [ADR-0316-special-training-program.md](ADR-0316-special-training-program.md) | Special training is a nation program whose maintenance adder feeds the shared calculator | superseded | ADR-0357 |
| 0317 | [ADR-0317-annual-fleet-exercise.md](ADR-0317-annual-fleet-exercise.md) | The annual fleet exercise is scheduled for the next month and held through the assignment slot | superseded | ADR-0357 |
| 0292 | [ADR-0292-battle-experience-write-back.md](ADR-0292-battle-experience-write-back.md) | Battle aftermath asks the division module for experience through a typed request | superseded | ADR-0357 |
| 0293 | [ADR-0293-fleet-management-go-live.md](ADR-0293-fleet-management-go-live.md) | Fleet management goes live in the production pack and in every re-execution path | superseded | ADR-0356 |
| 0296 | [ADR-0296-derived-ship-conditions.md](ADR-0296-derived-ship-conditions.md) | Ship conditions are derived predicates the fleet view carries and the renderer only labels | superseded | ADR-0355 |
| 0297 | [ADR-0297-engine-reads-catalogue-technology-ids.md](ADR-0297-engine-reads-catalogue-technology-ids.md) | The engine reads the catalogue's technology id where one matches, and leaves the rest named | superseded | ADR-0357 |
| 0298 | [ADR-0298-command-lifecycle-records-are-scaffolding.md](ADR-0298-command-lifecycle-records-are-scaffolding.md) | Hash-chained command-lifecycle records, settlement branches and the spec-rule helpers are scaffolding, not shipped | superseded | ADR-0355 |
| 0301 | [ADR-0301-gunnery-proficiency-feeds-battle-accuracy.md](ADR-0301-gunnery-proficiency-feeds-battle-accuracy.md) | Proficient gunnery training raises the nation's gunnery accuracy in battle | superseded | ADR-0357 |
| 0302 | [ADR-0302-all-training-subjects-reach-battle-through-one-effects-record.md](ADR-0302-all-training-subjects-reach-battle-through-one-effects-record.md) | All four training subjects reach battle through one per-side effects record | superseded | ADR-0357 |
| 0303 | [ADR-0303-training-cost-multiplier-and-exercise-tension-are-ruleset-data.md](ADR-0303-training-cost-multiplier-and-exercise-tension-are-ruleset-data.md) | Training cost differences and exercise tension are generic ruleset data | superseded | ADR-0357 |
| 0304 | [ADR-0304-explanation-trees-for-displayed-numbers.md](ADR-0304-explanation-trees-for-displayed-numbers.md) | Displayed numbers carry an explanation tree; gunnery accuracy is the first slice | superseded | ADR-0357 |

## Foreign stations & presence

The authoritative home area and possession ownership behind per-area presence, the foreign-station assignment state, and the colonial-service fitting with its dormant ruleset section.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0231 | [ADR-0231-nation-home-area-and-possession-ownership.md](ADR-0231-nation-home-area-and-possession-ownership.md) | Authoritative nation home area and possession ownership in campaign state | superseded | ADR-0362 |
| 0241 | [ADR-0241-foreign-station-assignment-state.md](ADR-0241-foreign-station-assignment-state.md) | Foreign-station assignment is optional ship state, orthogonal to readiness | superseded | ADR-0362 |
| 0242 | [ADR-0242-colonial-service-fitting-and-presence-ruleset-section.md](ADR-0242-colonial-service-fitting-and-presence-ruleset-section.md) | Colonial-service fitting is optional design state; its cost is a value of the dormant S-5 ruleset section | superseded | ADR-0362 |
| 0247 | [ADR-0247-presence-measurement-and-shortfall.md](ADR-0247-presence-measurement-and-shortfall.md) | Presence is measured at month end from the dormant S-5 section and reported as typed shortfall events | superseded | ADR-0362 |
| 0248 | [ADR-0248-blockade-exemption-and-typed-penalty-requests.md](ADR-0248-blockade-exemption-and-typed-penalty-requests.md) | A blockaded nation at war is exempt from presence, and shortfalls emit typed penalty requests | superseded | ADR-0362 |
| 0249 | [ADR-0249-foreign-station-deployment-routes-ships-to-the-largest-shortfall.md](ADR-0249-foreign-station-deployment-routes-ships-to-the-largest-shortfall.md) | Foreign-station ships are routed one hop a month toward the largest shortfall | superseded | ADR-0362 |
| 0250 | [ADR-0250-base-limits-flag-and-consequences-at-month-end.md](ADR-0250-base-limits-flag-and-consequences-at-month-end.md) | Base limits are checked last each month; over-base ships are flagged and take the S-1 consequences | superseded | ADR-0362 |
| 0251 | [ADR-0251-fleet-screen-foreign-station-status-assign-and-presence-readout.md](ADR-0251-fleet-screen-foreign-station-status-assign-and-presence-readout.md) | The fleet screen shows manual p.48 status, assigns foreign station, and reads presence from the projection | superseded | ADR-0362 |
| 0253 | [ADR-0253-battle-offer-ruleset-section-player-nation-input-and-offer-response.md](ADR-0253-battle-offer-ruleset-section-player-nation-input-and-offer-response.md) | Battle-offer values live in a dormant ruleset section; the month takes the player nation; the offer response is an additive interruption input | superseded | ADR-0363 |
| 0254 | [ADR-0254-t1-battle-offer-values-balance-targets.md](ADR-0254-t1-battle-offer-values-balance-targets.md) | T-1 battle-offer values: labelled balance targets | superseded | ADR-0363 |
| 0255 | [ADR-0255-battle-offer-request-estimate-and-answer.md](ADR-0255-battle-offer-request-estimate-and-answer.md) | The battle offer: request shape, estimate, accept and delegate, typed refusals | superseded | ADR-0363 |
| 0256 | [ADR-0256-battle-offer-decline-record-release-and-victory-point-cost.md](ADR-0256-battle-offer-decline-record-release-and-victory-point-cost.md) | Declining a battle offer: terminal record, released ships, victory-point cost | superseded | ADR-0363 |
| 0257 | [ADR-0257-declined-battle-tally-and-threshold-event.md](ADR-0257-declined-battle-tally-and-threshold-event.md) | Declined-battle tally and the repeated-decline threshold event | superseded | ADR-0363 |
| 0258 | [ADR-0258-enemy-declines-a-battle-with-the-player.md](ADR-0258-enemy-declines-a-battle-with-the-player.md) | The enemy declines a battle with the player | superseded | ADR-0363 |
| 0259 | [ADR-0259-friendly-support-force-joins-the-players-side.md](ADR-0259-friendly-support-force-joins-the-players-side.md) | A friendly support force joins the player's side | superseded | ADR-0363 |
| 0262 | [ADR-0262-repeated-declines-cost-the-player-prestige.md](ADR-0262-repeated-declines-cost-the-player-prestige.md) | Repeated declines cost the player prestige through the S-2 seam | superseded | ADR-0363 |
| 0263 | [ADR-0263-battle-offer-section-goes-live-on-the-production-pack.md](ADR-0263-battle-offer-section-goes-live-on-the-production-pack.md) | The battle-offer section goes live on the production pack | superseded | ADR-0363 |
| 0264 | [ADR-0264-t1-battle-offer-state-keeps-compatibility-version-4-0-0.md](ADR-0264-t1-battle-offer-state-keeps-compatibility-version-4-0-0.md) | The T-1 battle-offer state keeps compatibility version 4.0.0 | superseded | ADR-0363 |
| 0265 | [ADR-0265-battle-declined-event-carries-the-running-decline-count.md](ADR-0265-battle-declined-event-carries-the-running-decline-count.md) | The BattleDeclined event carries the running decline count | superseded | ADR-0363 |
| 0266 | [ADR-0266-s5-presence-values-and-open-requests-resolved-by-delegation.md](ADR-0266-s5-presence-values-and-open-requests-resolved-by-delegation.md) | S-5 presence values and the other open decision requests, resolved by delegation | superseded | ADR-0362 |
| 0362 | [ADR-0362-foreign-station-presence.md](ADR-0362-foreign-station-presence.md) | Foreign station presence — measurement, assignment, base limits, and penalties | accepted | — |
| 0363 | [ADR-0363-battle-offers.md](ADR-0363-battle-offers.md) | Battle offers — estimate, decline, enemy decline, and support force | accepted | — |

## Ship design & construction

The ship-designer model, its armour regions, named schemes, and the design draft schema.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0345 | [ADR-0345-ship-design-model-and-draft-schema.md](ADR-0345-ship-design-model-and-draft-schema.md) | Ship Design Model and Draft Schema | accepted | — |
| 0346 | [ADR-0346-ship-component-catalogue-and-capability-model.md](ADR-0346-ship-component-catalogue-and-capability-model.md) | Ship Component Catalogue and Capability Model | accepted | — |
| 0232 | [ADR-0232-armour-region-model-and-manual-parity.md](ADR-0232-armour-region-model-and-manual-parity.md) | Armour region model and manual parity | superseded | ADR-0345 |
| 0233 | [ADR-0233-designer-draft-schema-v2-and-canonical-vocabulary.md](ADR-0233-designer-draft-schema-v2-and-canonical-vocabulary.md) | Designer draft-schema v2 and canonical vocabulary | superseded | ADR-0345 |
| 0243 | [ADR-0243-design-edits-are-guarded-by-the-design-session.md](ADR-0243-design-edits-are-guarded-by-the-design-session.md) | Every design edit is guarded in the design session, and a newly broken design is explained at once | superseded | ADR-0345 |
| 0252 | [ADR-0252-designer-options-magazine-box-aluminium-superstructure-and-aa.md](ADR-0252-designer-options-magazine-box-aluminium-superstructure-and-aa.md) | Magazine box, aluminium superstructure and AA fit are additive designer options with provisional values | superseded | ADR-0345 |
| 0309 | [ADR-0309-e1-part-families-and-capability-kinds.md](ADR-0309-e1-part-families-and-capability-kinds.md) | E-1 part families and capability kinds for radar, sonar, ASW, AA, missiles and hangars | superseded | ADR-0346 |
| 0311 | [ADR-0311-fire-control-radar-gunnery-factor-and-blind-fire.md](ADR-0311-fire-control-radar-gunnery-factor-and-blind-fire.md) | Fire-control radar sets the gunnery radar factor, and level 3 allows blind fire | superseded | ADR-0346 |
| 0332 | [ADR-0332-e1-1940s-battleship-and-16-inch-gun-values.md](ADR-0332-e1-1940s-battleship-and-16-inch-gun-values.md) | E-1 1940-1949 battleship and 16-inch gun values | superseded | ADR-0346 |
| 0333 | [ADR-0333-split-ship-component-catalogue-by-nation.md](ADR-0333-split-ship-component-catalogue-by-nation.md) | Split the ship-component catalogue by family and nation, with per-record source provenance | superseded | ADR-0346 |

## World map

How the presentation-only strategic map's baked geography is produced.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0344 | [ADR-0344-world-map-geography-and-globe.md](ADR-0344-world-map-geography-and-globe.md) | World map geography, data pipeline and globe rendering | accepted | — |
| 0244 | [ADR-0244-nation-borders-are-clipped-to-the-map-coastline.md](ADR-0244-nation-borders-are-clipped-to-the-map-coastline.md) | Nation borders are baked clipped to the map's coastline | superseded | ADR-0344 |
| 0323 | [ADR-0323-geographic-data-sources-and-protected-overlays.md](ADR-0323-geographic-data-sources-and-protected-overlays.md) | Geographic data sources and protected-feature overlays | superseded | ADR-0344 |
| 0324 | [ADR-0324-edge-semantics-offline-tiling-and-renderer-boundaries.md](ADR-0324-edge-semantics-offline-tiling-and-renderer-boundaries.md) | Edge semantics, offline tiling and renderer boundaries | superseded | ADR-0344 |
| 0325 | [ADR-0325-production-globe-adapter-and-dynamic-overlay-contract.md](ADR-0325-production-globe-adapter-and-dynamic-overlay-contract.md) | Production globe adapter and dynamic overlay contract | superseded | ADR-0344 |
| 0326 | [ADR-0326-globe-adapter-interaction-parity.md](ADR-0326-globe-adapter-interaction-parity.md) | Globe adapter interaction parity and projection mapping | superseded | ADR-0344 |
| 0327 | [ADR-0327-globe-overview-production-enablement.md](ADR-0327-globe-overview-production-enablement.md) | Globe overview production enablement | superseded | ADR-0344 |
| 0329 | [ADR-0329-land-climate-zones-baked-from-koppen-geiger.md](ADR-0329-land-climate-zones-baked-from-koppen-geiger.md) | Land climate zones are baked from Köppen-Geiger V3 | superseded | ADR-0344 |

## Engine architecture

Package interfaces, seams and module depth across the engine.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0358 | [ADR-0358-combat-engine-architecture.md](ADR-0358-combat-engine-architecture.md) | Combat engine architecture | accepted | — |
| 0359 | [ADR-0359-phase-engine-and-event-architecture.md](ADR-0359-phase-engine-and-event-architecture.md) | Phase-engine and event architecture | accepted | — |
| 0360 | [ADR-0360-desktop-ipc-and-process-boundary-architecture.md](ADR-0360-desktop-ipc-and-process-boundary-architecture.md) | Desktop IPC and process boundary architecture | accepted | — |
| 0361 | [ADR-0361-deprecate-yaml-outside-internationalization.md](ADR-0361-deprecate-yaml-outside-internationalization.md) | Deprecate YAML outside internationalization | accepted | — |
| 0271 | [ADR-0271-combat-package-exposes-three-verbs-and-subsystem-seams.md](ADR-0271-combat-package-exposes-three-verbs-and-subsystem-seams.md) | The combat package exposes three verbs and subsystem seams | superseded | ADR-0358 |
| 0272 | [ADR-0272-month-pipeline-owns-order-and-observed-access.md](ADR-0272-month-pipeline-owns-order-and-observed-access.md) | The month pipeline owns phase order and observes real snapshot access | superseded | ADR-0359 |
| 0273 | [ADR-0273-shared-command-contract-split-by-concern.md](ADR-0273-shared-command-contract-split-by-concern.md) | The shared command contract is split by concern | superseded | ADR-0360 |
| 0276 | [ADR-0276-ui-state-writes-are-field-patches-merged-in-main.md](ADR-0276-ui-state-writes-are-field-patches-merged-in-main.md) | UI-state writes are field patches merged once, in main | superseded | ADR-0360 |
| 0277 | [ADR-0277-exact-duplicate-pure-helpers-live-in-core.md](ADR-0277-exact-duplicate-pure-helpers-live-in-core.md) | Exact-duplicate pure helpers live in combat core | superseded | ADR-0358 |
| 0294 | [ADR-0294-event-body-types-derive-from-schemas.md](ADR-0294-event-body-types-derive-from-schemas.md) | Event body types derive from their Effect schemas | superseded | ADR-0359 |
| 0306 | [ADR-0306-campaign-projections-carry-explanation-trees.md](ADR-0306-campaign-projections-carry-explanation-trees.md) | Campaign projections may carry explanation trees; `@bluewave/events` moves to layer 4 | superseded | ADR-0359 |
| 0308 | [ADR-0308-e1-compiled-design-capabilities-reach-combat.md](ADR-0308-e1-compiled-design-capabilities-reach-combat.md) | Compiled design capabilities reach combat and are decoded strictly | superseded | ADR-0358 |
| 0312 | [ADR-0312-surface-to-surface-missile-combat-module.md](ADR-0312-surface-to-surface-missile-combat-module.md) | Surface-to-surface missile salvos are a deterministic combat module | superseded | ADR-0358 |
| 0320 | [ADR-0320-electron-shell-navigation-permission-and-csp-policy.md](ADR-0320-electron-shell-navigation-permission-and-csp-policy.md) | Electron shell navigation, permission and CSP policy | superseded | ADR-0360 |
| 0321 | [ADR-0321-division-order-model.md](ADR-0321-division-order-model.md) | Divisions receive a versioned order model, with stance as a lossless preset | superseded | ADR-0358 |
| 0322 | [ADR-0322-realism-order-permission-matrix.md](ADR-0322-realism-order-permission-matrix.md) | Realism modes gate battle orders in the engine, not in the UI | superseded | ADR-0358 |
| 0328 | [ADR-0328-desktop-ipc-channels-derive-from-a-shared-contract.md](ADR-0328-desktop-ipc-channels-derive-from-a-shared-contract.md) | Desktop IPC channels are declared once in a shared contract | superseded | ADR-0360 |
| 0334 | [ADR-0334-deprecate-yaml-outside-internationalization.md](ADR-0334-deprecate-yaml-outside-internationalization.md) | Deprecate YAML outside internationalization | superseded | ADR-0361 |
| 0369 | [ADR-0369-formation-keeping-follows-the-flagship-track.md](ADR-0369-formation-keeping-follows-the-flagship-track.md) | Divisions keep formation by following the flagship's track, behind an optional input | accepted | — |

## Archive

0 records retained for provenance (older or absorbed decisions).
They stay on disk and searchable, but are not part of the active index; find
them with titles and links in [archive/README.md](archive/README.md).
