# 05: Record reasons on the remaining unjustified lint suppressions

**Type:** implementation

**What to build:** Three suppressions disable a rule with no recorded reason.
Give each an inline justification, or fix the underlying cause and drop the
suppression: the desktop perf-tripwire `console` log, the compiler-CLI test that
deliberately throws a non-`Error`, and the phase-engine deep-clone escapes that
erase a generic value to `any` in order to invoke an arbitrary TypedArray
constructor or symbol key.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Each of the three suppressions carries an inline reason, or its cause is fixed and the suppression removed.
- [x] The deep-clone escapes (if retained) state why the erasure is required.
- [x] Lint and the affected package test suites pass.

## Comments

Recorded inline reasons for all three suppressions, each retained because the
underlying pattern is intentional: the perf-tripwire `console` log
(`monthAdvance.perf.test.ts`), the deliberate non-`Error` throw proving
`runCombatOperation` reports an internal-error outcome
(`compiler-cli/test/combatDiagnostics.test.ts`), and the two `no-explicit-any`
deep-clone escapes in `phase-engine/src/snapshotClone.ts` (arbitrary TypedArray
constructor + unknown symbol key).

Validated: `vp lint .` 0 warnings / 0 errors.
