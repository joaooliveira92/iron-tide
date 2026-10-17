# 06: War, blockade, defeats and victories move unrest

**What to build:** War outbreak lowers unrest at first and a long war raises it; a
blockaded nation gains unrest each month; battle and war defeats raise it and victories
lower it (manual pp.62, 70). A fixture war across several months shows each reason in
the event stream.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `WAR_OUTBREAK` lowers unrest on the first war month; `WAR_DURATION` flips to a
      rise after a ruleset threshold of months.
- [ ] A nation in an existing blockade state gains `BLOCKADE` unrest each month and
      stops when the blockade ends.
- [ ] Battle resolution outcomes produce `DEFEAT` or `VICTORY` movement for the
      involved nations, counted in the same month.
- [ ] Thresholds and magnitudes are fixture ruleset constants.
- [ ] A prestige reason-code hook is reserved only; no dependency on S-2 landing.
