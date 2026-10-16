# 07: U-3 acceptance — presentation invariance and boundary proof

**What to build:** The evidence that the formatting boundary is real: every mode,
preset, scale and locale renders change no authoritative outcome, the round-trip
and malformed-content paths hold, and the sprint meets its definition of done on a
clean commit.

**Blocked by:** 05, 06.

**Status:** done

- [x] An invariance test changes every presentation preference (all three currency
      modes, both unit presets, number scale, language and locale) and observes the
      compiled campaign snapshot, the save, and the cross-process golden reference
      run unchanged.
- [x] Boundary tests prove: a display-unit input parses once and round-trips; a
      malformed currency configuration falls back to Naval Credits with a reason;
      an unsupported locale is not selectable; no formatted text is persisted.
- [x] The ad-hoc-formatting gate is green on the clean tree and fails on its
      fixture; the domain formatting leak guard is green.
- [x] No save format, wire format, or compatibility version changed; no golden hash
      moved (record the before/after hashes as evidence).
- [x] The U-3 validation report is written with exact commands and observed
      results; the SPRINT-PLAN row and the `.ai/specs/` pointer are updated; the
      tree is clean with Conventional Commit subjects.
- [x] `pnpm preflight`, `pnpm test:scripts`, and `pnpm check` are green on the
      exact commit.
