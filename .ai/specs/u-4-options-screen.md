# Spec pointer: U-4 Options screen

Spec: `.scratch/u-4-options-screen/spec.md` (done; sliced, accepted).
Map: `.scratch/u-4-options-screen/map.md` (decisions `D1`-`D7`).
Tickets: `.scratch/u-4-options-screen/issues/` — 01 screen shell, reachability,
preview and reset; 02 Appearance (theme incl. high contrast, text size, density,
background, font); 03 Measurements and Numbers; 04 Currency and Numbers (honest
currency control); 05 Accessibility (reduced motion, focus, non-colour, tooltip
detail); 06 Language, formatting locale and string externalization; 07 themes and
a11y on every released screen (blocked by 02, 05); 08 U-4 acceptance (blocked by
02-07).
Authority: ADR-0203 (Options screen + preferences architecture), ADR-0202
(presentation-only), ADR-0209 (language/locale, externalized strings),
ADR-0206/0207/0208/0211 (currency display modes).
Research: `docs/research/u-2-preferences-domain.md` (the manual has no settings
screen; only scattered in-context options).
Dependencies: U-2 (done, on `dev`); U-3 (formatters/availability) — external
blocker, recorded in the map/spec.
Gating: none — U-4 is golden-neutral and ungated; the `highContrast` value is a
preferences-schema addition versioned through U-2, not a save/wire change.
