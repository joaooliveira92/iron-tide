# 03: Measurements and Numbers section

**What to build:** The Measurements and Currency-and-Numbers settings the player
uses to choose display units, per-category overrides and number abbreviation, so
readings render in the units and scale the player prefers — built on U-3's
formatters.

**Blocked by:** 01.

**Status:** done

- [x] A measurement-preset control (`imperial` default, `metric`) writes
      `measurementPreset` and previews using U-3's formatters.
- [x] Per-category unit selections write `measurementSelections` and are surfaced
      for the categories U-3 defines; an invalid selection is not offered.
- [x] A number-scale control (`full` | `abbreviated`) writes `numberScale`.
- [x] The section renders no formatted amount itself: it delegates display to U-3's
      presentation module.
- [x] A test asserts the controls write the expected preferences and preview
      through the formatter seam.
- [x] Externally depends on U-3 (the formatters/presets) — recorded in the map/spec,
      not a sibling blocker.
