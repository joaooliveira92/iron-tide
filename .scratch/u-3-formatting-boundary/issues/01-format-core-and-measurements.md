# 01: Presentation format core and measurement formatting

**What to build:** One effect-free renderer-side module that is the single home
for canonical→display conversion, proved by rendering measurements (speed, length,
calibre/armour/range, mass, volume, power, percentages) under both the imperial
default and the metric preset, so no screen converts units ad hoc any more.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A single presentation module exists in the renderer presentation area,
      importing only the runtime-free canonical contracts and the effect-free
      preferences contract; it imports no `effect`, no authoritative engine
      package, and no Node; no new package is introduced.
- [ ] The module exposes pure formatters (`formatMeasurement`, `formatPercent`,
      `formatNumber`) taking the canonical value, the preset/selections, and an
      explicit locale; tests assert exact output for an explicit locale.
- [ ] The module owns the canonical→display conversions (speed `UmPerSec`→knots;
      length/calibre/armour/range `Um`→inches/yards or mm/m; mass `Kg`→tonnes/
      pounds; volume/power; ratio `Bp`→percent) and the display-unit taxonomy.
- [ ] `measurementPreset` (imperial default per manual p.18, metric) and
      `measurementSelections` are read from the preferences domain; a selection is
      validated against the canonical unit table and an unknown category or
      incompatible unit is rejected with a typed `_tag`.
- [ ] The scattered renderer measurement/percent conversions (`/1000`,
      `/1_000_000`, `/ UM_PER_INCH`, `(bp/100).toFixed`) are replaced by the
      module for the migrated surfaces.
- [ ] A test drives the module directly and observes exact per-preset output; no
      test depends on the host locale.
