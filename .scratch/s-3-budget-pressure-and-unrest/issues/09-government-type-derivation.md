# 09: Government type derived from political system

**What to build:** Each nation carries one of the manual's six government types in
state, derived at compile time from its authored political system through a ruleset
mapping (map D6). An unmapped system fails compilation with a diagnostic.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] State carries a closed six-value type; a fixture mapping covers every political
      system in the schema, and a test fails if a new system is added without a mapping.
- [ ] An unmapped system yields a compile diagnostic that blocks downstream stages; there
      is no default.
- [ ] The mapping lives in the ruleset, not in code; production mapping arrives in
      ticket 14 after decision request 0011. Production content is untouched here.
- [ ] Compatibility bump and save-decode parity test per the schema-change rule.
- [ ] No event-gating consumer is added (S-4).
