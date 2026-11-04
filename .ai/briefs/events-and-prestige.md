# Task brief: Every month asks the player something, and prestige is the score

```yaml
task:
  id: "#426, #428, #429, #223"
  objective: "A player advancing months meets monthly event dilemmas, answers them hawkish or dovish, and watches prestige change and threaten a sacking"
  repository: "joaooliveira92/iron-tide"
  target_branch: "dev"
  working_branch: "feat/events-and-prestige"
  worktree: ".worktrees/events-and-prestige"
  risk: "high"
  pull_request: null
  pr_authorized: false
  merge_authorized: false
  validation:
    - "pnpm verify:affected"
    - "pnpm preflight"
    - "pnpm test:scripts"
    - "pnpm check"
    - "pnpm snap (Seen)"
```

## Problem

A 25-year passive playthrough (Britain, 1880 to 1905) produced no events, prestige fixed at 20, a flat appropriation of 100, a treasury grown from 1,000 to 11,586 with nothing to spend it on, and "High foreign tension" warnings for 15 years with no consequence. The manual (Rule the Waves 3, "Events", "Prestige", "Object of the game") makes events the monthly rhythm and prestige the score and the sack condition. Today neither is reachable.

## Evidence

- Ledger `national-events` (#426): the diplomacy phase draws events and resolves AI and default answers, but the production pack authors no `events` or `eventResolution` section, so nothing fires. The dialog is #428 and the catalogue is #429.
- Ledger `prestige` (#223): the engine changes prestige in the monthly pipeline; the player sees only the header metric.
- `applyEventsForMonth`, `packages/phase-engine/src/eventDraw.ts:25-128`, returns early when `engineOptions.events` is missing or empty. Called from `runDiplomacyPhase`, `diplomacy.ts:459`. Content loader: `apps/desktop/src/main/shipBuildingContent.ts:150-167`. `content/production/1880` authors zero events.
- Prestige has three writers, none fire in a passive run: unpaid funds (`economyPhases.ts:588`), battle won/lost (`battlePhases.ts:162`), declined battle (`battleOffer.ts:527`). Sack check `sackingPhase.ts:66-85`, threshold 16, 1000 bp (`content/production/1880/rulesets.ts:12-16`).
- Interruption pattern to reuse: `packages/phase-engine/src/interruption.ts` (`suspend`, `consumeDecision`, `runInterruptionCheckpoint`), registered at `phases.ts:48`.
- Prestige display today: `renderer/shell/header/secondary-row/CampaignMetric.tsx`, `shell/status-strip/cards/PrestigeCard.tsx`, live from `campaign-engine/src/projection.ts:180-188`.
- Unverified: the hawkish/dovish effect schema in `@bluewave/campaign`. Read it first.

## Constraints and non-goals

- Determinism: event draw uses domain-separated RNG, integer maths. Expect golden movement; follow `docs/agents/golden-repinning.md` and stop if a hash moves without an understood cause.
- Wire formats frozen: any schema change needs a parity test from existing fixtures.
- Numbers (effect sizes, frequencies) live in content, marked PROVISIONAL.
- Not in scope: war, battle offers, peace (#422, #483, #484), national traits (#424), air and mines.
- Events are Europe-centric in the source game; author a modest catalogue, not a complete one.

## Acceptance criteria

1. A catalogue of at least 12 authored events with hawkish and dovish answers, each effect on budget, tension, prestige, or unrest declared in content (#429).
2. Advancing a month can suspend on an event dilemma; the dialog shows each answer's effect hint on hover and applies the choice; lapsing applies the default answer (#428). Follows `docs/agents/modal-guide.md`.
3. Prestige moves from event answers; the Overview and status strip explain every change (Explainable). Dropping to 16 or below can sack the player and end the campaign with a visible reason.
4. Reachability ledger rows `national-events` and `prestige` become `reachable` with evidence tests; `pnpm check:reachability-ledger` green.
5. A 36-month replay is hash-stable across runs; goldens repinned with a stated cause.
6. `pnpm snap` after 24 months shows at least one event answered and a prestige change.

## Approach

Tracer-bullet slices, in order:

1. Author one event end to end: content, loader, draw, dilemma suspension, dialog, answer applied, prestige delta displayed. Ledger rows flipped.
2. Fill the catalogue (#429) and tune frequencies in content.
3. Prestige explanation tree and sacking end state.
4. Golden repin and the 36-month regression.

## Rollback

Revert the branch; the content `events` section removed returns the engine to its early-return no-op, so campaigns behave as before.
