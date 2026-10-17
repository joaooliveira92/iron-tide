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

**Status:** done

Gated by 0005 exactly like S-1 ticket 01. Do not start until the golden baseline
exists or the owner decides.

- [x] The capacity allocation is computed with integer/fixed-point arithmetic; no
      float and no `Math.floor` on a float remains on this path.
- [x] Any integer total split sums exactly (largest-remainder), with one declared
      rounding point.
- [x] The old/new allocation delta is reviewed and recorded; the reference run is
      re-pinned with a stated cause under 0005.
- [x] A test drives the capacity phase from a compiled month and asserts the
      integer split; the cross-process child run is byte-identical run twice.

## Resolution (U-1 ticket 06)

The construction-capacity proportion (float `remainingWork / totalRemainingWork` then
`Math.floor(proportion * available)`) is replaced with integer largest-remainder
apportionment (`splitLargestRemainder`): the funding split sums exactly to the available
funds with one rounding point and no float. Reviewed delta: the reference run does not
move (its synthetic fixture declares no designs/catalogue, so no construction project is
funded) — `check:golden` is 11/11 and the cross-process child is byte-identical; the split
differs from the old floor-per-project only when two or more projects are funded. No
golden re-pin is required (`Golden-Repin: not-needed`, a genuine no-output change for the
reference run).
