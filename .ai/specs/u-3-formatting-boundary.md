# Spec pointer: U-3 Formatting boundary

Spec: `.scratch/u-3-formatting-boundary/spec.md` (ready-for-agent; sliced).
Map: `.scratch/u-3-formatting-boundary/map.md` (decisions `D1`-`D7`).
Tickets: `.scratch/u-3-formatting-boundary/issues/` — 01 presentation format core
and measurement formatting; 02 money modes (NC/BP/national-historical); 03
campaign dates, localized numbers and number scale; 04 national-currency
configuration schema and production validation; 05 currency availability and
requested→effective resolution (blocked by 02, 04); 06 parse-once input path,
ad-hoc-formatting gate and domain-leak removal (blocked by 01-03); 07 U-3
acceptance (blocked by 05, 06).
Authority: ADR-0202 (presentation-only), ADR-0209 (language/locale),
ADR-0206/0207/0208/0211 (currency modes), ADR-0215/0216/0217/0218 (canonical
table, money bridge, rounding/float gate, conversion/locale boundary).
Research: `docs/research/u-1-canonical-values.md` §5, `rtw3-manual-baseline.md`.
Gating: none on the boundary work — U-3 is golden-neutral and ungated; the
per-nation National Historical currency **data** is a separate owner decision
needing primary sources (map D7); U-3 ships the schema and validation only.
