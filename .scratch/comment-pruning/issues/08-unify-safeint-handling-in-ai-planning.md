# 08: Unify SafeInt branded-number handling in the AI planning package

**Type:** implementation

**What to build:** The AI command-generation and planning code reads `SafeInt`
inconsistently — as a plain number in some places and as an object exposing
`valueOf` in others, guarded by "future-proof" shims. Settle on the single
branded-number contract used everywhere else, and remove the ad-hoc branch so the
type has one representation.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] SafeInt is read through one consistent contract; no "future-proof" / object-`valueOf` shim remains.
- [x] The AI package tests pass.
- [x] Authoritative hashes are unchanged.

## Comments

Deleted the `toNumber` object-`valueOf` "future-proof" shims and the ad-hoc
number/object branch in `aiCommandGenerator.ts` and `aiPlanner.ts`; SafeInt is now
read as its single branded-number contract everywhere. Removed the now-dead
`as unknown as` casts and updated `scripts/no-unknown-casts.baseline.json`
(`aiCommandGenerator.ts` entry removed, `aiPlanner.ts` 6 → 2).

Validated: `node scripts/verify-no-unknown-casts.mjs` → no new assertions, 276
existing remain; `node scripts/verify-cross-process-determinism.cjs` → two runs
byte-identical (authoritative hashes unchanged).
