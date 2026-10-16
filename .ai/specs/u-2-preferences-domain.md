# Spec pointer: U-2 Preferences domain

Spec: `.scratch/u-2-preferences-domain/spec.md` (done; sliced, accepted).
Map: `.scratch/u-2-preferences-domain/map.md` (decisions `D1`-`D7`).
Tickets: `.scratch/u-2-preferences-domain/issues/` — 01 versioned domain, app-scope
persistence, capability and selectors; 02 currency display mode (requested vs
effective); 03 UI language and formatting locale; 04 measurement preset and
per-category selections; 05 campaign scope and precedence; 06 deterministic
migration and corruption recovery (blocked by 02-05); 07 U-2 acceptance (blocked
by 06).
Research: `docs/research/u-2-preferences-domain.md`.
Authority: ADR-0203 (preferences architecture), ADR-0202 (presentation-only),
ADR-0209 (language/locale), ADR-0206/0207/0208/0211 (currency display modes).
Gating: none — U-2 is golden-neutral and ungated (D7); no open decision request
blocks it.
