# ADR-0207: Budget Points (BP) as an abstract display unit

## Status

Accepted (2026-10-15). New record of decision DR-007; no prior ADR file existed for
it and none is restored (see ADR-0210).

## Context

Players may want an abstract, nation-neutral framing of budget values distinct from
Naval Credits. This must not create a parallel economy or a second set of
authoritative values.

## Decision

Budget Points (BP) is an abstract display unit over the same canonical values used by
Naval Credits. BP changes labels and formatting only; it introduces no second economy
and no separate conversion.

## Consequences

- BP is one of the three currency-display modes (ADR-0211).
- Switching to BP changes no authoritative hash and no canonical stored value.
- BP formatting is defined by the formatting boundary (U-3).
