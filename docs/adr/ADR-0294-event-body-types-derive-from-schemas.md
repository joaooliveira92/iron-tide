# ADR-0294: Event body types derive from their Effect schemas

## Status

Accepted (2026-10-25). Records the `packages/events` schema-ownership decision from the
`improve-effect-use` review. The presentation move is tracked separately as a decision request.

## Decision

1. **One source of truth.** Each event body type is
   `Schema.Schema.Type<typeof <Kind>Schema>`; `DomainEventBody` derives from the union schema and
   `DomainEventEnvelope<TBody>` from the envelope schema's shell plus the generic body. No
   hand-mirrored interfaces remain.
2. **No boundary casts.** `parseDomainEventBody` and `parseDomainEventEnvelope` return the decoded
   schema type directly. The envelope parser is no longer generic; a caller cannot name a body type
   the schema did not produce.
3. **`eventType` is the literal union** of the 24 body kinds, not any non-empty string. The existing
   filter still requires it to equal `body.kind`.
4. **`SafeInt` decodes through `Schema.declare<SafeInt>`**, matching the house pattern in `combat`
   (ADR-0215/0216 forbid a second brand). Numeric body fields are therefore branded in producers;
   `phase-engine` brands decline costs, counts and thresholds when it constructs the events.
5. **The public surface is preserved.** `envelope.ts` re-exports the derived types, both previously
   missing ship body types are exported, and the exported schema list is unchanged.
6. **`events` depends on foundations only.** The `campaign` and `diagnostics` dependencies are
   removed; `BattleDeclined` is derived from its own schema instead of `Pick<DeclinedBattleRecord>`.

## Compatibility

The wire format is unchanged: same keys, same runtime constraints, and `SafeInt.isSafeInt` accepts
exactly the values the previous finite/integer/bounds schema accepted. `eventType` is stricter only
at the type level, where every value already had to equal `body.kind`. No persisted shape or
`CURRENT_COMPATIBILITY_VERSION` changes (ADR-0264), and the existing fixtures pass unmodified.
