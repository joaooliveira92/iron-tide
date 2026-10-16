# 04: Measurement preset and per-category selections

**What to build:** The player's choice of display measurement system — defaulting
to the manual's imperial units — plus any per-category unit overrides, stored and
validated as a display-only preference so switching units never changes canonical
values or the campaign.

**Blocked by:** 01.

**Status:** done

- [x] `measurementPreset` accepts `imperial` and `metric`; the default is
      `imperial` (manual p.18 rationale).
- [x] `measurementSelections` holds a per-category unit map validated against the
      canonical unit table; an unknown category or an incompatible unit is
      rejected with a stable `_tag`.
- [x] A selector exposes the preset and the selections; a change persists and
      round-trips.
- [x] A test proves the stored selection is display-only and changes no canonical
      value, save, or hash.
- [x] The preset-to-formatter mapping and the category taxonomy remain U-3's.
