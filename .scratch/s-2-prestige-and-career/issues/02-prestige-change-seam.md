# 02: Single prestige-change seam with proportional loss and ledger

**What to build:** One operation, reachable from a monthly phase, changes a
nation's prestige by reason code: a proportional loss in basis points of current
prestige or a fixed gain. Each change is a domain event with before, after,
reason and ruleset version. A test drives a fixture campaign month in which a
scripted source applies a loss and a gain and observes snapshot and events.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A loss at high prestige is larger in absolute terms than the same loss at
      low prestige (proportionality), with explicit documented rounding.
- [ ] Prestige never leaves its bounds; arithmetic rejects non-integers.
- [ ] Every change appears in the domain event stream with a stable reason code.
- [ ] The reason-code vocabulary is closed and exported for later sprints.
- [ ] Rates are ruleset constants supplied by the fixture ruleset, not literals in
      the phase.
