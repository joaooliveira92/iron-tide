# 04: Checked rounding helpers and the authoritative-float gate

**What to build:** Expose the checked rounding helpers from the canonical units
module and add the authoritative-package float gate that fails on float
arithmetic in authoritative scopes, proven by a fixture. No authoritative value
changes.

**Blocked by:** 01 (the canonical units module).

**Status:** ready-for-agent

- [ ] Checked helpers (add/sub/mul/div, `ceilDiv`, `toSafe`, reject-at-construction)
      are exposed; they throw typed `_tag` errors and never produce
      `NaN`/`Infinity`.
- [ ] One rounding vocabulary is used (`RoundingMode`); a second rounding enum is
      rejected at review.
- [ ] The float gate fails on a float fixture and passes on the clean tree
      (self-test), and is wired into the standing gates (`preflight`/`check`). The
      exact mechanism — tightened `assert-authoritative-determinism` or a
      dedicated lint rule — is chosen here and stated.
- [ ] The `assertNoFloats`/`FLOAT_IN_STATE` save guard still holds.
- [ ] Adding the helpers and gate changes no authoritative value (cross-process
      child run byte-identical before and after).
