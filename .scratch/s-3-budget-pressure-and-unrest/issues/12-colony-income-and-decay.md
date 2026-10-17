# 12: Colony income that declines over time

**What to build:** Possessions can carry a value; the colony income added to the naval
budget is the sum of values scaled by a decay factor that falls with elapsed campaign
time (manual p.13). Absent values add nothing.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Possession content schema accepts an optional non-negative integer value;
      production content is untouched here.
- [ ] Income is added to appropriation each month and never makes revenue negative.
- [ ] Income in year N+10 is strictly lower than in year N for the same holdings.
- [ ] Losing or gaining a possession in a peace settlement changes income the next month.
- [ ] Decay is a ruleset constant; integer arithmetic; compatibility bumped.
