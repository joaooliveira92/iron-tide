# D-06: Message substrate — new `@bluewave/messages` package

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

Where does the `TurnMessage` schema, projection, and interruption contracts live?

## Answer

**New `@bluewave/messages` package.** It owns the turn-message schemas,
interruption contracts, projection logic, notification policy, deterministic
aggregation, and deduplication — **outside** `@bluewave/events`, `phase-engine`,
and desktop packages. It must be **runtime-free** (Schema/Data/Equal only) and
**presentation-independent**. The application layer invokes the projection; it is
**not** an authoritative month phase. `@bluewave/events` and its frozen wire
format stay unchanged.

(Locked round 2, option a.)

## Rationale

Messages are derived and versioned separately from authoritative events; a new
leaf package keeps `events` frozen and keeps domain logic free of presentation.

## Consequence

Graph: `phase-engine → messages → {events, campaign, contracts, deterministic,
content-schema}` (acyclic; `messages` never depends on `phase-engine` or desktop).
Drives D-16 layout. Validated by R-21/R-23.
