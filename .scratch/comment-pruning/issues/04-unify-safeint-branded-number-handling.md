# 04: Unify SafeInt branded-number handling in the AI planning package

**What to build:** The AI command generation and planning code handles `SafeInt`
inconsistently — as a plain number in some places and as an object exposing
`valueOf` in others, guarded by "future-proof" shims. Settle on the single
branded-number contract used everywhere else in the repository, and remove the
ad-hoc branch so the type has one representation.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] SafeInt is read through one consistent contract; no "future-proof" / object-`valueOf` shim remains.
- [ ] The AI package tests pass and authoritative hashes are unchanged.
