# 06: Register and golden-baseline assertions

**What to build:** Tests that check the unavailable-artifact register stays complete
and classified — including the golden baseline's ADR-0210 "new baseline" provenance —
and that `golden/hashes.json` stays a valid, unmodified hash baseline, so clauses 6
and 7 are checked, not merely documented.

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] A test parses the unavailable-artifact register and asserts every entry is
      classified (a register value, never a recreated artifact).
- [ ] A test asserts the golden register row states the ADR-0210 "new baseline"
      provenance, and that `golden/hashes.json` remains hash-only, `success: true`,
      with valid digests (the file is not edited to carry metadata; the register is
      the provenance record).
- [ ] The assertions do not hard-code volatile values that will rot; they check the
      structural invariant.
- [ ] No authoritative hash changes.
