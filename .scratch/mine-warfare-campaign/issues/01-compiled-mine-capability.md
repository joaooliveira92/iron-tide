# 01: Designs carry compiled mine-laying and sweeping capability

**What to build:** A ship design with mine gear compiles into a design version
that records its laying contribution, and an eligible ship type with sweeping gear
records its sweeping contribution. A player or test designs one of each, orders
it, and observes the values on the compiled version and on the commissioned ship
through its design version.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A fixture design with mine gear compiles with a non-zero laying value; one
      without compiles with none.
- [ ] A sweeping-eligible type with sweeping gear records a sweeping value; an
      ineligible type records none and the engine's ineligibility reason.
- [ ] Capability is part of the immutable compiled version and its hash; editing
      content afterwards does not change an existing version.
- [ ] Authored 1880 starting ships with no modelled design contribute nothing.
- [ ] Save and load restore the values exactly.
