# Decision Request: T-1 declined-battle prestige rule (G5)

## Status

Resolved (2026-10-21) by owner delegation: **Option C**, recorded as
[ADR-0254](../../docs/adr/ADR-0254-t1-battle-offer-values-balance-targets.md). The
value is a labelled `BALANCE_TARGET`; ticket #118 is no longer blocked on it.

## Trigger

R10 maps the threshold event to a prestige loss through the S-2 seam. The rule kind and amount are not in the manual and ADR-0239 does not cover declined battles. This request is limited to the declined-battle rule within the S-2 value-set shape; it does not revisit any S-2 value.

## Evidence

- Manual p.67: "may cost prestige after several declined battles".
- Manual p.62: "Prestige loss is in most cases proportional, which means that if you have high prestige, you will lose more of it on an event that results in prestige loss."
- ADR-0239: sources are battle lost (500 bp) and funds unpaid (300 bp), battle won +1; declined battles are not listed and no amount is decided.
- Spec #74 (S-2): closed reason-code vocabulary and per-source rule entry; T-1 adds one reason code and one rule.
- Research note: `docs/research/t-1-battle-offer-values.md` (provenance table, verbatim quotations).
- Spec #109 (R2), ticket #110; map #96 and decision tickets #97-#108.
- Prior art: ADR-0210, ADR-0213, ADR-0223, ADR-0226, ADR-0239; decision requests 0003, 0006, 0007, 0012.

## Why agent judgment is insufficient

Proportional versus fixed, and the amount, change the prestige trajectory and the sacking risk. "In most cases" does not say declines are proportional. Provenance class: STRUCTURE ONLY (a cost exists; p.62 is general); kind and amount UNSOURCED. The manual is silent, ADR-0210 forbids inventing values as fact, and spec #109 (R2, G1-G7) returns each such value to the owner individually. This is a gameplay balance number, not a routine local design choice.

## Options

### Option A: Owner supplies the value

- Behavior: the owner provides the rule kind (proportional bp of current prestige, or fixed points), the amount, and whether it applies once at the threshold or on each further decline with provenance (a manual page, another high-trust source, or a stated design intent).
- Advantages: authoritative and unambiguous.
- Risks: the owner may not hold the original data; the value may not exist in the source game.
- Compatibility impact: none until authored.
- Migration impact: none (no prior state).
- Scope and effort: authoring in ticket #118 plus an ADR if the choice diverges from RTW3.

### Option B: Keep the value dormant

- Behavior: the ruleset section stays absent (or, if partially authored, the compile rejects it) so no production battle-offer behaviour depends on this value; The counter and the threshold event are the whole effect (R10 allows this); no prestige change.
- Advantages: no unsourced value ships; the mechanics stay complete and tested against fixture-class values.
- Risks: the offer flow has no production effect; #118 and #119 stay blocked.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

### Option C: Admit as ADR-0213 `balance_adjustment`

- Behavior: the owner explicitly waives RTW3 fidelity for this value and admits an owner-chosen value as a labelled `balance_adjustment` ruleset constant with a recorded rationale (pattern of ADR-0223 and ADR-0239), never classed as manual. The owner may reuse the S-2 proportional model but the amount is an owner-chosen labelled balance value, since ADR-0239 does not cover it.
- Advantages: unblocks #118 while staying honest about provenance.
- Risks: a deliberate divergence from the manual; must be tuned by the balance sweep.
- Compatibility impact: none until authored; authoring moves production behaviour and goldens once, at go-live.
- Migration impact: one golden re-pin at go-live per the golden repinning procedure.
- Scope and effort: an ADR plus authoring in #118.

## Recommendation

Option B until 0031 is answered, since the rule depends on the threshold; then Option A or C. No amount is recommended.

Minimum owner response: Choose an option; for A or C, the kind, the amount and the repeat rule.

## Work safely completed while blocked

The dormant mechanics (tickets #111 to #117) are specified and tested against labelled fixture-class values that never reach the production pack. Nothing is authored in production; #118 stays blocked on this decision.
