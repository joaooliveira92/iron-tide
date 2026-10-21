# Decision Request: S-5 cramped and short-range counting fraction

## Status

Resolved (2026-10-21) by owner delegation: **Option C**, recorded as
[ADR-0266](../../docs/adr/ADR-0266-s5-presence-values-and-open-requests-resolved-by-delegation.md).

## Trigger

R5 reduces a ship's counted tonnage when it has cramped accommodation or short range. The manual says only "less than their actual displacement" (p.46). The fraction, and whether the two reductions combine for a ship that is both, are unsourced.

## Evidence

- Manual p.46: "Ships with cramped accommodation and ships with short range are less useful on foreign stations and will count as less than their actual displacement for the purpose of fulfilling this requirement."
- Manual p.48: ship-list codes `a` (cramped) and `L`/`S` (range).
- Manual p.59: Global naval power nations "cannot have cramped crew quarters" (no fraction).
- Research note: `docs/research/s-5-presence-and-base-limits.md` (provenance table; manual quotations and pages).
- Prior art: ADR-0210, ADR-0213, ADR-0223, ADR-0226, ADR-0239; decision requests 0007 and 0012.
- Spec #73 (R14), ticket #75.

## Why agent judgment is insufficient

Different choices change who is penalised, when, and by how much, and so every S-5 authoritative outcome and (once authored) the golden hashes. The manual is silent, ADR-0210 forbids inventing values as fact, and the S-5 spec (#73, Decision J, R14) returns each such value to the owner. Routine local design choice does not cover a gameplay balance number.

## Options

### Option A: Owner supplies the value

- Behavior: the owner provides one fraction (basis points of tonnage, below 10_000) for cramped, one for short range, and the combination rule (multiply, minimum or either), with provenance (a manual page, another high-trust source, or a stated design intent).
- Advantages: authoritative and unambiguous.
- Risks: the owner may not hold the original data; the value may not exist in the source game.
- Compatibility impact: none until authored.
- Migration impact: none (no prior state).
- Scope and effort: authoring ticket plus an ADR if the choice is a divergence.

### Option B: Keep the value dormant

- Behavior: the counting fractions (cramped and short-range ships then count in full or are excluded, which the owner must say; the default is that the section stays dormant) stays absent; the S-5 ruleset section remains dormant or (if partially authored) the compile rejects it, so no production behaviour depends on it. Projection reports 'not configured'.
- Advantages: no unsourced value ships; mechanics stay complete and tested with fixtures.
- Risks: S-5 produces no production effect; the dependent value-bearing tickets stay blocked.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

### Option C: Admit as ADR-0213 `balance_adjustment`

- Behavior: the owner explicitly waives RTW3 fidelity for this value and admits an owner-chosen number as a labelled `balance_adjustment` ruleset constant with a recorded rationale (pattern of ADR-0223 and ADR-0239), never classed as `manual`. The owner may choose one shared fraction for both.
- Advantages: unblocks the dependent S-5 tickets while remaining honest about provenance.
- Risks: a deliberate divergence from the manual; the value must be tuned by the balance sweep.
- Compatibility impact: none until authored; authoring is the one change that moves production behaviour and goldens (R14).
- Migration impact: one deliberate same-commit golden re-pin when authored.
- Scope and effort: one ADR and the authoring ticket.

## Recommendation

Option A or C. Whatever is chosen, the 1.5 colonial multiplier (sourced, p.46) is separate and its interaction order with the fraction should be stated by the owner. Do not implement, author or default any of these values before the owner chooses.

## Work safely completed while blocked

- The research note `docs/research/s-5-presence-and-base-limits.md` with the provenance table.
- Mechanics in the S-5 tickets can be built and tested against labelled fixture-class rulesets; the optional ruleset section stays dormant (R11), so no production behaviour or golden changes.
