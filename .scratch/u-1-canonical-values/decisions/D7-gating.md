# D7: Gating

**Type:** grilling · **Status:** resolved

## Question

Which U-1 tickets can start now, and which wait on the golden baseline?

## Answer

The root blocker is the absent `golden/hashes.json`, escalated in decision
request **0005** (same blocker as N-1 ticket 07 and S-1 ticket 01). U-1 sorts its
tickets against it:

**Unblocked now (value-preserving — same integers stored):**

- declaring the canonical unit table and brands, and consolidating duplicates
  (D2) without changing stored values;
- branding the currently-unbranded authoritative money/ratio fields (D3);
- adding the checked rounding helpers and the authoritative-float **gate** (D4);
- removing the domain-package formatting leak and defining the conversion
  boundary (D6) where it does not alter a hashed value.

**Gated by 0005 (change a hashed outcome):**

- the combat/economy float→fixed conversions (D5), because they move the
  reference run and the re-pin cannot run;
- any ticket that changes a stored scale, a formula's rounding, or a hashed
  projection string.

**Not a U-1 blocker, but a release dependency:**

- National Historical currency configuration content needs an owner and primary
  historical sources (research note "Deferred"); it is U-3 content and does not
  block U-1.

No **new** decision request is raised by this effort: the manual's silence on
storage, rounding and locale is already covered by accepted ADRs, and the only
outcome-moving work rides the existing 0005 gate (with D5's stop surface if the
reviewed delta is material).

## Why

The plan lists U-1 as an unblocked lane; that is true for the structural work but
not for the outcome-moving conversions. Making the split explicit prevents an
agent from either (a) stalling the whole sprint on 0005, or (b) dishonestly
landing a snapshot change under a `Golden-Repin: not-needed` claim.
