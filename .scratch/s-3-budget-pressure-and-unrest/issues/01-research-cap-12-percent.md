# 01: Research budget capped at 12% of the naval budget

**What to build:** A nation cannot set its standing research budget above 12% of its
naval budget (manual p.16). The player command is rejected with a typed reason, the AI
path is clamped, and a campaign month observes the capped research funding.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A player research-budget command above 12% of the monthly naval budget is
      rejected with a stable `_tag`; at exactly 12% it is accepted.
- [ ] The AI planning path never sets a budget above the cap (test over a fixture year).
- [ ] The 12% rule is a named ruleset rule, not a literal inside the phase.
- [ ] Existing absolute research bounds are reconciled, not dual-maintained.
- [ ] A fixture campaign month observes funded research no higher than the cap.
