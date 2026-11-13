# Decision Request: AI peace acceptance threshold

## Status

Resolved: Option A (margin rule) shipped in #554. The margin (`acceptanceScoreMargin`, 20) is PROVISIONAL and unsourced, and each AI decision records its reason code. The rule has no engine caller until #422; production areas author no `cessionCost` (see `docs/research/p5-peace-behaviour.md`).

## Trigger

Decision 0054 question 2 says the loser may refuse and the AI decides by comparing war scores against an owner-set threshold, PROVISIONAL. No threshold value, comparison form, or proposal rule exists. Inventing them would set balance.

## Evidence

- Decision 0054 recommendation (2).
- `WarDeclaration.attackerWarScore` / `defenderWarScore` (packages/campaign/src/state.ts).
- `AreaData.cessionCost` is the per-area price already in content (PROVISIONAL).
- No peace-proposal logic exists in packages/ai.

## Why agent judgment is insufficient

The threshold decides when the AI concedes territory and when it proposes peace. Different forms (absolute score, ratio, margin over cost) give different game outcomes.

## Options

### Option A: Margin rule

- Behavior: the AI accepts a term when its own war score minus the proposer's war score is at most a content value `acceptMargin`; it proposes status quo when `acceptMargin` is exceeded against it.
- Advantages: one number; integer arithmetic.
- Risks: scale of war score is undefined, so the value needs a balance report.
- Compatibility impact: new content field, no wire change. Migration impact: none. Scope: small.

### Option B: Cost-relative rule

- Behavior: the AI accepts a cede term only when the proposer's war score exceeds the term cost by at least `acceptSurplus`.
- Advantages: ties acceptance to the existing `cessionCost`.
- Risks: two numbers to tune. Compatibility and migration: as A. Scope: small.

### Option C: Defer AI behaviour

- Behavior: the AI never proposes and always refuses cede terms; #485 stays blocked.
- Advantages: no balance values invented.
- Risks: the feature is player-only. Scope: none.

## Recommendation

Option B, with `acceptSurplus` supplied by the owner as PROVISIONAL content, and the decision reason recorded on each AI response. Owner to supply the value or approve a placeholder.
