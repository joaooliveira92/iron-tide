# Brief: AI peace proposals (#777)

Gameplay change. Wires `decidePeaceProposal` and `decidePeaceResponse` (packages/ai) into the monthly engine.

## Decisions

- Rules are content: new ruleset section `peaceBehaviour` (`acceptanceScoreMargin` 20, `proposalChanceBp` 3000), PROVISIONAL, authored in `content/production/1880/rulesets.ts`. The code constant `PEACE_BEHAVIOUR` is gone. Removing the section returns the engine to today's behaviour. Margin 20 is the 0055 placeholder; acceptSurplus and cession costs stay unsourced (#708).
- Scope: only wars involving `playerNationId`, and only when the section is present (headless runs and the replay corpus are unchanged).
- Proposal: diplomacy phase, per ACTIVE player war, when `decidePeaceProposal` returns a term and no identical offer is pending, draw `diplomacy/peace_proposal/<warId>/<month>` against `proposalChanceBp`; every draw goes to the random ledger with the reason code.
- State: additive optional `wars.peaceOffers` (absent until first written, like `declineCounters`); no compat bump. An offer stays until the war ends or the AI rule no longer yields that term.
- Accept: `AcceptPeace` on a war with a pending offer applies the offer's term with the AI as proposer (CedeArea moves the area away from the player); with no offer it is today's unconditional peace.
- Refusal: when the section is present, a player `ProposePeace` is gated by `decidePeaceResponse`; a refusal raises `PEACE_REFUSED` with the reason code. The unconditional `AcceptPeace` loophole stays (follow-up).
- Production authors no `cessionCost`, so only StatusQuo offers arise there; CedeArea is covered by a fixture test.

## Reverse

Delete the `peaceBehaviour` block from the 1880 ruleset, refresh the lock and replays, set ledger row `accept-peace` back to dormant.
