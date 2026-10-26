# Story 49 batch: area explanation trees (#300–#303)

Branch `feat/story-49-area-explanations`, commit `50610956` (with the phase-engine
assertion fix in the follow-up commit). Story 49 is partly delivered: four of the six
area tickets now carry domain-built explanation trees on the production screens.

## Delivered

| Issue | Area         | Tree fields                                                                                                      | Formulas                                                                      |
| ----- | ------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| #300  | Economy      | `PlayerProjectionEconomy.netExplanation`, `monthEndExplanation`, `runwayExplanation`, `appropriationExplanation` | `economy_net`, `economy_month_end`, `economy_runway`, `economy_appropriation` |
| #303  | Research     | `ResearchScreenProjection.budgetExplanation`, `capExplanation`, `floorExplanation`                               | `research_budget`, `research_cap`, `research_floor`                           |
| #302  | Construction | `ConstructionProjectReadoutView.scheduleExplanation`                                                             | `construction_schedule` (months left = work remaining ÷ monthly instalment)   |
| #301  | Fleet        | `PlayerProjectionPresenceArea.shortfallExplanation`                                                              | `fleet_presence` (required − present, with a recorded blockade exemption)     |

Each tree is built by the same calculation that produces the displayed value:

- `EconomyOutlook` now returns `settlement` (the paid carrying, construction, maintenance,
  obligations and research amounts the outlook books). The month-end tree sums exactly
  those amounts, so its result equals `monthEndTreasury`.
- The projected net tree uses the same revenue, obligations, maintenance and planned
  research the outlook returns.
- The runway tree divides treasury by the monthly deficit and exists only while the
  treasury shrinks.
- The research cap and floor reuse the engine's 12% cap and 8% guidance share; the budget
  tree shows the requested budget and books the unfunded part when no field is eligible.
- The construction tree divides the work remaining by the monthly instalment readout.
- The fleet shortfall tree subtracts present tonnage from required tonnage and adds the
  blockade exemption line when the requirement is suspended.

## Rendering

One helper (`explanationLabelKey`) and one model (`explanationModel`) live in
`apps/desktop/src/renderer/lib/explanation.ts`; the generic
`ExplanationDisclosure` renders any area's tree with `<area>.<formula>.<node>` labels and
presentation-formatted values. The battle accuracy model now imports the same helper.

The manifest ratchet in `scripts/data/explanation-coverage.json` moved from 2.07% (4/193)
to 6.40% (13/203). The ADR-0304 amendment records the four slices and the remaining
exemptions.

## Evidence

- Domain tests: `campaign-engine/test/economy-explanations.test.ts`,
  `research-screen-projection.test.ts`, `construction.test.ts`, `fleet.test.ts`,
  `projection.test.ts`; `phase-engine/test/construction-readout.test.ts`.
- Renderer tests: `lib/explanation.test.ts`, `components/shared/ExplanationDisclosure.test.tsx`
  (includes axe), treasury, research, construction and fleet screen tests.
- Focused runs: `@bluewave/campaign` 1105 tests, `@bluewave/campaign-engine` 163 tests,
  151 desktop renderer/main test files (1115 tests), `pnpm preflight` 49/49.
- `pnpm snap` evidence (git-ignored under `apps/desktop/.dev-data/story49/`):
  `treasury/treasury-explanation-open.png` (net before construction, four lines),
  `research/research-explanation-open.png` (paid budget and cap),
  `construction/construction-explanation-open.png` (ready in 20 months, work remaining 40,
  work per month 2), `fleet/fleet-presence-explanation.png` (shortfall 1,050 tons, required
  and present tonnage).

## Not delivered

- **#304 diplomacy, war, prestige and priorities.** The displayed numbers are state
  aggregates (tension, accumulated war score, accumulated prestige) or text priorities;
  the view contracts carry no replayable formula to explain them. A tree would have to be
  invented, which AGENTS.md forbids. The next step is a decision on which engine
  calculation to expose (for example the prestige last-change sources or the battle
  score contributions) before the area can be explained honestly.
- **#306 turn reports and messages.** The report contracts are text-first; the numeric
  fields are totals of events already explained elsewhere. It needs the same decision
  before a tree can be built.

Story 49 therefore remains open; the two remaining area tickets keep their manifest
exemptions and their issue references.
