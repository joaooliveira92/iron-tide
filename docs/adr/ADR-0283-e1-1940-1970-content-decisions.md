# ADR-0283: E-1 1940-1970 content decisions

## Status

Accepted (2026-10-23). Records the owner's approval of every recommendation in decision request
[0040](../../.ai/decision-requests/0040-e-1-1940-1970-content-dates-and-field-structure.md), for spec
[#249](https://github.com/joaooliveira92/iron-tide/issues/249). Builds on [ADR-0282](ADR-0282-authored-horizon-through-1970.md) and the
precedent of [ADR-0239](ADR-0239-s2-prestige-values-balance-targets.md). Evidence: `docs/research/e-1-1940-1970-timeline.md`.

## Decision

1. **D1 fields.** Three research fields are added: `RADAR_ELECTRONICS`, `MISSILES` and `NAVAL_AVIATION`.
2. **D2 date policy.** The `historical-analogue` year in the research note is each technology's year, labelled `BALANCE_TARGET`, with the
   community anchors (1944 carrier jets, 1947 heavy SSM conversions, 1950 angled decks, 1952 jet refit and steam catapult, 1955 ASW
   sonar, 1959 quadruple heavy SSM, 1960 cruise missiles, 1966 quadruple medium SSM) overriding where both exist.
3. **D3 years.** Every candidate in the research note is accepted at its stated year, except D3i: DAMAGE_CONTROL adds nothing for
   1940-1970. The helicopter hangar (D3h) is dated 1955 as a balance target because the sources pin only the decade.
4. **D4 ship classes.** Fleet carrier (jet), escort carrier, guided-missile destroyer and frigate, ASW corvette and frigate, missile
   corvette and fast attack craft, and guided-missile cruiser all enter, each dated by the technology it requires.
5. **D5 costs and weights.** Each cost and discovery weight is derived from the nearest existing technology in the same field, labelled
   `BALANCE_TARGET` (provenance kind `balance_adjustment`, ADR-0213), and recorded with its derivation.

## Consequences

- No value is unsourced and unlabelled. Each authored technology records its class, citation or anchor, and derivation.
- Tickets #253 to #258 are unblocked; the field additions land with the first slice that uses them.
- Engine support for the new capabilities is audited separately (#259); content never promises behaviour the engine lacks.
