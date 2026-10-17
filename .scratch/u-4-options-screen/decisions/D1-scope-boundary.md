# D1: Scope boundary

**Type:** grilling · **Status:** resolved

## Question

What does U-4 own, and where does it hand off to U-2 (done), U-3 (formatting) and
U-5 (invariance)?

## Answer

U-4 owns the full player-facing Options screen:

- the **sections** General, Appearance, Measurements, Currency and Numbers,
  Gameplay Interface, Accessibility, Advanced;
- **reachability from the main menu and from a campaign** (today it is
  campaign-only);
- **live preview** and **reset per section and all**;
- the **theme model including a high-contrast theme**, and themes on every
  released screen (the `highContrast` value the U-2 contract deliberately
  deferred to U-4);
- **applying** the stored `textScale`, `interfaceDensity`, `reducedMotion` and
  `tooltipDetail`, plus keyboard focus and non-colour indicators;
- the **currency control** (three modes with the DR-006..DR-008 descriptions,
  honest availability, effective mode, live update on campaign change);
- the **language and formatting-locale controls** and the **string
  externalization framework** (English catalogue, en-US fallback, stable keys).

U-4 explicitly does **not** build:

- preferences storage, schema, scopes, capability or selectors — **U-2 (done)**;
- the formatters, the presentation conversion module, currency availability /
  effective resolution, or the national-currency schema — **U-3** (U-4 consumes
  them);
- presentation-invariance as a standing suite — **U-5**;
- per-nation historical currency **content** — an owner decision (U-3 D7);
- tactical preferences (report detail, map display, auto-pause) — **T-2**;
- save slots / autosave controls — **F-4**.

## Why

ADR-0203 names U-4 the Options screen and U-2 the domain; the U-2 contract comment
explicitly defers `highContrast` to U-4; ADR-0209 requires externalized,
stable-keyed strings with a complete en-US fallback, which no screen has yet. U-4
consumes U-2's selectors and U-3's formatters rather than redefining them, and
leaves the standing invariance suite to U-5.
