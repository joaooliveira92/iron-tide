# 04: Sweepers reduce enemy mine pressure

**What to build:** Sweeping-capable ships in an area contribute an aggregated
sweeping value that is allocated across mined areas and reduces pressure. A
fixture shows pressure falling when sweepers are present and not otherwise.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] Eligible ships contribute in the engine's deterministic order; ineligible
      ships contribute zero with a reason.
- [ ] Allocation prioritises by strike risk and never exceeds available value.
- [ ] Swept pressure never goes below zero and the record hash stays valid.
- [ ] A month with no sweepers leaves pressure unchanged other than decay.
