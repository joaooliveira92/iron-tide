# 08: Strikes lower the naval appropriation rate

**What to build:** At or above the strike threshold, the nation's naval appropriation
rate is stepped down each month the condition holds, within existing bounds, with a
recorded event (map D4). Raising the rate again by command is possible and feeds the
spending driver.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Below the threshold nothing changes; at or above it the rate drops by the ruleset
      step per month and never below the existing lower bound.
- [ ] Each reduction is an event with a strike reason; revenue next month reflects it.
- [ ] A player command raising the rate afterwards is accepted within bounds.
- [ ] Same rule for AI nations; threshold and step are fixture ruleset constants.
- [ ] A loop test: heavy spending, strike, cut, recovery, all from compiled months.
