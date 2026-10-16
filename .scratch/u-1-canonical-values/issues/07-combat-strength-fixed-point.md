# 07: Combat strength and resolver to fixed-point

**What to build:** Replace the float average-armour and damage-potential path in
combat strength and the legacy resolver's float arithmetic with fixed-point
integer maths in canonical units, with one rounding point, so no float reaches a
battle outcome. This changes authoritative outcomes, so it rides a reviewed delta
and a re-pin, with a stop surface if the delta is not explainable as a rounding
of the same formula.

**Blocked by:** 04 (rounding helpers and the float gate); plus decision request
`.ai/decision-requests/0005-officer-rosters-and-divisions-golden-repin.md`
(the golden baseline).

**Status:** blocked (stop surface raised: decision request 0009)

Gated by 0005. **Stop surface (map D5):** if the reviewed difference between the
old float-based and new fixed-point battle outcomes is materially large or not
explainable as a rounding of the same formula, stop and raise a decision request
rather than land it.

- [ ] Combat strength and the resolver use fixed-point integer arithmetic in
      canonical units; no float reaches a battle outcome or a hashed projection.
- [ ] The old/new battle-outcome delta is reviewed and recorded; the reference run
      is re-pinned with a stated cause under 0005 (or a decision request is raised
      per the stop surface).
- [ ] A test drives a battle from a compiled month and asserts the integer result;
      the cross-process child run is byte-identical run twice.

## Stop surface raised

The D5 stop surface is met: the live resolver (`battlePhases.ts`) uses the float strength/ratio/
probability pipeline, so a fixed-point conversion changes battle outcomes materially rather than
rounding one formula. Raised as `.ai/decision-requests/0009-combat-resolver-float-to-fixed-delta.md`
(recommended Option C now / Option B later). No combat change landed while blocked.
