# 03: Equipped ships lay mines each month

**What to build:** A monthly phase has every operational mine-equipped ship lay in
the area where it is deployed against its nation's enemies, then applies decay.
In a fixture war a minelayer deployed in an enemy-adjacent area raises that
area's pressure month by month and the change is explained by domain events.

**Blocked by:** 01, 02. Also gated by decision request 0004 (inventory model).

**Status:** blocked

- [ ] Decision request 0004 is resolved and recorded as an ADR.
- [ ] Laying uses the engine's effective-value contract; ineligible sources
      (low readiness, damaged, unsupported) lay nothing with their reason code.
- [ ] Pressure is added only against belligerents; peacetime laying is rejected.
- [ ] Decay and freshness change pressure over months with no ships present.
- [ ] The phase has a declared footprint and passes its registry guard.
