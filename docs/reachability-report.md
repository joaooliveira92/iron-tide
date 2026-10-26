# Reachability report

Generated from `scripts/data/reachability-ledger.json` by `node scripts/verify-reachability-ledger.mjs --write`; do not edit.
Rules and statuses: ADR-0267.

| Status | Rows |
| --- | --- |
| reachable | 33 |
| dormant-by-decision | 12 |
| internal | 11 |

## Reachable

| Row | Player verb | Screen | Evidence |
| --- | --- | --- | --- |
| set-research-priority | Set a research priority for a technology field | `screens/research/ResearchScreen.tsx` | `apps/desktop/src/renderer/screens/research/ResearchScreen.test.tsx` |
| move-fleet | Order a fleet along a route, one hop a month | `screens/fleet/FleetScreen.tsx` | `apps/desktop/src/main/commands/fleetCommands.test.ts` |
| assign-station | Assign a fleet to a foreign station | `screens/fleet/station/FleetStationSection.tsx` | `apps/desktop/src/renderer/screens/fleet/station/useStationAssignment.test.tsx` |
| set-ship-readiness | Set a ship to active, reserve or mothballed | `screens/fleet/station/FleetStationSection.tsx` | `apps/desktop/src/renderer/screens/fleet/station/useStationAssignment.test.tsx` |
| fund-special-training | Fund up to two special-training subjects | `screens/fleet/training/FleetTrainingSection.tsx` | `apps/desktop/src/renderer/screens/fleet/training/FleetTrainingView.test.tsx` |
| hold-fleet-exercise | Hold the annual fleet exercise with chosen ships | `screens/fleet/exercise/FleetExerciseSection.tsx` | `apps/desktop/src/renderer/screens/fleet/exercise/FleetExerciseView.test.tsx` |
| organise-divisions | Create, change and dissolve divisions and pick flagships | `screens/fleet/organization/FleetOrganizationSection.tsx` | `apps/desktop/src/main/commands/divisionCommands.test.ts` |
| set-budget-allocation | Set the budget allocation across spending categories | `screens/treasury/TreasuryScreen.tsx` | `apps/desktop/src/renderer/screens/treasury/components/BudgetPolicyPanel.test.tsx` |
| submit-design | Draw a ship design and submit it for construction | `components/design-workspace/panels/SubmitPanel.tsx` | `apps/desktop/src/renderer/components/design-workspace/panels/SubmitPanel.test.tsx` |
| revise-project | Revise a ship project that is already ordered | `components/design-workspace/panels/RevisionPanel.tsx` | `apps/desktop/src/renderer/screens/construction/drawing-board/RevisionApply.test.tsx` |
| start-rebuild | Rebuild or convert an existing ship | `components/design-workspace/panels/RebuildPanel.tsx` | `apps/desktop/src/renderer/components/design-workspace/panels/RebuildPanel.test.tsx` |
| order-construction | Order, replace, cancel or batch-build ships and read the project queue | `screens/construction/ConstructionScreen.tsx` | `apps/desktop/src/renderer/screens/construction/hooks/useConstructionScreen.test.tsx` |
| halt-or-resume-construction | Halt or resume a construction project | `screens/construction/ConstructionScreen.tsx` | `apps/desktop/src/main/commands/constructionStatusCommands.test.ts` |
| accelerate-construction | Accelerate a construction project at a premium | `screens/construction/ConstructionScreen.tsx` | `apps/desktop/src/main/commands/constructionStatusCommands.test.ts` |
| authorize-dock-expansion | Authorize a dock expansion | `screens/construction/ConstructionScreen.tsx` | `apps/desktop/src/renderer/screens/construction/hooks/useConstructionScreen.test.tsx` |
| order-foreign-construction | Preview and place a ship order with a foreign builder | `screens/construction/components/ForeignContractPanel.tsx` | `apps/desktop/src/renderer/screens/construction/components/ForeignContractPanel.test.tsx` |
| cancel-construction-project | Cancel a construction project and take the refund | `screens/construction/ConstructionScreen.tsx` | `apps/desktop/src/main/commands/constructionStatusCommands.test.ts` |
| declare-war | Declare war on a nation | `screens/diplomacy/DiplomacyScreen.tsx` | `apps/desktop/src/renderer/screens/diplomacy/DiplomacyScreen.test.tsx` |
| accept-peace | Accept a peace settlement | `screens/diplomacy/DiplomacyScreen.tsx` | `apps/desktop/src/renderer/screens/diplomacy/DiplomacyScreen.test.tsx` |
| form-or-break-alliance | Form or break an alliance | `screens/diplomacy/DiplomacyScreen.tsx` | `apps/desktop/src/renderer/screens/diplomacy/DiplomacyScreen.test.tsx` |
| form-or-break-non-aggression-pact | Form or break a non-aggression pact | `screens/diplomacy/DiplomacyScreen.tsx` | `apps/desktop/src/renderer/screens/diplomacy/DiplomacyScreen.test.tsx` |
| declare-blockade | Declare a blockade of a nation in an area | `screens/diplomacy/DiplomacyScreen.tsx` | `apps/desktop/src/renderer/screens/diplomacy/DiplomacyScreen.test.tsx` |
| advance-month | Advance the campaign month and answer interruptions | `shell/App.tsx` | `apps/desktop/src/renderer/shell/useCampaignShell.test.ts` |
| fight-or-decline-battle | Accept or decline a battle offer and fight it with division stance and speed orders | `screens/battle/PlayerBattleScreen.tsx` | `apps/desktop/src/renderer/shell/App.test.tsx` |
| combat-fought-battle | Fight a battle: gunnery, spotting, contact, movement, weather, damage and torpedoes run under division stance and speed orders | `screens/battle/PlayerBattleScreen.tsx` | `apps/desktop/src/main/commands/battleOfferCommands.test.ts` |
| read-campaign-overview | Read the campaign overview | `screens/overview/OverviewScreen.tsx` | `apps/desktop/src/main/commands/inspectCampaign.test.ts` |
| read-world-map | Read the world map (Overview, F1 sheet, Fleet panel) | `components/world-map/WorldMapChart.tsx` | `apps/desktop/src/renderer/components/world-map/WorldMapChart.test.tsx` |
| read-battle-history | Read the battle history | `screens/diplomacy/components/BattleHistorySection.tsx` | `apps/desktop/src/renderer/screens/diplomacy/components/BattleHistorySection.test.tsx` |
| read-priorities | Read strategic priorities | `screens/overview/PrioritiesCard.tsx` | `apps/desktop/src/renderer/screens/overview/PrioritiesCard.test.tsx` |
| read-opening-briefing | Read the opening briefing | `screens/new-game/NewGameBriefingScreen.tsx` | `apps/desktop/src/renderer/screens/new-game/NewGameBriefingScreen.test.tsx` |
| start-new-game | Choose a nation and options and start a new campaign | `screens/new-game/NewGameLaunchingScreen.tsx` | `apps/desktop/src/renderer/screens/new-game/NewGameLaunchingScreen.test.tsx` |
| manage-campaign-files | Save, copy, close, load, verify, replay and recover a campaign | `screens/campaign-file/CampaignFileScreen.tsx` | `apps/desktop/src/renderer/screens/campaign-file/CampaignFileScreen.test.tsx` |
| persist-ui-state | Remember inspector layout, preferences and dismissed messages | `screens/campaign-preferences/CampaignPreferencesScreen.tsx` | `apps/desktop/src/main/uiState.test.ts` |

## Dormant by decision

| Row | Player verb | Decision |
| --- | --- | --- |
| assign-or-relieve-officer | Assign or relieve an officer | #224 |
| prestige | See and act on national prestige | #223 |
| division-battle-experience | Divisions gain experience from the battles they fight | #276 |
| ship-readiness | See and manage ship readiness | #223 |
| aircraft-and-carriers | Develop aircraft and operate carriers | ADR-0300 |
| combat-air-combat | Air combat and air defence in a battle | ADR-0300 |
| combat-carrier-operations | Carrier operations in a battle | ADR-0300 |
| combat-mines | Mine laying, sweeping and pressure | ADR-0300 |
| combat-submarines | Submarine operations | ADR-0300 |
| combat-coastal-defense | Coastal defence batteries and mine pressure | ADR-0300 |
| combat-smoke | Smokescreens and funnel smoke | ADR-0300 |
| debug-battle-sandbox | Generate, resolve and replay battles in the tactical sandbox and simulation screens | #226 |

## Internal

| Row | Capability | Commands |
| --- | --- | --- |
| budget-project-command | Budget a project (AI command only) | - |
| command-lifecycle-definitions | Command type definitions for budget, halt, resume and acceleration | - |
| design-studies | Design study bookkeeping | - |
| foreign-contract-monthly | Monthly foreign-contract, insight and war-policy steps | - |
| phase-engine-infrastructure | Errors, ledger, month pipeline and replay verification | - |
| combat-tactical-core | Tactical simulation loop, clock, targeting and battle generation | - |
| combat-battle-resolution | Battle resolution, auto-resolution, endings and ledger | - |
| combat-aircraft-model | Aircraft data model shared by air combat and carriers | - |
| combat-shared-support | Interface contract, error, reason-code and schema helpers | - |
| read-content-catalogues | Read drawing-board, presentation and UI catalogue content | `inspectDrawingBoardContent`, `inspectPresentationContent`, `inspectUiCatalogue` |
| debug-battle-drill-seed | Seed a campaign battle drill for end-to-end tests | `seedCampaignBattleDrill` |

