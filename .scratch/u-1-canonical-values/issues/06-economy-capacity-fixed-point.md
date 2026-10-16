# 06: Construction-capacity ratio to fixed-point

**What to build:** Replace the float construction-capacity proportion in the
economy phase with fixed-point integer arithmetic in canonical units — one
rounding point per formula and largest-remainder for any split — so no float
reaches the funding split. This changes authoritative outcomes, so it rides a
reviewed delta and a stated re-pin.

**Blocked by:** 04 (rounding helpers and the float gate); plus decision request
`.ai/decision-requests/0005-officer-rosters-and-divisions-golden-repin.md`
(the golden baseline: the reference run moves and the re-pin cannot run while
`golden/hashes.json` is absent).

**Status:** blocked

Gated by 0005 exactly like S-1 ticket 01. Do not start until the golden baseline
exists or the owner decides.

- [ ] The capacity allocation is computed with integer/fixed-point arithmetic; no
      float and no `Math.floor` on a float remains on this path.
- [ ] Any integer total split sums exactly (largest-remainder), with one declared
      rounding point.
- [ ] The old/new allocation delta is reviewed and recorded; the reference run is
      re-pinned with a stated cause under 0005.
- [ ] A test drives the capacity phase from a compiled month and asserts the
      integer split; the cross-process child run is byte-identical run twice.
