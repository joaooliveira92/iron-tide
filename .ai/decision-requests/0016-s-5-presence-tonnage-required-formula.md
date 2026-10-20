# Decision Request: S-5 presence tonnage-required formula and possession value

## Status

Blocked pending owner decision.

## Trigger

S-5 must compute a tonnage required per nation and area. The manual states only that it is "dependent on the number and value of the possessions owned by the nation" (p.46). No formula, per-possession weight, floor, cap or unit exists, and the repo's possessions carry no value field. Choosing the formula silently would invent gameplay.

## Evidence

- Manual p.46: "This is expressed as a tonnage required in each area, and is dependent on the number and value of the possessions owned by the nation."
- Manual p.13: "Each possession has a value that is used when calculating the budget effect of acquiring or losing possessions." Whether that value is the same input is not stated.
- Manual p.59: Global naval power must keep "at least 10% of tonnage on foreign stations" - a fleet fraction for one characteristic, not a per-area function; not offered as a source.
- Repo: `content/production/1880/possessions.yaml` has `id`, `nationId`, `areaId` only.
- Research note: `docs/research/s-5-presence-and-base-limits.md` (provenance table; manual quotations and pages).
- Prior art: ADR-0210, ADR-0213, ADR-0223, ADR-0226, ADR-0239; decision requests 0007 and 0012.
- Spec #73 (R14), ticket #75.

## Why agent judgment is insufficient

Different choices change who is penalised, when, and by how much, and so every S-5 authoritative outcome and (once authored) the golden hashes. The manual is silent, ADR-0210 forbids inventing values as fact, and the S-5 spec (#73, Decision J, R14) returns each such value to the owner. Routine local design choice does not cover a gameplay balance number.

## Options

### Option A: Owner supplies the value

- Behavior: the owner provides the function (inputs: possession count and value per area; output: tonnage), the unit and source of possession value, and any floor or cap, with provenance (a manual page, another high-trust source, or a stated design intent).
- Advantages: authoritative and unambiguous.
- Risks: the owner may not hold the original data; the value may not exist in the source game.
- Compatibility impact: none until authored.
- Migration impact: none (no prior state).
- Scope and effort: authoring ticket plus an ADR if the choice is a divergence.

### Option B: Keep the value dormant

- Behavior: the tonnage-required function stays absent; the S-5 ruleset section remains dormant or (if partially authored) the compile rejects it, so no production behaviour depends on it. Projection reports 'not configured'.
- Advantages: no unsourced value ships; mechanics stay complete and tested with fixtures.
- Risks: S-5 produces no production effect; the dependent value-bearing tickets stay blocked.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

### Option C: Admit as ADR-0213 `balance_adjustment`

- Behavior: the owner explicitly waives RTW3 fidelity for this value and admits an owner-chosen number as a labelled `balance_adjustment` ruleset constant with a recorded rationale (pattern of ADR-0223 and ADR-0239), never classed as `manual`. The owner may also choose the value-source: per-possession values authored in content, or a single per-possession constant.
- Advantages: unblocks the dependent S-5 tickets while remaining honest about provenance.
- Risks: a deliberate divergence from the manual; the value must be tuned by the balance sweep.
- Compatibility impact: none until authored; authoring is the one change that moves production behaviour and goldens (R14).
- Migration impact: one deliberate same-commit golden re-pin when authored.
- Scope and effort: one ADR and the authoring ticket.

## Recommendation

Option C if the owner accepts a documented divergence (the model is grounded, only magnitudes are missing), otherwise Option A; Option B is the safe default until then. Do not implement, author or default any of these values before the owner chooses.

## Work safely completed while blocked

- The research note `docs/research/s-5-presence-and-base-limits.md` with the provenance table.
- Mechanics in the S-5 tickets can be built and tested against labelled fixture-class rulesets; the optional ruleset section stays dormant (R11), so no production behaviour or golden changes.
