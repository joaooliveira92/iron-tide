# 07: Replace unjustified `as unknown as` double casts with typed construction

**Type:** implementation

**What to build:** The component-variant and persistence paths flip types across a
boundary with `as unknown as`. Replace each with a correctly typed value, or a
strict schema decode at the boundary, so the double assertion and its silent risk
disappear.

**Blocked by:** None (prerequisite is a design step, not a sibling ticket — see notes)

**Status:** blocked

- [ ] No `as unknown as` remains in the ship-design sources.
- [ ] Each former cast site is type-correct without the double assertion.
- [ ] Persistence round-trip and component-variant tests pass.
- [ ] No golden hash changes without an understood authoritative cause.

## Notes

Deferred from the initial pass because the sound remedy is a design change, not a
mechanical edit.

- The two persistence casts decode an untrusted save at an authoritative boundary,
  so the contract's remedy is a strict schema decode. That needs a full
  `DesignDraft`/`EditLog` schema: the existing `DesignDraftSchema` is a strict
  subset that would strip draft fields (data loss), `EditLog` has no schema, and
  `ship-design` has no `effect`/`Schema` edge — so the decode edge is a new
  dependency plus a stricter boundary behaviour.
- The component-variant cast is an internal override merge whose result is only
  trusted because overrides are lint-checked separately; removing the cast needs a
  typed-merge decision for the dynamic top-level keys.

That new schema surface + dependency edge + stricter authoritative decode is a
design-level change and is split out rather than rushed.
