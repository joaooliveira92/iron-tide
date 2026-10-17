# 01: Cross-mode / cross-preset campaign invariance suite

**What to build:** The standing proof that presentation is not gameplay — driving the
real production composition with every display preference applied and observing the
compiled campaign snapshot, the save, and the canonical money unchanged, and the save
free of any formatted money.

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] The compiled campaign snapshot hash is identical under all three currency
      modes, both measurement presets, every number scale, theme, density, language
      and formatting locale.
- [ ] The saved production campaign payload is byte-identical across the same matrix,
      driving production composition (not a stub); a negative control proves the
      comparison is sensitive to a changed authoritative payload.
- [ ] The committed cross-process reference run still matches `golden/hashes.json`
      (pinned in-suite, and by `pnpm check:golden` on the exact commit).
- [ ] No formatted money (currency symbol/scale/separator) or currency reason code
      appears anywhere in the save; canonical money is a branded integer.
- [ ] The existing per-clause proofs (fresh default NC; corrupt recovery;
      locale/language independence; national-currency fallback to NC) are re-asserted
      in one standing suite rather than duplicated ad hoc.
- [ ] If any preference is shown to move an authoritative hash, the test fails and
      the sprint stops (ADR-0202 violation) — do not re-pin a golden to pass.
- [ ] No golden hash moves and no compatibility version changes.
