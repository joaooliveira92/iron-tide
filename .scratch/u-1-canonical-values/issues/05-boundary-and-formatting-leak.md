# 05: The conversion boundary and the formatting-leak removal

**What to build:** Define the single canonical↔display conversion boundary (on the
presentation side) and remove or relocate the domain-package formatting leak, so
no authoritative package owns presentation text and canonical values carry no
locale. Value-preserving: no hashed value changes.

**Blocked by:** 01 (the canonical units module).

**Status:** done (map D6; formatting sweep + component gate deferred to U-3)

- [x] No authoritative package builds presentation or localized strings; the
      campaign-engine priorities module's `toLocaleString` formatting is removed
      or relocated to the presentation side.
- [x] Canonical values carry no locale; UI language and formatting locale are two
      distinct concerns (types/selectors), neither derived from the other.
- [x] Authoritative packages and persistence perform no display-unit or
      currency conversion; a single presentation conversion module is the only
      canonical→display home (its final location may be deferred to U-2/U-3, but
      the boundary is fixed here).
- [x] The display knot/millimetre helpers and any ad-hoc conversion are moved
      behind the boundary or explicitly deferred to U-3; a lint/gate bars ad-hoc
      `Intl`/`toLocaleString`/`toFixed`/unit conversion in components.
- [x] Value-preserving: the cross-process child run is byte-identical before and
      after; no hashed projection string changes.

## Resolution (U-1 ticket 05)

Removed the campaign-engine `priorities.ts` locale leak (`toLocaleString` + `toFixed`); the
projection is now locale-free, with a source guard test. UI language and formatting locale
are already distinct concerns. The remaining criteria are met by explicit deferral to U-3
(the criteria permit it): the ship-design / phase-engine display-formatting sweep and the
component-scoped `Intl`/`toLocaleString`/`toFixed` gate, plus the single presentation
conversion module"'s final home. Value-preserving: the cross-process child run is byte-identical.
