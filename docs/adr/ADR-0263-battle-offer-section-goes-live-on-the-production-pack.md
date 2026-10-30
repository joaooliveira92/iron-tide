# ADR-0263: The battle-offer section goes live on the production pack

Applies to: content

## Status

Superseded by: ADR-0363

Accepted (2026-10-21). Implements ticket
[#118](https://github.com/joaooliveira92/iron-tide/issues/118) (T-1 09) of spec
[#109](https://github.com/joaooliveira92/iron-tide/issues/109), R1, R2, R15 and R16. The values are the
owner-authorized balance targets of [ADR-0254](ADR-0254-t1-battle-offer-values-balance-targets.md); the section shape is
[ADR-0253](ADR-0253-battle-offer-ruleset-section-player-nation-input-and-offer-response.md) and the prestige sub-rule is
[ADR-0262](ADR-0262-repeated-declines-cost-the-player-prestige.md).

## Decision

1. **The section is authored in `content/production/1880/rulesets.yaml`**, on the `core` ruleset, with every ADR-0254 value
   (G1 to G7 and the G5 sub-rule) and its own `BALANCE_TARGET` / `balance_adjustment` provenance citing ADR-0254. No value is
   defaulted in code, and the pack carries no fixture-class value (a cross-process test asserts it).
2. **One value is structural, not a decision.** The section shape requires `declineVictoryPoints.rounding`. ADR-0254 gives no
   rounding for G2 because the cost is a whole number of points. It is authored `HALF_UP`, the one rounding ADR-0254 does
   state (G1), and is inert: it rounds only a fractional opponent credit, and G3 is `NONE`. Changing it moves no outcome.
3. **The player-facing strings move into the compiled catalogue** (`ui/en-US.yaml`): the offer dialog, the decline
   statements, `messages.battle.declined`, `declineThreshold` and `enemyDeclined`, `ui.offer.support.presentFrom`, and
   `messages.prestige.changed` (S-2). The renderer reads them through the catalogue seam; the renderer-local copies are
   removed. The S-2 `PrestigeChanged` message is generic over the reason code, so `DECLINED_BATTLE` needs no new string.
4. **Removing the section returns the pack to dormant behaviour.** The desktop reads the section from the compiled artifact;
   without it no offer is raised and the pre-existing battle request runs unchanged.

## Compatibility and goldens

- The content hash moves (a ruleset section and strings are authored); the content lock is refreshed. No schema, wire format
  or compatibility version changes.
- `golden/hashes.json` does not move: its proof compiles a synthetic inline fixture, not the production pack.
- The ten production replays move only in `contentHash`; every checkpoint hash is unchanged, so no replay approval is needed
  and peacetime months are byte-identical with the section configured. Saves gain battle-offer state only when a decline
  happens (additive optional fields, ADR-0256, ADR-0257), so no migration is needed.
- Tuning any value is a ruleset version change with a content-lock refresh (ADR-0254).
