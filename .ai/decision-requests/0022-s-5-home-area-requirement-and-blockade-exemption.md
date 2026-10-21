# Decision Request: S-5 home-area presence requirement and its blockade exemption

## Status

Resolved (2026-10-21) by owner delegation: **Option A**, recorded as
[ADR-0266](../../docs/adr/ADR-0266-s5-presence-values-and-open-requests-resolved-by-delegation.md).

## Trigger

p.46 requires presence "in each area where they have possessions", and most nations have possessions in the home area; but p.45 and p.46 speak of "foreign stations" and p.46 exempts only "deployment requirements at foreign stations" under blockade. Whether the home area carries a requirement and whether the exemption covers it are not stated. The two are coupled. Decision C (#64) already fixes that the exemption suspends the requirement everywhere; this request asks only about the home-area scope, flagged by the spec as not-established.

## Evidence

- Manual p.46: "Nations are required to have a minimum naval presence in each area where they have possessions." / "During wartime, the deployment requirements at foreign stations are not enforced if you are under blockade."
- Manual p.45: "either a home area or on a foreign station".
- Manual pp.50 and 70: a blockaded nation "will not be able to move ships out of its build area" (so home-area ships are pinned).
- Repo: authoritative `homeAreaId` per nation (campaign `nationCompilation.ts`; commit 2d14698); possessions in `possessions.yaml` include `poss_gbr_eng_home` in the home area.
- Spec #73 decision F (#68) and C (#64); R3, R7.
- Research note: `docs/research/s-5-presence-and-base-limits.md` (provenance table; manual quotations and pages).
- Prior art: ADR-0210, ADR-0213, ADR-0223, ADR-0226, ADR-0239; decision requests 0007 and 0012.
- Spec #73 (R14), ticket #75.

## Why agent judgment is insufficient

Different choices change who is penalised, when, and by how much, and so every S-5 authoritative outcome and (once authored) the golden hashes. The manual is silent, ADR-0210 forbids inventing values as fact, and the S-5 spec (#73, Decision J, R14) returns each such value to the owner. Routine local design choice does not cover a gameplay balance number.

## Options

### Option A: Home area carries a requirement; exemption covers it

- Behavior: the home area is a presence area like any other; the blockade exemption suspends it.
- Advantages: literal reading of "each area where they have possessions"; blockade cannot be punished twice.
- Risks: the tonnage formula (0016) must then cover home possessions.
- Compatibility impact: none until authored.
- Migration impact: none.
- Scope and effort: no extra mechanics beyond 0016.

### Option B: Home area carries no requirement

- Behavior: presence areas exclude the home area (foreign stations only); the exemption is moot for the home area.
- Advantages: matches the manual's "foreign stations" wording in the exemption and in p.59.
- Risks: a nation with home-area possessions is never held to account there; departs from the literal p.46 sentence.
- Compatibility impact: changes R3's definition of presence areas (a spec amendment) if chosen.
- Migration impact: none.
- Scope and effort: small spec amendment.

### Option C: Home area carries a requirement; exemption does not cover it

- Behavior: under blockade only the foreign-station requirements are suspended; the home requirement continues.
- Advantages: follows the exemption's literal wording.
- Risks: penalises a nation whose ships are pinned in port by the blockade (p.50).
- Compatibility impact: amends R7 (the exemption covers every area) and Decision C.
- Migration impact: none.
- Scope and effort: spec amendment.

### Option D: Keep the rule dormant

- Behavior: the home-area requirement stays absent; the S-5 ruleset section remains dormant or (if partially authored) the compile rejects it, so no production behaviour depends on it. Projection reports 'not configured'.
- Advantages: no unsourced value ships; mechanics stay complete and tested with fixtures.
- Risks: S-5 produces no production effect; the dependent value-bearing tickets stay blocked.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

## Recommendation

No preference is offered as a sourced fact. Option A matches the spec as written (R3, R7) and needs no amendment; the owner should confirm it or choose another. Do not implement, author or default any of these values before the owner chooses.

## Work safely completed while blocked

- The research note `docs/research/s-5-presence-and-base-limits.md` with the provenance table.
- Mechanics in the S-5 tickets can be built and tested against labelled fixture-class rulesets; the optional ruleset section stays dormant (R11), so no production behaviour or golden changes.
