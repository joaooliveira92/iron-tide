# 02: Consolidate the unit brands and constants

**What to build:** Migrate the importers in ship-design and campaign onto the
contracts canonical units module and delete the duplicate brand and constant
definitions — the *migrate* and *contract* steps of the expand→migrate→contract
sequence. Pure mechanical consolidation: every stored integer is unchanged.

**Blocked by:** 01 (the canonical units module).

**Status:** ready-for-agent

- [ ] Exactly one definition of each unit brand and canonical constant remains
      (in contracts); the ship-design and campaign duplicates are deleted.
- [ ] The directed package graph is preserved: no internal cross-package source
      import; public exports only.
- [ ] Authoring conversion (knots, millimetres) stays at the content-compile
      boundary and does not move into authoritative state.
- [ ] Value-preserving: the cross-process child run is byte-identical before and
      after; the codemod/equivalence determinism gates stay green.
