# ADR-0202: Canonical internal values, presentation-only units and currency

Applies to: repository

Rule: Stored and authoritative values are canonical and unit-agnostic; units and currency convert only at the presentation boundary and are never persisted as formatted text.

## Status

Accepted (2026-10-15). New record of decision DR-002; no prior ADR file existed for
it and none is restored (see ADR-0210).

## Context

The engine must produce identical authoritative hashes regardless of how values are
displayed. Presentation concerns (units, currency labels, locale, theme) must never
alter simulation state. The contract already requires integer/fixed-point authoritative
arithmetic and a canonical serializer.

## Decision

Canonical internal values are unit-agnostic and fixed-precision. Units and currency are
display preferences resolved at the application boundary; they never change stored or
authoritative state. Conversion happens only at the presentation boundary, from canonical
values, and is not persisted into saves as formatted text.

## Consequences

- A canonical unit table and fixed-precision monetary representation are specified in
  the canonical-values sprint (U-1) and consumed by the formatting boundary (U-3).
- Simulation and persistence carry canonical values only.
- Presentation preferences are excluded from authoritative state by construction.
