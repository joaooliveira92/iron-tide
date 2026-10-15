# Architecture decision records

One ADR per durable decision: `ADR-NNNN-<slug>.md`. New decisions take the
highest existing number + 1 (the next number is ADR-0001).
Refresh this table from each file's H1 when one is added or re-titled.
(ADR-0043 was never written; the sequence intentionally continues at 0044.)
See [DESIGN amendments](AMENDMENTS.md) for which ADRs amend which DESIGN doc.
Work an ADR records as deferred is tracked in [DEFERRALS](../DEFERRALS.md).
Older records kept as provenance are listed in [archive/README.md](archive/README.md).

Rows are grouped by area; the Status and Superseded-by cells mirror each ADR's
own `## Status` / `Superseded by:` lines (`pnpm preflight` fails when either
drifts). Process-only records are kept together under Process & documentation.

## Foundations

Core engine geometry, determinism, persistence, and the compiler pipeline.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |

## Effect adoption

Adopting and vendoring Effect v4: the validator/runtime idiom, the read-only agent reference, and the determinism demotion.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |

## Campaign & strategy

Strategic layer: diplomacy, economy, fleet, officers, command screens, and time.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |

## Combat

Battle generation, tactical resolution, gunnery, torpedoes, mines, air, coastal defense, damage, weather.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |

## Ship design & construction

Ship design, classification, construction, repair, and rebuild.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |

## National content

National naval profiles, the content pipeline, and AI procurement.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |

## Desktop & UI

Electron boundary, renderer screens, UX, and presentation.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |

## Process & documentation

Repo process, docs/ADR authority, and release gates.

| # | File | Title | Status | Superseded by |
| --- | --- | --- | --- | --- |

## Archive

0 records retained for provenance (older or absorbed decisions).
They stay on disk and searchable, but are not part of the active index; find
them with titles and links in [archive/README.md](archive/README.md).
