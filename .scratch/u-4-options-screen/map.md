# Map: U-4 Options screen

**Label:** wayfinder:map · **Status:** charted; the route is clear — no ticket
remains to decide before implementation. U-4 is golden-neutral and ungated,
externally dependent on U-3.

## Destination

A spec and a ticket set for sprint U-4 (`.ai/SPRINT-PLAN.md` Phase 2): the full
player-facing Options screen — the seven ADR-0203 sections, reachable from the main
menu and from a campaign, with live preview and reset; a high-contrast theme and
themes on every released screen; text scale, density, reduced motion, tooltip
detail, keyboard focus and non-colour indicators applied; an honest currency
control and the language/formatting-locale controls; and the externalized string
catalogue ADR-0209 requires. No implementation happens in this effort.

## Notes

- Authority order per ADR-0210. ADR-0203 (Options screen + preferences
  architecture), ADR-0202 (presentation-only), ADR-0209 (language/locale,
  externalized strings, en-US fallback), ADR-0206/0207/0208/0211 (currency display
  modes, default, requested/effective). The manual grounds no settings screen
  (`docs/research/u-2-preferences-domain.md` §4: the manual has only scattered
  in-context options). Simulation matches RTW3; only UI/UX may deviate.
- Resolved by the orchestrator without a live human (user directive: run
  autonomously). Each decision derives from a higher authority; no gameplay value
  is at stake, so this effort raises no decision request and hits no stop
  condition.
- Existing surfaces U-4 builds on: the U-2 domain on `dev`
  (`preferences-contract.ts` with `DEFAULT_APP_PREFERENCES`, `THEME_PREFERENCES`
  without `highContrast`, `TEXT_SCALE_MIN/MAX`, `usePreferences`,
  `useCurrencyDisplayMode` and the store/bridge/capability); the current
  `OptionsScreen.tsx` (Background/Font/Density, already on the domain) and its
  contexts; the screen registry / `settings` group / `CampaignScreenOutlet`
  (campaign-only today) and `CampaignUnavailableView` (pre-campaign); the token
  theme system in `styles/globals.css` and `ThemeContext.tsx`; the a11y harness
  (`lib/axe.ts`, `a11y.audit.test.tsx`, `type-floor.test.ts`); the string-less
  state (no catalogue exists); the `campaign-preferences` screen (its display
  prefs still on `localStorage`).
- U-4 is **externally blocked by U-3** (formatters, conversion module, currency
  availability/resolution) and consumes U-2 (done).
- Skills: `to-spec`, `to-tickets`, `tdd` for implementation later.

## Decisions so far

- [D1 Scope boundary](decisions/D1-scope-boundary.md): U-4 owns the seven-section
  Options screen, reachability, live preview/reset, the high-contrast theme and the
  released-screen theme/a11y sweep, the accessibility applications, the currency
  control, and the language/locale controls + externalization; U-2/U-3/U-5 and the
  currency content are seams.
- [D2 Structure and reachability](decisions/D2-structure-and-reachability.md): one
  `options` settings screen with the seven sections, reachable pre-campaign (a new
  main-menu entry) and in-campaign; campaign-dependent controls degrade to their
  no-campaign state.
- [D3 Theme and high contrast](decisions/D3-theme-and-high-contrast.md): add the
  `highContrast` value deferred to U-4 and implement it through the existing token
  system; verify every released screen consumes tokens.
- [D4 Applying preferences](decisions/D4-applying-preferences.md): apply
  `textScale` at the shell root, make `reducedMotion` authoritative over the media
  query, drive `tooltipDetail`, and provide keyboard focus + non-colour indicators.
- [D5 Currency control](decisions/D5-currency-control.md): three modes with the
  ADR descriptions; disable/hide National Historical with a stated reason; show the
  effective mode truthfully; update on campaign change; delegate formatting to U-3.
- [D6 Language, locale, externalization](decisions/D6-language-locale-externalization.md):
  en-only language, tested-locale formatting control, and the stable-keyed string
  catalogue with en-US fallback + no raw keys, migrating the Options strings.
- [D7 Preview, reset, gating](decisions/D7-preview-reset-gating.md): optimistic
  live preview + per-section/all reset through U-2's write path; presentation-only
  and golden-neutral; externally blocked by U-3; stop if a control would change
  authoritative data.

## Not yet specified

- The exact visual layout, grouping and iconography of the seven sections — a
  design detail settled at implementation with the existing component vocabulary.
- The pre-campaign entry point's precise placement (main-menu button vs header
  slot) — settled at implementation against the click-depth ledger
  (`feature-depth.ts` already records an `Options` path).
- The `tooltipDetail` step sizes and the shared tooltip surface's exact
  implementation — settled at implementation.
- The full high-contrast token values — settled with the accessibility audit.
- Whether the remaining released screens' string migration lands inside U-4 or a
  bounded follow-on — a scope-sizing call at implementation (D6).

## Out of scope

- Preferences storage/schema/scopes/capability/selectors — U-2 (done).
- Formatters, conversion module, currency availability/resolution and the
  national-currency schema — U-3.
- Presentation-invariance as a standing suite — U-5.
- Per-nation historical currency **content** — an owner decision (U-3 D7).
- Tactical preferences (report detail, map display, auto-pause) — T-2.
- Save slots / autosave controls — F-4.
- Debug/dev screens (`simulation`, `tactical-sandbox`, `debugging`,
  `map-prototype`) — exempt.
