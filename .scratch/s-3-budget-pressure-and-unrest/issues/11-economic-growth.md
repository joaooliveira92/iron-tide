# 11: Base resources grow 3-5% a year

**What to build:** Each nation's base resources grow at an annual rate inside the
manual's 3-5% band (p.12), applied monthly before revenue, so budgets rise over a
campaign.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Rate must lie in the 300-500 basis-point band; rates outside are rejected at
      content validation.
- [ ] Integer compounding with explicit rounding; twelve months equal the annual rate
      within a documented tolerance; no float.
- [ ] Revenue in later months rises accordingly, observed through a campaign year.
- [ ] A nation with no authored rate uses a fixture ruleset default only in fixtures;
      production rates arrive in ticket 14.
- [ ] Reference-run movement follows the golden re-pin doc; compatibility bumped.
