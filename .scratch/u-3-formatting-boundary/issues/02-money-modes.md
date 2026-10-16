# 02: Money formatting in NC, BP and National Historical

**What to build:** Rendering of canonical money in the player's chosen currency
display mode — Naval Credits (default), Budget Points, or a nation's validated
historical currency — with Naval Credits as the malformed-content fallback, so
treasury and cost figures read consistently and never depend on scattered `£`
literals.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] `formatMoney` renders a canonical `Money` value (treasury units, one unit =
      GBP 10,000) in the effective mode: Naval Credits (comparison unit, default),
      Budget Points (abstract), or National Historical (validated configuration).
- [ ] NC and BP change labels and formatting only; no exchange-rate table, no
      second economy, and no `customCurrency`.
- [ ] A fixture national-historical configuration renders exact strings (symbol
      and position, spacing, decimals, grouping, negatives, scale).
- [ ] A malformed or unavailable mode renders Naval Credits, never silently and
      never with a fabricated symbol; the reason is carried for the message layer
      (ticket 05).
- [ ] The scatter of `£` + `micro/1_000_000` money helpers in the renderer is
      replaced by the module for the migrated surfaces.
- [ ] A test drives `formatMoney` directly with an explicit locale and mode and
      observes exact output.
