# Decision Request: S-5 base value source, base-limit mapping and no-base limit

## Status

Blocked pending owner decision.

## Trigger

R10 compares deployed ships per nation and area with a limit "dependent on the base value of the area" (p.45). The manual does not say where an area's base value comes from, how it maps to a ship count, or what the "very limited" no-base number is. These three are tightly coupled (one mapping and its zero point).

## Evidence

- Manual p.45: "The number of ships that can be deployed in an area is dependent on the base value of the area." / "If a nation has no bases in an area, only a very limited number of ships can be deployed, representing single cruisers and the like that coal at bases of friendly or neutral nations."
- Manual p.13: "Possessions have naval bases"; "The base values and fortifications of possessions can be improved by the player."
- Repo candidate input (not a manual mapping): `ports.yaml` `level`, integer 1 to 10 (`packages/content-schema/src/port.ts`); possessions have no base value field.
- Research note: `docs/research/s-5-presence-and-base-limits.md` (provenance table; manual quotations and pages).
- Prior art: ADR-0210, ADR-0213, ADR-0223, ADR-0226, ADR-0239; decision requests 0007 and 0012.
- Spec #73 (R14), ticket #75.

## Why agent judgment is insufficient

Different choices change who is penalised, when, and by how much, and so every S-5 authoritative outcome and (once authored) the golden hashes. The manual is silent, ADR-0210 forbids inventing values as fact, and the S-5 spec (#73, Decision J, R14) returns each such value to the owner. Routine local design choice does not cover a gameplay balance number.

## Options

### Option A: Owner supplies the value

- Behavior: the owner provides the base-value source (for example port levels, possession bases, or a new content field), the mapping from base value to maximum ship count, and the no-base ship count, with provenance (a manual page, another high-trust source, or a stated design intent).
- Advantages: authoritative and unambiguous.
- Risks: the owner may not hold the original data; the value may not exist in the source game.
- Compatibility impact: none until authored.
- Migration impact: none (no prior state).
- Scope and effort: authoring ticket plus an ADR if the choice is a divergence.

### Option B: Keep the value dormant

- Behavior: the base-limit mapping and the no-base limit stays absent; the S-5 ruleset section remains dormant or (if partially authored) the compile rejects it, so no production behaviour depends on it. Projection reports 'not configured'.
- Advantages: no unsourced value ships; mechanics stay complete and tested with fixtures.
- Risks: S-5 produces no production effect; the dependent value-bearing tickets stay blocked.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

### Option C: Admit as ADR-0213 `balance_adjustment`

- Behavior: the owner explicitly waives RTW3 fidelity for this value and admits an owner-chosen number as a labelled `balance_adjustment` ruleset constant with a recorded rationale (pattern of ADR-0223 and ADR-0239), never classed as `manual`. Candidates the owner may weigh (none is sourced): derive base value as the sum or maximum of port `level` in the area, and map it by a linear or tabulated rule; each would be authored as an explicit constant.
- Advantages: unblocks the dependent S-5 tickets while remaining honest about provenance.
- Risks: a deliberate divergence from the manual; the value must be tuned by the balance sweep.
- Compatibility impact: none until authored; authoring is the one change that moves production behaviour and goldens (R14).
- Migration impact: one deliberate same-commit golden re-pin when authored.
- Scope and effort: one ADR and the authoring ticket.

## Recommendation

Option A or C; the choice of base-value source is the structural decision and should come first, because the mapping and no-base number depend on it. Do not implement, author or default any of these values before the owner chooses.

## Work safely completed while blocked

- The research note `docs/research/s-5-presence-and-base-limits.md` with the provenance table.
- Mechanics in the S-5 tickets can be built and tested against labelled fixture-class rulesets; the optional ruleset section stays dormant (R11), so no production behaviour or golden changes.
