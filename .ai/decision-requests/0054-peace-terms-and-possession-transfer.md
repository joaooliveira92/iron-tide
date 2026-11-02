# Decision Request: Peace terms and possession transfer

## Status

Partially accepted. The owner accepted the recommendations for questions 1 to 5 as written in Recommendation. Question 6 (area controller versus possessions) is open. Blocks GitHub issue #165; sub-ticket #481 is this decision; #482 to #485 follow it.

## Trigger

Peace exists but carries no terms. AcceptPeace (packages/phase-engine/src/diplomacy.ts:147) ends the war and resets the two principals' relation to neutral. WarDeclaration (packages/campaign/src/state.ts:229) already stores attackerWarScore and defenderWarScore, but nothing uses them at war end. Earlier request 0027 was resolved as "defer" in ADR-0266, and its file does not exist. This request supersedes the premise that no war-termination mechanic exists: the mechanic exists, but it has no terms.

Transfer changes who holds which areas, so the owner must answer five questions before implementation:

1. Is war score the currency for demands, and who sets the cost per possession? Options: war score is spent against a per-possession cost; a fixed, content-defined list per war with no war score; war score only gates which possessions may be demanded.
2. Can the loser refuse, and how does the AI decide? Options: refusal is always allowed; refusal is allowed only below a war-score threshold; terms are imposed without refusal.
3. Protection rule: may a possession located in the nation's homeAreaId be ceded? Options: protected; unprotected; protected plus an owner-chosen list.
4. Fleets stationed in a ceded area: what happens to them? Options: repositioned by an explicit rule; destroyed; cession blocked while fleets are present.
5. Scope: is transfer outside a war (purchase) in scope? Options: out of scope; in scope now.

## Evidence

- Peace and war: packages/phase-engine/src/diplomacy.ts:147 (AcceptPeace); packages/campaign/src/state.ts:229 (WarDeclaration war scores).
- Possessions: state.ts:538 (PossessionData {id, nationId, areaId}); packages/campaign/src/presence.ts:4 (presenceAreaIds derives presence from possessions).
- Home area: state.ts:393 (NationState.homeAreaId). Possessions and home area are separate concepts, and the protection rule depends on keeping them apart.
- Fleets: state.ts:65 (FleetState.locationAreaId).
- Verified: AreaData.controller (state.ts:557) is a per-area holder id that the UI reads as ownership (campaign-engine projection.ts:249, opening-briefing.ts:123, world-map.ts:68; renderer campaign-map-join.ts:56,92, area-tree.ts:43,50, status-strip-state.ts:323,339, StatusStripCards.tsx:636 "Held by"). It is authored in content/production/1880/areas.ts, copied at build time by worldCompilation.ts:53, and never written at runtime. Possessions are per-port entries {id, nationId, areaId}. The two overlap in meaning but are not linked.
- Prior record: request 0027 "defer" in ADR-0266; its file is absent.

## Why agent judgment is insufficient

Each question changes gameplay and player-facing outcomes. Question 1 decides whether war score becomes a currency and what a war is worth. Question 2 decides whether players can refuse terms or whether the AI can impose them. Question 3 decides which territories are untouchable. Question 4 decides whether fleets are lost, moved, or block a deal. Cost and threshold values are balance decisions, so they belong to the owner as content data marked PROVISIONAL, not to the agent. Stop condition: plausible interpretations change gameplay.

## Options

The three options below are overall shapes. The five questions are answered within them.

### Option A: Priced terms from war score

- Behavior: at war end, the winner spends war score to demand possessions from an authored list. Each possession has a cost to be set by the owner, PROVISIONAL. Protected areas are excluded.
- Advantages: reuses the existing war score fields; outcomes scale with war performance.
- Risks: the war score scale is not yet defined; balance tuning is needed; the AI decision logic is new.
- Compatibility impact: AcceptPeace gains terms. The change needs a versioned schema and a parity test against existing fixtures.
- Migration impact: existing saves have no terms, so nothing transfers on load.
- Scope and effort: largest. Touches diplomacy, campaign state, AI, and fleets.

### Option B: Fixed content-defined cessions

- Behavior: each war declaration carries an authored list of possessions that transfer on a winning peace. No war score is spent. Consent rules from question 2 still apply.
- Advantages: deterministic and easy to review in content; introduces no new currency.
- Risks: the war score fields stay unused; less responsive to war play; content must be authored for every war.
- Compatibility impact: WarDeclaration gains a content reference. War score fields are unchanged.
- Migration impact: old wars have no list, so nothing transfers.
- Scope and effort: medium. Content authoring plus AcceptPeace terms.

### Option C: Defer transfer

- Behavior: AcceptPeace stays as it is. Issue #165 remains blocked until a later decision.
- Advantages: no gameplay change; no compatibility risk.
- Risks: possession transfer stays unavailable; the war score fields stay unused.
- Compatibility impact: none. Migration impact: none.
- Scope and effort: none now.

## Recommendation

Option A, with these answers, subject to owner approval.

(1) War score is the currency. The per-possession cost is owner-set content data, PROVISIONAL.
(2) The loser may refuse. The AI decides by comparing war scores against an owner-set threshold, PROVISIONAL.
(3) Protected. A possession located in homeAreaId cannot be ceded. The check runs when terms are created and again when they are accepted.
(4) Fleets are never deleted. An explicit repositioning rule moves them. The recommended destination is the loser's home area, which is always protected and so always held.
(5) Out of scope. Purchase needs its own decision.

Question 6 (open). Transfer moves a possession, but the UI shows area ownership from controller, which transfer would leave stale. Options: (i) controller is derived from possessions after a transfer: an area belongs to the nation holding all of its possessions, and stays with the previous holder when split; (ii) a cession term names a whole area and rewrites controller and every possession in it; (iii) controller stays authored and the UI is changed to read possessions. Recommendation: (ii), because the player demands areas in the UI, a split area has no clean owner to display, and it needs no derivation rule. Ticket #483 must not start until the owner answers.

Do not implement the disputed behavior before approval.

## Work safely completed while blocked

- The cited paths and lines were taken from the verified facts in the task brief. No code was changed.
- This decision request is the only file written.
- Issue #165 and sub-tickets #482 to #485 were left untouched.
- No terms, costs, thresholds, or fleet rules were implemented.
