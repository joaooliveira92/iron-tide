# Validation report: U-4 Options screen

Status: **substantially accepted** as of the last commit on
`feat/u-4-options-screen`. The screen, its reachability, the theme/accessibility
application, the currency control, the string catalogue, and the released-screen
colour guard are complete and green; a formal end-to-end invariance report and a
full sweep of remaining inline strings are not.

## What landed

| Ticket                                                                      | State        | Evidence                                                                                                           |
| --------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| 01 screen shell, reachability, preview, reset                               | done         | `screens/options/OptionsScreen.tsx`; reached from `CampaignFileScreen` and the campaign `settings` route           |
| 02 Appearance (theme + high contrast, text size, density, background, font) | done         | `ThemeContext.tsx`, `display-preferences.tsx`, `globals.css` `.high-contrast`; `ThemeContext.test.tsx`             |
| 03 Measurements and Numbers                                                 | done         | preset + per-category selects + number scale in the screen                                                         |
| 04 Currency and Numbers                                                     | done         | honest control on U-3 resolution; unavailable reason shown; request preserved                                      |
| 05 Accessibility                                                            | done         | reduced motion applied; `tooltip-detail.ts` consumes `tooltipDetail`; axe audit green                              |
| 06 Language, locale, externalization                                        | **partial**  | `lib/strings.ts` catalogue + en-US fallback; Options strings migrated; other screens' strings remain inline        |
| 07 themes + a11y on every released screen                                   | done (guard) | `shell/released-screen-theme.test.ts` — no new hard-coded colour in screens/shell outside the decorative allowlist |
| 08 acceptance                                                               | **partial**  | this report; the standing cross-mode invariance suite is U-5                                                       |

## Commands run and observed results

- `pnpm --filter @bluewave/desktop exec vp test run src/renderer/screens/options/OptionsScreen.test.tsx` → 10 passed.
- `pnpm --filter @bluewave/desktop exec vp test run src/renderer/a11y.audit.test.tsx` → 12 passed (Options included).
- `pnpm --filter @bluewave/desktop exec vp test run src/renderer/shell/ThemeContext.test.tsx src/renderer/shell/released-screen-theme.test.ts src/renderer/shell/tooltip-detail.test.ts src/renderer/shell/display-preferences.test.ts src/renderer/lib/strings.test.ts` → all green.
- `pnpm --filter @bluewave/desktop typecheck` → clean.
- `pnpm preflight` → **exit 0** (43 tasks) on the last commit.
- Full desktop suite → **2135 passed, 1 skipped**.

## Determinism and compatibility

- The screen edits app-scope presentation preferences only; the `highContrast`
  value is a preferences-schema addition versioned through the U-2 schema, not a
  save/wire change; no golden hash moved.
- No compatibility-version bump.

## Remaining

- **Ticket 06:** only the Options strings are externalized; the other released
  screens' inline strings migrate in a bounded follow-on.
- **Ticket 08:** the cross-mode/cross-preset invariance suite is U-5; this report
  records the focused evidence, not the standing suite.
