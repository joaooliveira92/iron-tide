# D-11: Separate turn-summary sidecar

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

Do summaries extend `monthly-reports.json` or get their own sidecar?

## Answer

**Separate `turn-summaries.json`.** `monthly-reports.json` is a 12-entry
presentation history with its own schema/lifecycle; turn summaries are the message
ledger with provenance, aggregation keys, decision/battle history, and rebuild
semantics — different retention and schema. Mixing would corrupt retention limits
and conflate presentation history with the provenance ledger. `monthly-reports.json`
stays as Overview's "Recent Developments".

(Locked round 3.)

## Consequence

Consumed by D-10 (shape), D-15 (history surface), D-18 (rebuild tests). Retention
window is "Not yet specified" in the map.
