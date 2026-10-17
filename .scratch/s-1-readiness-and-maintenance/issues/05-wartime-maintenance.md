# 05: Wartime maintenance multiplier

**What to build:** While a nation is at war its active-status maintenance is raised
by one ruleset multiplier, read from existing war state. A fixture month run with and
without an active war shows the higher charge in war and the ledger explaining it.

**Blocked by:** 02

**Status:** done (2026-10-17; commit 8c08c86)

- [ ] The month executor reads nation war state and applies a single ruleset
      multiplier to active-status maintenance only.
- [ ] The multiplier is a ruleset constant (fixture-class until decision request
      0007); no number is hard-coded in the phase.
- [ ] Peace and war months for the same fleet differ only by the multiplier, asserted
      from the ledger.
- [ ] The maintenance phase's footprint still passes the registry guard (war state is
      a declared read).
