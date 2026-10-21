# Decision Request: T-1 support-force presence and composition (G7)

## Status

Resolved (2026-10-21) by owner delegation: **Option C**, recorded as
[ADR-0254](../../docs/adr/ADR-0254-t1-battle-offer-values-balance-targets.md). The
value is a labelled `BALANCE_TARGET`; ticket #118 is no longer blocked on it.

## Trigger

R12 needs a presence chance, a composition rule beyond the 50% cap, and an answer on whether the support force may include the player's own AI-controlled divisions rather than allies. The three sub-values are one coupled group.

## Evidence

- Manual p.67: "Sometimes there will be an additional friendly AI controlled support force present."
- Manual p.99: "Note that many battles have friendly forces that are not under player control. This is not affected by the realism setting."
- The 50% cap (`ALLIED_MAX_STRENGTH_BP = 5_000`) and candidate ordering are repo code in `packages/combat/src/generation/allied.ts`, not manual facts.
- No page gives a chance, a composition rule, or whether the force is allied or the player's own divisions.
- Research note: `docs/research/t-1-battle-offer-values.md` (provenance table, verbatim quotations).
- Spec #109 (R2), ticket #110; map #96 and decision tickets #97-#108.
- Prior art: ADR-0210, ADR-0213, ADR-0223, ADR-0226, ADR-0239; decision requests 0003, 0006, 0007, 0012.

## Why agent judgment is insufficient

Presence chance and source decide how often the player fights alongside others and whether alliances matter; own-AI divisions change which ships are reserved. Provenance class: STRUCTURE ONLY ("sometimes"); all values UNSOURCED. The manual is silent, ADR-0210 forbids inventing values as fact, and spec #109 (R2, G1-G7) returns each such value to the owner individually. This is a gameplay balance number, not a routine local design choice.

## Options

### Option A: Owner supplies the value

- Behavior: the owner provides the presence chance in basis points (0 to 10000), the composition share of the cap (0 to 5000 bp) and selection rule, and whether own AI-controlled divisions may form the support force with provenance (a manual page, another high-trust source, or a stated design intent).
- Advantages: authoritative and unambiguous.
- Risks: the owner may not hold the original data; the value may not exist in the source game.
- Compatibility impact: none until authored.
- Migration impact: none (no prior state).
- Scope and effort: authoring in ticket #118 plus an ADR if the choice diverges from RTW3.

### Option B: Keep the value dormant

- Behavior: the ruleset section stays absent (or, if partially authored, the compile rejects it) so no production battle-offer behaviour depends on this value; No support force is added.
- Advantages: no unsourced value ships; the mechanics stay complete and tested against fixture-class values.
- Risks: the offer flow has no production effect; #118 and #119 stay blocked.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

### Option C: Admit as ADR-0213 `balance_adjustment`

- Behavior: the owner explicitly waives RTW3 fidelity for this value and admits an owner-chosen value as a labelled `balance_adjustment` ruleset constant with a recorded rationale (pattern of ADR-0223 and ADR-0239), never classed as manual. The owner chooses the chance, composition and source.
- Advantages: unblocks #118 while staying honest about provenance.
- Risks: a deliberate divergence from the manual; must be tuned by the balance sweep.
- Compatibility impact: none until authored; authoring moves production behaviour and goldens once, at go-live.
- Migration impact: one golden re-pin at go-live per the golden repinning procedure.
- Scope and effort: an ADR plus authoring in #118.

## Recommendation

Option B until the owner supplies values; no value is recommended.

Minimum owner response: Choose an option; for A or C, the chance, the composition rule and the source (allied only or including own AI divisions).

## Work safely completed while blocked

The dormant mechanics (tickets #111 to #117) are specified and tested against labelled fixture-class values that never reach the production pack. Nothing is authored in production; #118 stays blocked on this decision.
