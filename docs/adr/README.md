# Architecture decision records

One ADR per durable decision: `ADR-NNNN-<slug>.md`. New decisions take the
highest existing number + 1 (the next number is ADR-0214).
Refresh this table from each file's H1 when one is added or re-titled.
Records numbered below 0201 are unavailable and unverified legacy references;
see the [authority index](../../.ai/AUTHORITY-INDEX.md).
See [DESIGN amendments](AMENDMENTS.md) for which ADRs amend which DESIGN doc.
Work an ADR records as deferred is tracked in [DEFERRALS](../DEFERRALS.md).
Older records kept as provenance are listed in [archive/README.md](archive/README.md).

Rows are grouped by area; the Status and Superseded-by cells mirror each ADR's
own `## Status` / `Superseded by:` lines (`pnpm preflight` fails when either
drifts). Process-only records are kept together under Process & documentation.

## Scope & horizon

The sole 1880 start, the 1939 authored horizon, and the nine-nation roster.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0201 | [ADR-0201-sole-1880-start.md](ADR-0201-sole-1880-start.md) | Sole 1880 start | accepted | — |
| 0204 | [ADR-0204-horizon-1939-and-scenario-ids.md](ADR-0204-horizon-1939-and-scenario-ids.md) | Authored horizon through 1939; no empty scenario IDs | accepted | — |
| 0205 | [ADR-0205-nine-playable-nations.md](ADR-0205-nine-playable-nations.md) | Nine playable nations; the rest AI-only behind a readiness gate | accepted | — |

## Values, currency & language

Canonical values and the presentation-only units, currency, and language modes over them.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0202 | [ADR-0202-canonical-internal-values.md](ADR-0202-canonical-internal-values.md) | Canonical internal values, presentation-only units and currency | accepted | — |
| 0206 | [ADR-0206-naval-credits.md](ADR-0206-naval-credits.md) | Naval Credits (NC) as the standardized comparison currency | accepted | — |
| 0207 | [ADR-0207-budget-points.md](ADR-0207-budget-points.md) | Budget Points (BP) as an abstract display unit | accepted | — |
| 0208 | [ADR-0208-no-custom-display-currency.md](ADR-0208-no-custom-display-currency.md) | Custom display currency excluded from the initial release | accepted | — |
| 0209 | [ADR-0209-ui-language-and-formatting-locale.md](ADR-0209-ui-language-and-formatting-locale.md) | UI language, formatting locale, and externalized strings | accepted | — |
| 0211 | [ADR-0211-default-and-national-historical-currency.md](ADR-0211-default-and-national-historical-currency.md) | Default currency Naval Credits; National Historical is conditional | accepted | — |

## Preferences & interfaces

The versioned preferences domain behind the Options screen.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0203 | [ADR-0203-options-and-preferences-architecture.md](ADR-0203-options-and-preferences-architecture.md) | Options screen and preferences architecture | accepted | — |

## Repository authority & re-baselining

Unavailable-artifact policy and the project authority order.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0210 | [ADR-0210-unavailable-artifacts-and-authority-order.md](ADR-0210-unavailable-artifacts-and-authority-order.md) | Unavailable artifacts are unverified legacy references; authority order | accepted | — |

## Scenario content & research

Legality, consistency and authored posture of the 1880 scenario's starting content and research state.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |
| 0212 | [ADR-0212-initial-fleet-tech-legality.md](ADR-0212-initial-fleet-tech-legality.md) | Initial-fleet tech legality uses the global 1880 tech set | accepted | — |
| 0213 | [ADR-0213-opening-posture-balance-choices.md](ADR-0213-opening-posture-balance-choices.md) | The 1880 opening posture is authored canon; magnitudes are balance choices | accepted | — |

## Archive

0 records retained for provenance (older or absorbed decisions).
They stay on disk and searchable, but are not part of the active index; find
them with titles and links in [archive/README.md](archive/README.md).
