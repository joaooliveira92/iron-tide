# 07: Cramped accommodation raises unrest in hard times

**What to build:** Ships built with cramped accommodation add unrest while their nation
is at war, more so under blockade (manual pp.62, 78 and the accommodation rules in the design chapter). A fixture fleet of cramped
ships shows more unrest than the same fleet with normal accommodation.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Contribution scales with the fleet's cramped share and is zero in peacetime.
- [ ] A blockaded nation's contribution exceeds an unblockaded one's.
- [ ] Reads the accommodation setting already recorded on designs; no new design field.
- [ ] Reason code `CRAMPED_ACCOMMODATION`; magnitudes are fixture ruleset constants.
- [ ] Observed through a compiled campaign month.
