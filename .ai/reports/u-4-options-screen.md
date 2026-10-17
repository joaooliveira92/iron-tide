# Validation report: U-4 Options screen

Status: **accepted** as of `feat/u-4-options-screen`. The screen, its
reachability, the theme/accessibility application, the currency control, the
string catalogue, and the released-screen colour guard are complete and green.
The remaining released screens' inline strings are a **recorded bounded
follow-on** (U-4 map D6), not a silent deferral.

## What landed

| Ticket                                                                      | State | Evidence                                                                                                                                                                                                |
| --------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 screen shell, reachability, preview, reset                               | done  | `screens/options/OptionsScreen.tsx`; reached from `CampaignFileScreen` and the campaign `settings` route                                                                                                |
| 02 Appearance (theme + high contrast, text size, density, background, font) | done  | `ThemeContext.tsx`, `display-preferences.tsx`, `globals.css` `.high-contrast`; `ThemeContext.test.tsx`                                                                                                  |
| 03 Measurements and Numbers                                                 | done  | preset + per-category selects + number scale in the screen                                                                                                                                              |
| 04 Currency and Numbers                                                     | done  | honest control on U-3 resolution; unavailable reason shown; request preserved                                                                                                                           |
| 05 Accessibility                                                            | done  | reduced motion applied; `tooltip-detail.ts` consumes `tooltipDetail`; axe audit green                                                                                                                   |
| 06 Language, locale, externalization                                        | done  | `lib/strings.ts` catalogue + en-US fallback; Options **and shell chrome** strings migrated; `shell/chrome-strings.test.ts` guards registry/section labels; screen content is the recorded boundary (D6) |
| 07 themes + a11y on every released screen                                   | done  | `shell/released-screen-theme.test.ts` — no new hard-coded colour in screens/shell outside the decorative allowlist                                                                                      |
| 08 acceptance                                                               | done  | this report; the standing cross-mode invariance suite is U-5                                                                                                                                            |

## Commands run and observed results

- `pnpm --filter @bluewave/desktop exec vp test run src/renderer/screens/options/OptionsScreen.test.tsx src/renderer/a11y.audit.test.tsx src/renderer/shell/released-screen-theme.test.ts src/renderer/lib/strings.test.ts src/renderer/shell/tooltip-detail.test.ts`
  → **5 files, 28 tests passed** (Options screen, the axe audit, the released-screen
  colour guard, the string catalogue, tooltip detail).
- `pnpm --filter @bluewave/desktop exec vp test run src/renderer/shell/ThemeContext.test.tsx`
  → 2 passed; `FontContext`/`DensityContext`/`display-preferences` → passed.
- `pnpm --filter @bluewave/desktop typecheck` → clean.
- `pnpm preflight` → **exit 0** (43 tasks); `pnpm lint` → 0 errors.
- Full desktop suite → **2149 passed, 1 skipped**.
- `node scripts/verify-golden-hashes.cjs` → **All 11 hashes match golden reference**;
  `pnpm test:cross-process` (twice) → byte-identical, `success: true`.

## Determinism and compatibility

- Every control writes presentation preferences only (app scope, or the campaign
  sidecar); the main-process invariance guard
  (`src/main/preferences/preferencesInvariance.test.ts`) proves the preferences
  domain imports no authoritative package, so no setting can move an authoritative
  outcome.
- `highContrast` is a preferences-schema addition versioned through the U-2
  schema; no save/wire-format change and no compatibility-version bump.
- No golden hash moved (reference hashes recorded in the U-2 and U-3 reports).

## Remaining

- **Ticket 06 (recorded boundary, D6):** the Options screen **and the shell
  chrome** (screen registry and sidebar labels, site header, global search,
  campaign menu and close dialog, advance-month control, pre-campaign loading
  view) are externalized onto `lib/strings.ts`. The remaining released screens'
  in-content strings (`campaign-screen-registry.tsx` routes and the pre-campaign
  views dispatched by `CampaignUnavailableView.tsx` beyond the loading view)
  migrate in a **bounded follow-on**. The catalogue and resolver
  (`lib/strings.ts`) are the framework they will use; no raw key renders in
  production. Left as chrome-by-design (not catalogue prose): OS window-control
  labels and the theme preference token readout, plus the status-strip view
  model.
- **Ticket 08:** the standing cross-mode/cross-preset invariance suite is U-5; this
  report records the focused evidence, not the standing suite.

## CI follow-ups (PR #17)

- `determinism (macos-latest)`: fixed the `ThemeContext.test.tsx` race — the
  assertion now waits for `high-contrast` **and** `dark` inside one `waitFor`,
  rather than asserting `dark` immediately after `high-contrast` lands.
- `quality` (pre-existing on `dev`): `pnpm exec vp run -r build --no-cache`
  forwarded `--no-cache` to `tsc -b` (TS5072). The flag now precedes the task
  specifier (`vp run --no-cache -r build`).
- `determinism (windows-latest)` (pre-existing on `dev`): left unfixed — the
  content-compiler path-separator assertions touch authoritative `safePath`
  normalization and could move golden hashes.
