# 10: Resolve the commands dead branch and its stale cancellation comment

**Type:** implementation

**What to build:** The settlement path contains an empty `if` block with no body,
and the cancellation-rule branch carries a comment claiming it "allows but
requires explicit" while the code actually returns a not-allowed result. Remove
the dead empty branch and correct or remove the stale comment so the code and its
documentation agree.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The empty `if` block (and any now-unused condition) is removed or given its intended body.
- [x] The cancellation comment matches the code's actual behaviour.
- [x] The commands package tests pass; no authoritative outcome changes.

## Comments

Removed the empty `if (consumedAmount + fixedNonRefundableAmount > reservedAmount)`
block in `commands/src/settlement.ts`, keeping the accurate comment that
`max(0, reserved - consumed - fixed)` absorbs overage. Corrected the
`CUSTOM_EXPLICIT` comment in `commands/src/specRules.ts` to match the code's
fail-closed not-allowed result.

Validated: `vp run -r --concurrency-limit 4 test` 2053 passed | 1 skipped (no
authoritative-outcome changes).
