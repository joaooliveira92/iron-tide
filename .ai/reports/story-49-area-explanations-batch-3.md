# Story 49 batch 3: prestige change and priority advice

Branch `feat/story-49-area-explanations-2` (continues batch 2). Finishes the strategic area's honest
provenance without inventing trees from accumulated totals.

## Delivered

| Issue | Area       | Change                                                                                                                                                                                      |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #304  | Prestige   | `PrestigeLastChange` records `appliedRule`, `unclampedAfter` and `bounds`; `PlayerProjectionPrestige.changeExplanation` carries `prestige_change`; the status-strip prestige card shows it. |
| #285  | Priorities | `StrategicPriority.advice` carries the player-readable sentence; the briefing hover shows it before the `reason` trace, and the overview card includes both in its tooltip.                 |

## Prestige provenance

- `applyPrestigeRuleDetail` computes the target on the same path as `applyPrestigeRule`; the authoritative writer
  stores the rule, the unclamped target and the bounds on the last change.
- The tree is `before + rule line + clamp line = after`. Its result equals the stored `after`; the clamp line is
  present only when the rule would leave the bounds. An old last change (recorded before these fields) has no
  disclosure rather than a guessed one.
- Additive optional fields, so old saves decode unchanged and no compatibility bump is needed (ADR-0281
  precedent). A month that applies prestige hashes differently because its state now carries the rule; the
  Adriatic-war replay was re-recorded and approved as `SERIALIZATION_ONLY`. Goldens and other replays are unchanged.

## Priorities provenance

Priorities are projections and monthly-report sidecar entries; they are not part of an authoritative snapshot or
golden hash. The advice sentence is engine text next to the existing trace, not a numeric explanation tree.

## Coverage

`scripts/data/explanation-coverage.json` moves from 19/211 (9.04%) to 20/211 (9.47%); every remaining strategic
field carries a reasoned exemption (war score and tension await a contribution record; accumulated totals and
ranking keys are not derived).

## Evidence

- Domain: `campaign/test/prestige.test.ts`; `campaign-engine/test/prestige-explanations.test.ts`,
  `projection-prestige.test.ts`, `priorities.test.ts`; `phase-engine/test/prestige-unpaid-funds.test.ts`.
- Renderer/main: `StatusStrip.test.tsx`, `status-strip-state.test.ts`, `PrioritiesCard.test.tsx`,
  `HeaderSecondaryRow.test.tsx`, `campaignCommandSchemas.test.ts`.
- Replay: Adriatic war re-recorded and approved; `check:replay-approvals` green.
- `pnpm check:golden` unchanged.
