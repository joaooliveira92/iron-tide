# ADR-0242: Colonial-service fitting is optional design state; its cost is a value of the dormant S-5 ruleset section

Applies to: content-compiler, content-schema, campaign, phase-engine, ship-design, desktop

## Status

Superseded by: ADR-0362

Accepted (2026-10-20). Implements decisions A, I and J of the wayfinder map
[#54](https://github.com/joaooliveira92/iron-tide/issues/54) via ticket
[#78](https://github.com/joaooliveira92/iron-tide/issues/78) (S-5 04, spec
[#73](https://github.com/joaooliveira92/iron-tide/issues/73), R4, R11 section declaration, R13).

## Context

A design can be fitted for colonial service (manual p.42): it "takes up a proportion of
displacement". The manual gives no proportion (research note
`docs/research/s-5-presence-and-base-limits.md`, row 12; decision request 0021 is open), so
no production number may exist yet. The fitting must still be recordable, compile, be
ordered and show as `c` (manual p.48). The corvette eligibility advisory
(`KE_COLONIAL_SERVICE_UNAVAILABLE`) is a different question (may a KE take colonial
service) and is unchanged.

## Decision

1. `DesignDraft.colonialServiceFitted?: boolean` (`true` = fitted; absent or `false` =
   unfitted). The `set_colonial_service` edit removes the key when unfitting, so an
   unfitted draft is byte-identical to one that predates the field. The same optional
   field is carried by the content-schema draft and the parts header, and validated by
   `validateDraftShape`.
2. The S-5 values live in one optional ruleset section, `presence`, on a ruleset in
   `rulesets.yaml`, decoded strictly by `decodePresenceRules` (`@bluewave/content-schema`).
   This ticket declares it with `colonialServiceDisplacementBp` (integer, 1..9999, basis
   points of target displacement) and a `provenance` block. Later S-5 tickets add their
   required values to the same section, so a half-authored section is rejected, never
   partly enabled. Compile rejects a partial, mistyped, excess-key or out-of-range section
   with `PRESENCE_RULES_INVALID` naming the field, and two rulesets carrying a section
   with `PRESENCE_RULES_AMBIGUOUS`. Absent = dormant; no numeric default exists anywhere.
3. The value reaches the compile through `ShipBuildingData.presence`, filled from the
   compiled bundle's rulesets (`presenceFromRulesets`), and `ShipContext.colonialFitting`.
4. Compile effect: a fitted design takes `ceil(targetDisplacementKg * bp / 10000)` kg,
   integer arithmetic, into the `auxiliary` ledger line. The base is the draft's target
   displacement, not the solved total, so the fitting never feeds back into its own size.
   With the section dormant the fitting is recorded with `displacementKg: 0`, the compiled
   `colonialService` result says `configured: false`, and the advisory
   `COLONIAL_SERVICE_NOT_CONFIGURED` is raised; the designer says "not configured" and
   shows no number. `CompiledDesign.colonialService` is present only on a fitted design.
5. `CompiledDesignVersion.colonialServiceFitted?: true` and `Ship.colonialServiceFitted?: true`
   record it. A launched hull copies it from its design; a finished rebuild takes the new
   design's value (dropping the old one). The fleet screen adds `colonialServiceFitted` and
   `colonialCode: "c"`; the player projection adds `colonialServiceFitted`.

## Compatibility

Every field is additive and optional, and the compiler writes none of them for existing
content, so older saves load with them absent and an unfitted design, ship, snapshot or
golden hash does not move. Following ADR-0231 and ADR-0241, `CURRENT_COMPATIBILITY_VERSION`
stays `3.1.0` and no golden is re-pinned: the production ruleset authors no `presence`
section, so production behaviour is unchanged until the authoring ticket
([#85](https://github.com/joaooliveira92/iron-tide/issues/85)) supplies a sourced value or
the owner admits one as an ADR-0213 `balance_adjustment` (decision request 0021).

## Consequences

- The section being dormant means no production ship can yet pay a displacement cost;
  authoring it is the one change that moves production behaviour and goldens (R14).
- Mechanics are tested only with fixture-class proportions, labelled as such.
- Presence counting, the 1.5x weighting and the `c` consumers are S-5 05 onward; this
  ticket only records the fitting and shows it.
