# 04: Repair state with the ×2 premium and mothball halt

**What to build:** A damaged ship can be placed in repair, which charges about twice
active maintenance and counts down to release; mothballing halts the repair and drops
the premium. A fixture month run repairs a ship at the doubled rate, mothballs it,
and observes the charge fall and the countdown stop.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] `REPAIR` is a readiness state with a bounded remaining-months counter
      (non-integer and negative rejected).
- [ ] A repairing ship charges ~2× active at the maintenance seam.
- [ ] Mothballing a repairing ship halts the countdown and removes the ×2 premium;
      the manual's `H`-style notification is a projection concern (ticket 07).
- [ ] On release the ship returns to a normal state without losing crew quality.
- [ ] All changes are domain events; no randomness is introduced.
