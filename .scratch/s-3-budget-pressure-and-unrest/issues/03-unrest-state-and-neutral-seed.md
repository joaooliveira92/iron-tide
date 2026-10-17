# 03: Unrest state and neutral seed

**What to build:** Every compiled nation carries an unrest level in authoritative
state, seeded from an optional authored value and otherwise the neutral floor (map D2).
Saves round-trip it, and the status strip shows the live number instead of the
"no domestic-politics model" placeholder.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `NationState` carries a required bounded integer; non-integers and out-of-bound
      values are rejected at construction and at save decode.
- [ ] A nation with no authored seed starts at the neutral floor; one with an authored
      seed (fixture) starts there. Production content is untouched.
- [ ] Compatibility version bumped with a parity test built from existing fixtures; the
      cross-process reference run covers the field.
- [ ] The status strip item changes from deferred to a live value; the renderer imports
      no `effect`.
- [ ] Goldens re-pinned only per the re-pin doc, with an understood cause recorded.
