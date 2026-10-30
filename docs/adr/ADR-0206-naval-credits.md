# ADR-0206: Naval Credits (NC) as the standardized comparison currency

Applies to: contracts, desktop

## Status

Superseded by: ADR-0352

Accepted (2026-10-15). New record of decision DR-006; no prior ADR file existed for
it and none is restored (see ADR-0210).

## Context

The game needs a single comparison currency that is not tied to any nation's
historical money and carries no exchange-rate assumptions. It is a display and
comparison unit over canonical, fixed-precision values (ADR-0202).

## Decision

The standardized currency is Naval Credits (NC). NC is a comparison unit, not a
historical currency; it carries labels and formatting only and no exchange-rate tables.
It formats canonical values solely at the presentation boundary.

## Consequences

- NC is one of the three currency-display modes and the default (ADR-0211).
- NC is the render and malformed-content fallback, never silent in the UI.
- No second economy or conversion table is introduced.
