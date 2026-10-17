# 05: Naval spending raises and cuts lower unrest

**What to build:** The share of the national economy spent on the navy moves unrest each
month: above a ruleset reference it raises it, and a cut lowers it (manual p.62, "the
most important factor"). A fixture campaign shows the player raising the rate, unrest
climbing, then cutting it and unrest easing.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Higher appropriation rate produces a larger monthly rise than a lower one, in a
      monotonic, tested way.
- [ ] A rate cut produces a `SPENDING_CUT` reduction; steady spending at the reference
      produces no spending change.
- [ ] Applies identically to player and AI nations.
- [ ] Reference share and magnitudes are fixture ruleset constants.
- [ ] Observed through the campaign month and its events, not by calling internals.
