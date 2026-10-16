# 04: Battle and war outcomes move prestige

**What to build:** Resolved battles and ended wars change prestige through the
seam: a lost battle and a lost capital ship cost proportional prestige, a won
battle and a won war add fixed prestige, a lost war costs proportional prestige
(manual pp.12, 62). Reason codes distinguish each source. A fixture campaign
with one decisive battle and one war end shows the effects.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Each of the five sources has a test driven from a compiled month that
      observes the right nation, direction and reason code.
- [ ] The winner and loser of one battle change in opposite directions; a
      non-participant is unchanged.
- [ ] A war is scored once, in the month it ends.
- [ ] No source is stubbed with a fake trigger; sources whose systems do not
      exist remain absent (map D1).
