# Decision Request: S-5 presence penalty magnitudes (prestige, revolt pressure) and revolt trigger

## Status

Blocked pending owner decision.

## Trigger

R8 makes S-5 emit typed prestige-loss and revolt-pressure requests for a shortfall, but the magnitudes and the revolt trigger are not supplied by the manual and belong to S-2 and S-3 to consume. The three form one coupled group: the trigger defines what the pressure magnitude means.

## Evidence

- Manual p.46: "If the required number is not met, player prestige may suffer and it might even lead to revolts in the affected areas."
- Manual p.62: "Prestige loss is in most cases proportional"; unrest drivers listed there do not include presence shortfall; revolution is described for the nation in wartime, not per area.
- ADR-0239 (S-2 prestige balance targets) and ADR-0240 (S-3 unrest values) exclude presence; neither supplies a presence magnitude or an area-level revolt.
- Spec #73 R8: S-5 defines no consumer, magnitude resolution or revolt trigger.
- Research note: `docs/research/s-5-presence-and-base-limits.md` (provenance table; manual quotations and pages).
- Prior art: ADR-0210, ADR-0213, ADR-0223, ADR-0226, ADR-0239; decision requests 0007 and 0012.
- Spec #73 (R14), ticket #75.

## Why agent judgment is insufficient

Different choices change who is penalised, when, and by how much, and so every S-5 authoritative outcome and (once authored) the golden hashes. The manual is silent, ADR-0210 forbids inventing values as fact, and the S-5 spec (#73, Decision J, R14) returns each such value to the owner. Routine local design choice does not cover a gameplay balance number.

## Options

### Option A: Owner supplies the value

- Behavior: the owner provides the prestige-loss request magnitude (proportion of current prestige in basis points, or a count), the revolt-pressure request magnitude in S-3's unrest unit, and the revolt trigger (threshold or probability, per area), via S-2 and S-3 where they own the unit, with provenance (a manual page, another high-trust source, or a stated design intent).
- Advantages: authoritative and unambiguous.
- Risks: the owner may not hold the original data; the value may not exist in the source game.
- Compatibility impact: none until authored.
- Migration impact: none (no prior state).
- Scope and effort: authoring ticket plus an ADR if the choice is a divergence.

### Option B: Keep the value dormant

- Behavior: the penalty parameters (S-5 still emits the shortfall event; penalty requests are not emitted) stays absent; the S-5 ruleset section remains dormant or (if partially authored) the compile rejects it, so no production behaviour depends on it. Projection reports 'not configured'.
- Advantages: no unsourced value ships; mechanics stay complete and tested with fixtures.
- Risks: S-5 produces no production effect; the dependent value-bearing tickets stay blocked.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

### Option C: Admit as ADR-0213 `balance_adjustment`

- Behavior: the owner explicitly waives RTW3 fidelity for this value and admits an owner-chosen number as a labelled `balance_adjustment` ruleset constant with a recorded rationale (pattern of ADR-0223 and ADR-0239), never classed as `manual`. Prestige proportional loss could reuse S-2's proportional model, but only as an owner-chosen, labelled balance value, since ADR-0239 does not cover presence. The revolt trigger depends on a consumer S-3 does not yet define (blocked-S-2/S-3).
- Advantages: unblocks the dependent S-5 tickets while remaining honest about provenance.
- Risks: a deliberate divergence from the manual; the value must be tuned by the balance sweep.
- Compatibility impact: none until authored; authoring is the one change that moves production behaviour and goldens (R14).
- Migration impact: one deliberate same-commit golden re-pin when authored.
- Scope and effort: one ADR and the authoring ticket.

## Recommendation

Option B until S-2 and S-3 expose a consumer, then Option A or C; the magnitudes cannot sensibly be chosen before the unit and the trigger exist. Do not implement, author or default any of these values before the owner chooses.

## Work safely completed while blocked

- The research note `docs/research/s-5-presence-and-base-limits.md` with the provenance table.
- Mechanics in the S-5 tickets can be built and tested against labelled fixture-class rulesets; the optional ruleset section stays dormant (R11), so no production behaviour or golden changes.
