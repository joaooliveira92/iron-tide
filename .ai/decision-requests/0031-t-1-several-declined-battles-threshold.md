# Decision Request: T-1 meaning of "several" declined battles (G4)

## Status

Resolved (2026-10-21) by owner delegation: **Option C**, recorded as
[ADR-0254](../../docs/adr/ADR-0254-t1-battle-offer-values-balance-targets.md). The
value is a labelled `BALANCE_TARGET`; ticket #118 is no longer blocked on it.

## Trigger

R9 needs a threshold, a counter scope and a reset or decay. The manual uses the word "several" only. The three sub-values form one coupled group: the threshold is meaningless without the scope and reset.

## Evidence

- Manual p.67: "may cost prestige after several declined battles".
- No page defines "several" in this context, a scope (war, nation, campaign), or a reset.
- Research note: `docs/research/t-1-battle-offer-values.md` (provenance table, verbatim quotations).
- Spec #109 (R2), ticket #110; map #96 and decision tickets #97-#108.
- Prior art: ADR-0210, ADR-0213, ADR-0223, ADR-0226, ADR-0239; decision requests 0003, 0006, 0007, 0012.

## Why agent judgment is insufficient

A threshold of 2 versus 5, or a per-war versus per-campaign scope, changes when prestige is lost and whether peace resets it. Provenance class: STRUCTURE ONLY; all three UNSOURCED. The manual is silent, ADR-0210 forbids inventing values as fact, and spec #109 (R2, G1-G7) returns each such value to the owner individually. This is a gameplay balance number, not a routine local design choice.

## Options

### Option A: Owner supplies the value

- Behavior: the owner provides an integer threshold (>= 1), a scope (war, nation, campaign) and a reset rule (none, on war end, or a decay in count per stated months) with provenance (a manual page, another high-trust source, or a stated design intent).
- Advantages: authoritative and unambiguous.
- Risks: the owner may not hold the original data; the value may not exist in the source game.
- Compatibility impact: none until authored.
- Migration impact: none (no prior state).
- Scope and effort: authoring in ticket #118 plus an ADR if the choice diverges from RTW3.

### Option B: Keep the value dormant

- Behavior: the ruleset section stays absent (or, if partially authored, the compile rejects it) so no production battle-offer behaviour depends on this value; The counter and event are not configured; no threshold event is raised.
- Advantages: no unsourced value ships; the mechanics stay complete and tested against fixture-class values.
- Risks: the offer flow has no production effect; #118 and #119 stay blocked.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

### Option C: Admit as ADR-0213 `balance_adjustment`

- Behavior: the owner explicitly waives RTW3 fidelity for this value and admits an owner-chosen value as a labelled `balance_adjustment` ruleset constant with a recorded rationale (pattern of ADR-0223 and ADR-0239), never classed as manual. The owner chooses threshold, scope and reset; the counter itself remains an additive, monotonic persisted count.
- Advantages: unblocks #118 while staying honest about provenance.
- Risks: a deliberate divergence from the manual; must be tuned by the balance sweep.
- Compatibility impact: none until authored; authoring moves production behaviour and goldens once, at go-live.
- Migration impact: one golden re-pin at go-live per the golden repinning procedure.
- Scope and effort: an ADR plus authoring in #118.

## Recommendation

Option A if available, else Option C. Because the counter scope is hard to change after saves exist, decide it before go-live.

Minimum owner response: Choose an option; for A or C, the threshold, the scope and the reset.

## Work safely completed while blocked

The dormant mechanics (tickets #111 to #117) are specified and tested against labelled fixture-class values that never reach the production pack. Nothing is authored in production; #118 stays blocked on this decision.
