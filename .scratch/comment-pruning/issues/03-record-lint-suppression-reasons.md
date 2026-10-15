# 03: Record the reason on unjustified lint suppressions

**What to build:** Three suppressions disable a rule with no recorded reason: the
perf-tripwire `no-console` log, the deliberately thrown non-`Error` in the CLI
diagnostics test, and the array-index React key in the map-prototype variant. Add
an inline justification, or fix the underlying cause and drop the suppression, so
a future reader knows why the rule is off.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Each of the three suppressions carries an inline justification, or its underlying cause is fixed and the suppression removed.
- [ ] Lint and the affected package tests pass.
