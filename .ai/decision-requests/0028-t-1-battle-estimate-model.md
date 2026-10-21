# Decision Request: T-1 battle estimate model (G1)

## Status

Resolved (2026-10-21) by owner delegation: **Option C**, recorded as
[ADR-0254](../../docs/adr/ADR-0254-t1-battle-offer-values-balance-targets.md). The
value is a labelled `BALANCE_TARGET`; ticket #118 is no longer blocked on it.

## Trigger

Spec #109 R5 needs an estimate model for the enemy-strength figure shown on a battle offer, but the manual supplies none. Coupled sub-values: model kind, granularity or error, and whether composition is shown.

## Evidence

- Manual p.67: "You will be presented with a screen with a force estimate of enemy strength, where you have the option to accept or decline battle."
- Manual p.64: intelligence "will reduce the risk that your ships will be facing unexpected battles that cannot be avoided" and "The information you can see about ships belonging to other nations is restricted"; neither describes the offer screen's accuracy.
- No page gives an error, banding, granularity or composition rule (full-text search of all 148 pages).
- Research note: `docs/research/t-1-battle-offer-values.md` (provenance table, verbatim quotations).
- Spec #109 (R2), ticket #110; map #96 and decision tickets #97-#108.
- Prior art: ADR-0210, ADR-0213, ADR-0223, ADR-0226, ADR-0239; decision requests 0003, 0006, 0007, 0012.

## Why agent judgment is insufficient

Exact, banded or perturbed estimates give players different information, change when declining is rational, and so change outcomes and (when perturbed) the random ledger. A perturbed model also adds a stream. Provenance class: STRUCTURE ONLY; model UNSOURCED. The manual is silent, ADR-0210 forbids inventing values as fact, and spec #109 (R2, G1-G7) returns each such value to the owner individually. This is a gameplay balance number, not a routine local design choice.

## Options

### Option A: Owner supplies the value

- Behavior: the owner provides the model kind (exact, banded, perturbed), its band width or error bound in basis points, the rounding mode, and whether composition is shown with provenance (a manual page, another high-trust source, or a stated design intent).
- Advantages: authoritative and unambiguous.
- Risks: the owner may not hold the original data; the value may not exist in the source game.
- Compatibility impact: none until authored.
- Migration impact: none (no prior state).
- Scope and effort: authoring in ticket #118 plus an ADR if the choice diverges from RTW3.

### Option B: Keep the value dormant

- Behavior: the ruleset section stays absent (or, if partially authored, the compile rejects it) so no production battle-offer behaviour depends on this value; Projection reports no estimate model configured.
- Advantages: no unsourced value ships; the mechanics stay complete and tested against fixture-class values.
- Risks: the offer flow has no production effect; #118 and #119 stay blocked.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

### Option C: Admit as ADR-0213 `balance_adjustment`

- Behavior: the owner explicitly waives RTW3 fidelity for this value and admits an owner-chosen value as a labelled `balance_adjustment` ruleset constant with a recorded rationale (pattern of ADR-0223 and ADR-0239), never classed as manual. The owner chooses the kind and parameters; an exact estimate is the minimal-information option but is still an owner choice and not a manual fact.
- Advantages: unblocks #118 while staying honest about provenance.
- Risks: a deliberate divergence from the manual; must be tuned by the balance sweep.
- Compatibility impact: none until authored; authoring moves production behaviour and goldens once, at go-live.
- Migration impact: one golden re-pin at go-live per the golden repinning procedure.
- Scope and effort: an ADR plus authoring in #118.

## Recommendation

Option A if the owner holds the RTW3 behaviour, otherwise Option C with an explicit waiver. Do not default to exact: that is itself a value.

Minimum owner response: Choose an option; for A or C, the model kind, its parameters and whether composition is shown.

## Work safely completed while blocked

The dormant mechanics (tickets #111 to #117) are specified and tested against labelled fixture-class values that never reach the production pack. Nothing is authored in production; #118 stays blocked on this decision.
