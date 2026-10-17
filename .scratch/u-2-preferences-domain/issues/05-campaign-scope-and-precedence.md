# 05: Campaign-scope preferences and resolution precedence

**What to build:** Per-campaign display preferences stored with the campaign and
resolved ahead of the player's global settings, plus in-memory session overrides —
so a campaign can look different without changing global defaults and an
experiment leaves no trace.

**Blocked by:** 01.

**Status:** done

- [x] Campaign-scope preferences (the display preferences
      `showDetailedTooltips`, `confirmBeforeTurn`, `showUnitFatigue`,
      `showSupplyOverlay`) persist in a campaign sidecar beside the existing
      per-campaign files, never inside the save snapshot.
- [x] Session scope is in-memory only and dropped when the session closes; it is
      never written to disk.
- [x] Resolution is `session ?? campaign ?? app ?? default`, computed at read
      time; a session value never rewrites a campaign or app value.
- [x] The existing campaign display-preference hook is rewired onto the domain;
      the `bluewave-display-preferences` `localStorage` key is no longer written,
      and the existing toggles still work.
- [x] A test proves the precedence order, that a session value disappears after
      the session closes, and that the campaign sidecar never enters the save or
      moves a hash.
