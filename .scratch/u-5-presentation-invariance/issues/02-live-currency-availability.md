# 02: Resolve currency availability from the active campaign

**What to build:** The effective currency mode derived from the active campaign's
nation (via U-3's `computeNationalCurrencyAvailability`) rather than the static
no-nation default, so the requested mode is preserved across unsupported contexts and
restored when a configuration applies, and the fallback is never silent.

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] The renderer resolution receives the active campaign's nation and the validated
      national-currency configuration (if any), and derives the effective mode and
      reason code from real state.
- [ ] No campaign → `noActiveNation`; a nation with no valid configuration →
      `nationalCurrencyNotConfigured` (or `nationalCurrencyInvalid`); a configured
      nation → `configured`.
- [ ] The stored **request** is never rewritten by a fallback; an
      unsupported→supported transition restores the requested mode.
- [ ] The Options control shows the effective mode and a stated reason; no silent
      substitution (existing NC behaviour preserved).
- [ ] No national-currency content is fabricated; a nation with no configuration
      still falls back to Naval Credits.
- [ ] Tests cover no-nation, configured, missing and invalid, and the
      preserved/restored request.
