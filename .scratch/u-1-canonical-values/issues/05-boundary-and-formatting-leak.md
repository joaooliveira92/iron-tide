# 05: The conversion boundary and the formatting-leak removal

**What to build:** Define the single canonical↔display conversion boundary (on the
presentation side) and remove or relocate the domain-package formatting leak, so
no authoritative package owns presentation text and canonical values carry no
locale. Value-preserving: no hashed value changes.

**Blocked by:** 01 (the canonical units module).

**Status:** ready-for-agent

- [ ] No authoritative package builds presentation or localized strings; the
      campaign-engine priorities module's `toLocaleString` formatting is removed
      or relocated to the presentation side.
- [ ] Canonical values carry no locale; UI language and formatting locale are two
      distinct concerns (types/selectors), neither derived from the other.
- [ ] Authoritative packages and persistence perform no display-unit or
      currency conversion; a single presentation conversion module is the only
      canonical→display home (its final location may be deferred to U-2/U-3, but
      the boundary is fixed here).
- [ ] The display knot/millimetre helpers and any ad-hoc conversion are moved
      behind the boundary or explicitly deferred to U-3; a lint/gate bars ad-hoc
      `Intl`/`toLocaleString`/`toFixed`/unit conversion in components.
- [ ] Value-preserving: the cross-process child run is byte-identical before and
      after; no hashed projection string changes.
