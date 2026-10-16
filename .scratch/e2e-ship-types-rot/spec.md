# Spec: ship-types e2e rot (armour belt field)

**Status:** ready-for-agent (single tracer-bullet ticket) · **Issues:** `issues/` ·
**Origin:** reproduced during the USA playable-roster promotion (DR-009 / ADR-0214)
but independent of it.

## Problem Statement

The `ship-types` end-to-end spec exercises the whole designer happy path: clone a
pre-dreadnought battleship reference design, thin the main-belt armour so the
design stops qualifying as a battleship ("Cannot be built"), then correct it and
submit. Today it times out at the armour step, so the armour editing path — a core
part of the designer — has no green end-to-end coverage.

The failure reproduces on the untouched dev tip `ae05b90`, so it predates and is
independent of the roster promotion.

## Evidence

- `cd apps/desktop && pnpm build && pnpm exec playwright test e2e/ship-types.spec.ts`
  → 1 failed, 2 did not run.
- `e2e/ship-types.spec.ts:89`: `TimeoutError: locator.inputValue: Timeout 30000ms
  exceeded` waiting for
  `getByTestId('shipbuilding-dialog').getByRole('textbox', { name: 'Thickness of BELT_MAIN (mm)' })`.
- Full suite: `pnpm test:e2e` → 27 passed, 1 failed, 2 did not run (same failure).

## Out of scope

Any other designer/e2e behaviour, and the USA roster promotion.
