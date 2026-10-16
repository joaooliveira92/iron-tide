# 06: Career result and final score

**What to build:** When a career ends, by sacking or by reaching the 1939 horizon
in office, authoritative state holds a career result (nation, final score equal
to prestige at that moment, reason, month). The result survives save and load.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] A sacked fixture campaign yields a result with reason SACKED and the score
      equal to prestige at the sack.
- [ ] A fixture campaign run to the horizon yields HORIZON_REACHED with its score.
- [ ] The result is never produced twice and is restored exactly on load.
- [ ] No Hall of Fame persistence is added (map D5).
