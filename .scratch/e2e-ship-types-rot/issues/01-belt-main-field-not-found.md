# 01: The ship-types e2e cannot find the main-belt armour field

**What to build:** Restore the `ship-types` end-to-end builder path so the
battle-line designer can thin the main-belt armour, see the "Cannot be built"
finding appear, correct it back and see "Can be submitted" return. Today the spec
times out before it can read the belt thickness, so the armour-editing path has no
green end-to-end coverage.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

`e2e/ship-types.spec.ts:27` fails at line 89:

```
TimeoutError: locator.inputValue: Timeout 30000ms exceeded.
  waiting for getByTestId('shipbuilding-dialog').getByRole('textbox',
    { name: 'Thickness of BELT_MAIN (mm)' })
```

Reproduced **locally on macOS (Electron) at the untouched dev tip `ae05b90`**
(before DR-009 / ADR-0214), so it is not a roster regression:

```
cd apps/desktop && pnpm build && pnpm exec playwright test e2e/ship-types.spec.ts
# 1 failed, 2 did not run
pnpm test:e2e
# 27 passed, 1 failed, 2 did not run
```

**CI passes the same gate**: on the USA-promotion PR, `desktop-e2e`
(`ubuntu-latest` + xvfb) succeeded in 4m13s, while the same spec failed
reproducibly twice locally. So this is environment-specific — a macOS/Electron
issue or a local harness flake — not a universal failure. Confirm which before
fixing; do not chase a green CI if the defect is local-only, but a reproducible
local failure still deserves a cause.

Pointers for the fix (verify, do not assume): the spec navigates the
Protection section, then the `Armour` tab, then expects the `BELT_MAIN` thickness
field. That field's accessible name is composed by `NumberField` as
`${label} (${unit})` from `label={\`Thickness of ${field.region}\`}` with unit `mm`
(`apps/desktop/src/renderer/.../ProtectionEditor.tsx` and `ArmourPanel.tsx`), so
the name matches whenever the region is rendered. The likely causes are therefore
that the cloned "Pre-dreadnought battleship (B)" reference design exposes no
`BELT_MAIN` region, or that the Protection → Armour structure changed.

- [ ] `e2e/ship-types.spec.ts:27` passes without weakening the locator or adding
      sleeps.
- [ ] The cause is fixed (region set of the cloned reference design or the
      Protection/Armour navigation), not merely the accessible name, unless the
      locator is genuinely stale.
- [ ] `pnpm test:e2e` is green with no other spec regressed.
