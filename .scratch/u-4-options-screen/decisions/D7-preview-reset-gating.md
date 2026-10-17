# D7: Live preview, reset, invariance, gating and dependencies

**Type:** grilling · **Status:** resolved

## Question

How does the screen preview and reset, what does it change, and what governs and
gates it?

## Answer

- **Live preview.** Every control writes through U-2's `usePreferences.setApp`,
  which applies optimistically and persists atomically; the UI previews
  immediately and survives restart. No separate preview state.
- **Reset.** A per-section reset and a reset-all restore the central defaults
  (`DEFAULT_APP_PREFERENCES`) for that section or all of them, through the same
  write path.
- **Invariance.** The screen changes only app-scope presentation preferences; it
  reads no authoritative state and writes nothing authoritative, so it moves no
  campaign snapshot, save, or golden hash. The acceptance ticket proves it.
- **Authority.** ADR-0203 (architecture), ADR-0202 (presentation-only), ADR-0209
  (language/locale/externalization), ADR-0206/0207/0208/0211 (currency modes);
  consumes U-2 (on `dev`) and U-3 (formatters/availability). Authority order per
  ADR-0210.
- **Dependencies.** U-4 is **blocked by U-3** for the formatters, the conversion
  module and currency availability/resolution; it is not blocked by U-5. Within
  this effort the tickets carry sibling edges; the U-3 dependency is external and
  recorded here, not as a sibling blocker.
- **Gating.** U-4 is golden-neutral and ungated; it requires no re-pin and no
  compatibility bump (the `highContrast` value is a preferences-schema addition,
  versioned through U-2, not a save/wire change). **Stop condition:** if a control
  would require an authoritative change, a save/wire-format change, or invented
  historical currency data, stop and raise a decision request.

## Why

ADR-0203 fixes the architecture and the scopes; ADR-0209 requires the
externalization and the language/locale split. Recording the U-3 dependency and the
golden-neutral posture keeps the route unambiguous and stops U-4 re-implementing
the formatting or currency-resolution boundary.
