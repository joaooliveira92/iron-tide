# Decision Request: S-5 over-base maintenance and crew-quality effects

## Status

Resolved (2026-10-21) by owner delegation: **Option C**, recorded as
[ADR-0266](../../docs/adr/ADR-0266-s5-presence-values-and-open-requests-resolved-by-delegation.md).

## Trigger

R10 gives ships beyond the base limit "maintenance problems and reduced crew quality" through the S-1 constants seam. The manual states direction only; the maintenance adder and the crew-quality reduction (and their timing per month) are unsourced. The two effects are one consequence group.

## Evidence

- Manual p.45: "The number can be exceeded, but this may cause ships to suffer from maintenance problems and reduced crew quality." ("may": possibly non-deterministic).
- Manual p.48: `*` "needs maintenance".
- S-1: maintenance is a basis-point multiplier table and crew quality an integer 0 to 100 with ceilings and a ramp (`packages/campaign/src/maintenance.ts`, `readiness.ts`; ADR-0223); all of those magnitudes are themselves `balance_adjustment`.
- Research note: `docs/research/s-5-presence-and-base-limits.md` (provenance table; manual quotations and pages).
- Prior art: ADR-0210, ADR-0213, ADR-0223, ADR-0226, ADR-0239; decision requests 0007 and 0012.
- Spec #73 (R14), ticket #75.

## Why agent judgment is insufficient

Different choices change who is penalised, when, and by how much, and so every S-5 authoritative outcome and (once authored) the golden hashes. The manual is silent, ADR-0210 forbids inventing values as fact, and the S-5 spec (#73, Decision J, R14) returns each such value to the owner. Routine local design choice does not cover a gameplay balance number.

## Options

### Option A: Owner supplies the value

- Behavior: the owner provides the over-base maintenance adder (basis points of the S-1 rate, per month) and the crew-quality reduction (points on the 0 to 100 scale, per month), and whether the effect is certain or probabilistic, with provenance (a manual page, another high-trust source, or a stated design intent).
- Advantages: authoritative and unambiguous.
- Risks: the owner may not hold the original data; the value may not exist in the source game.
- Compatibility impact: none until authored.
- Migration impact: none (no prior state).
- Scope and effort: authoring ticket plus an ADR if the choice is a divergence.

### Option B: Keep the value dormant

- Behavior: the over-base effects (the `*` flag still displays but charges nothing) stays absent; the S-5 ruleset section remains dormant or (if partially authored) the compile rejects it, so no production behaviour depends on it. Projection reports 'not configured'.
- Advantages: no unsourced value ships; mechanics stay complete and tested with fixtures.
- Risks: S-5 produces no production effect; the dependent value-bearing tickets stay blocked.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

### Option C: Admit as ADR-0213 `balance_adjustment`

- Behavior: the owner explicitly waives RTW3 fidelity for this value and admits an owner-chosen number as a labelled `balance_adjustment` ruleset constant with a recorded rationale (pattern of ADR-0223 and ADR-0239), never classed as `manual`. If probabilistic, the owner must also supply a probability and the RNG stream rules would need an ADR; a deterministic effect is simpler.
- Advantages: unblocks the dependent S-5 tickets while remaining honest about provenance.
- Risks: a deliberate divergence from the manual; the value must be tuned by the balance sweep.
- Compatibility impact: none until authored; authoring is the one change that moves production behaviour and goldens (R14).
- Migration impact: one deliberate same-commit golden re-pin when authored.
- Scope and effort: one ADR and the authoring ticket.

## Recommendation

Option A or C, deterministic. Note the manual's "may" is a risk wording, not a probability; modelling it as certain is a reading the owner should confirm. Do not implement, author or default any of these values before the owner chooses.

## Work safely completed while blocked

- The research note `docs/research/s-5-presence-and-base-limits.md` with the provenance table.
- Mechanics in the S-5 tickets can be built and tested against labelled fixture-class rulesets; the optional ruleset section stays dormant (R11), so no production behaviour or golden changes.
