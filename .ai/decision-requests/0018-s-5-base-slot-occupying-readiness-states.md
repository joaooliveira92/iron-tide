# Decision Request: S-5 readiness states that occupy a base slot

## Status

Resolved (2026-10-21) by owner delegation: **Option C**, recorded as
[ADR-0266](../../docs/adr/ADR-0266-s5-presence-values-and-open-requests-resolved-by-delegation.md).

## Trigger

R10 counts "deployed ships" against the base limit, but the manual does not say whether reserve, mothballed, working-up or repair ships occupy a slot. The S-1 vocabulary has five states (ADR-0223).

## Evidence

- Manual p.45: "Ships are deployed in an area, either a home area or on a foreign station." No state is named.
- Manual p.48: `*` after the status marks a ship that "needs maintenance and should return to an area with sufficient base capacity"; the list shows the status of every ship including `RF`, `MB`, `WU` and repair counts.
- Manual p.46 restricts only the presence counting to active and FS ships; it says nothing of base slots.
- Research note: `docs/research/s-5-presence-and-base-limits.md` (provenance table; manual quotations and pages).
- Prior art: ADR-0210, ADR-0213, ADR-0223, ADR-0226, ADR-0239; decision requests 0007 and 0012.
- Spec #73 (R14), ticket #75.

## Why agent judgment is insufficient

Different choices change who is penalised, when, and by how much, and so every S-5 authoritative outcome and (once authored) the golden hashes. The manual is silent, ADR-0210 forbids inventing values as fact, and the S-5 spec (#73, Decision J, R14) returns each such value to the owner. Routine local design choice does not cover a gameplay balance number.

## Options

### Option A: Owner decides the membership

- Behavior: the owner states which of ACTIVE, RESERVE, MOTHBALLED, WORKING_UP, REPAIR occupy a slot (any subset), with rationale.
- Advantages: unambiguous; membership is a set, so it is cheap to author.
- Risks: every subset is a reading of silence; all-states counting punishes laid-up fleets, active-only lets mothballed ships hide abroad.
- Compatibility impact: none until authored.
- Migration impact: none.
- Scope and effort: one constant set plus ADR.

### Option B: Keep the value dormant

- Behavior: the occupying-state set stays absent; the S-5 ruleset section remains dormant or (if partially authored) the compile rejects it, so no production behaviour depends on it. Projection reports 'not configured'.
- Advantages: no unsourced value ships; mechanics stay complete and tested with fixtures.
- Risks: S-5 produces no production effect; the dependent value-bearing tickets stay blocked.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

### Option C: Admit as ADR-0213 `balance_adjustment`

- Behavior: the owner explicitly waives RTW3 fidelity for this value and admits an owner-chosen number as a labelled `balance_adjustment` ruleset constant with a recorded rationale (pattern of ADR-0223 and ADR-0239), never classed as `manual`. The owner picks the set as a balance choice, labelled as such.
- Advantages: unblocks the dependent S-5 tickets while remaining honest about provenance.
- Risks: a deliberate divergence from the manual; the value must be tuned by the balance sweep.
- Compatibility impact: none until authored; authoring is the one change that moves production behaviour and goldens (R14).
- Migration impact: one deliberate same-commit golden re-pin when authored.
- Scope and effort: one ADR and the authoring ticket.

## Recommendation

Option A, since the question is a single set and the owner can answer it directly; the agent offers no preferred subset because each is an unsourced reading. Do not implement, author or default any of these values before the owner chooses.

## Work safely completed while blocked

- The research note `docs/research/s-5-presence-and-base-limits.md` with the provenance table.
- Mechanics in the S-5 tickets can be built and tested against labelled fixture-class rulesets; the optional ruleset section stays dormant (R11), so no production behaviour or golden changes.
