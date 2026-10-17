# 06: Turn summary surfaces

**What to build:** The player-facing summary experience. A grouped panel with category and severity filters, free-text search, and a "show only actionable" mode; expandable detail with previous/new values where relevant; entity links that open a read-only historical record when the entity is sunk, scrapped, or otherwise unavailable; pin and read state that never deletes the underlying message; and a permanent campaign-log history view over past turns. The panel renders only validated DTOs and owns no authoritative state.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] The summary groups by category and can be filtered by category and severity, searched, and restricted to actionable items.
- [ ] Expandable detail reveals individual ships/items behind an aggregate and shows previous/new values where relevant.
- [ ] Entity links navigate to the ship/class/nation/region/technology/project; unavailable entities open a read-only historical record instead of failing.
- [ ] Pin/read state persists and never removes the message from history.
- [ ] Previously resolved turns remain inspectable in a campaign-log history.
- [ ] The panel consumes only validated DTOs; it never receives or mutates authoritative state.
