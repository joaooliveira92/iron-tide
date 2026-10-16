# 03: Campaign dates, localized numbers and number scale

**What to build:** Formatting of canonical campaign time and ordinary numbers —
a localized month/year from the integer month, numbers and percentages through the
chosen formatting locale, and an abbreviated number scale when asked — with UI
language kept independent of the formatting locale.

**Blocked by:** 01.

**Status:** done

- [x] Campaign month/year is formatted from the canonical integer `(year, month)`
      (no `Date`, no wall clock) into a localized string; the existing renderer
      month names become a locale-driven implementation behind the module, not a
      second source.
- [x] Numbers render through `formattingLocale` (grouping, decimals) and honor
      `numberScale` (`full` | `abbreviated`); percentages render from `Bp`.
- [x] UI language and formatting locale are independent: changing one does not
      change the other; only locales on the tested allowlist are selectable.
- [x] An unsupported/locale-less call falls back to the documented default
      (`en-US`) without throwing; tests pass an explicit locale and never depend
      on the host locale.
- [x] A single locale entry point is used by every formatter (no per-call-site
      locale literal remains on the migrated surfaces).
- [x] A test drives the module with an explicit locale and observes exact month
      and number output, including the abbreviated scale.
