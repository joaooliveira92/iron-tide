# 03: Unpaid funds lower prestige

**What to build:** When a nation cannot meet its monthly obligations and the
existing negative-treasury condition fires, that nation's prestige takes a
proportional loss with reason UNPAID_FUNDS (manual p.13). A player who overspends
in a fixture campaign sees prestige fall in the same month and the header
projection reflect it.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] A deterministic test drives a compiled fixture month into the existing
      shortfall condition and observes the loss and its event.
- [ ] A month with no shortfall changes nothing.
- [ ] Shortfall in an AI nation also lowers that nation's prestige.
- [ ] The existing treasury and obligation behaviour is unchanged.
