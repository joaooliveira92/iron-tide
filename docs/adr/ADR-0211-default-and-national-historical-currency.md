# ADR-0211: Default currency Naval Credits; National Historical is conditional

Applies to: contracts, desktop

## Status

Superseded by: ADR-0352

Accepted (2026-10-15). New record of decision DR-011; no prior ADR file existed for
it and none is restored (see ADR-0210).

## Context

Naval Credits is the standardized comparison currency (ADR-0206). Some players prefer
a nation's historical currency, but that requires a validated per-nation configuration
(identifier, names, symbol and position, spacing, decimals, grouping, negatives, scale
rules, period, source, gameplay interpretation, and relabel-or-transform semantics).

## Decision

The default currency display mode is Naval Credits. National Historical is available
only when a validated national configuration exists for the active nation and period.
It is never silently substituted. When unavailable, Options disables or hides it with
a stated reason (no campaign, or nation unsupported) and shows the effective mode
truthfully. Fallback is resolved as runtime state; the stored request is preserved and
restored across campaigns.

## Consequences

- Release readiness for the nine nations requires validated historical-currency
  configurations unless a later decision waives it (ADR-0205, ADR-0203).
- A fresh profile defaults to Naval Credits.
- Naval Credits is the render and malformed-content fallback, never silent in the UI.
