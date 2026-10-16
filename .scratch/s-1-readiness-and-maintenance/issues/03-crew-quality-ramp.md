# 03: Crew quality ramps toward the readiness ceiling

**What to build:** Each month a ship's crew quality moves toward its readiness
state's ceiling at a ruleset rate, with no randomness. A fixture month run raises a
newly active ship's crew, lowers a laid-up ship's, and ends working-up once the crew
passes the decent threshold; the value is the one supplied to combat's crew input.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Crew quality moves toward the state ceiling by the ruleset rate each month and
      never leaves `0..100`.
- [ ] The ramp consumes no randomness (no new ledger draws); determinism is
      structural.
- [ ] A working-up ship leaves working up when crew reaches the "decent" threshold;
      it is never returned to working up.
- [ ] The ramp is a distinct, declared step in the phase footprint (a new phase or an
      extended maintenance footprint), passing the registry guard.
- [ ] Ceilings, rate and threshold are ruleset constants (fixture-class until
      decision request 0007).
