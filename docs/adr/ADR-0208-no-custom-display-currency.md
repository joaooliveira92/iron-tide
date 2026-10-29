# ADR-0208: Custom display currency excluded from the initial release

Applies to: desktop

## Status

Superseded by: ADR-0352

Accepted (2026-10-15). New record of decision DR-008; no prior ADR file existed for
it and none is restored (see ADR-0210).

## Context

A user-defined display currency (arbitrary symbol, name, and conversion factor) is
tempting but raises unresolved questions about value, conversion, rounding,
persistence, and inputs, and risks giving the impression of a supported economy that
the game does not model.

## Decision

Custom Display Currency is excluded from the initial release. Returning to it requires
a new accepted decision covering value, conversion, rounding, persistence, and inputs.

## Consequences

- `currencyDisplayMode` accepts only `navalCredits`, `nationalHistorical`, and
  `budgetPoints`; there is no `customCurrency` value and no fallback-status value
  (ADR-0211).
- No custom-currency UI is built for the initial release.
