# Spec: U-4 Options screen

**Status:** done (sliced into `issues/`) · **Map:** `map.md` ·
**Decisions:** `decisions/D1`-`D7` · **Authority:** ADR-0203 (Options screen +
preferences architecture), ADR-0202 (presentation-only), ADR-0209
(language/locale, externalized strings), ADR-0206/0207/0208/0211 (currency modes)
· **Dependencies:** U-2 (done), U-3 (formatters/availability) · **Gating:** none
— U-4 is golden-neutral and ungated.

## Problem Statement

The player has no real settings screen. `OptionsScreen.tsx` renders just three
controls (background, application font, display density), and only while a
campaign is open — `CampaignScreenOutlet` returns null before a campaign, so a
player cannot choose theme, text size, accessibility, units, currency, or language
until they have already started playing. Theme is changeable only from a header
cycle button; text scale, reduced motion, and tooltip detail are stored by the U-2
domain but **nothing applies them**; there is no high-contrast theme (the U-2
contract deliberately deferred it to U-4); National Historical currency cannot be
offered honestly because no control knows its availability; and there is **no
string catalogue at all**, so every label is an inline English literal.

From the player's side this means settings are hidden, partial, and sometimes
inert — a control that stores a value the game ignores. From the team's side, the
Options screen ADR-0203 describes does not exist, the high-contrast and
accessibility requirements have nowhere to land, and ADR-0209's externalized
strings have no framework.

## Solution

Build the full player-facing Options screen on the U-2 domain (done) and the U-3
formatting boundary.

One `options` screen, reachable from the main menu **and** from within a campaign,
holds the seven ADR-0203 sections — General, Appearance, Measurements, Currency
and Numbers, Gameplay Interface, Accessibility, Advanced. Every control writes
through the versioned preferences domain with optimistic live preview, and a
per-section and reset-all control restores the central defaults. The Appearance
section adds the high-contrast theme and drives theme, background, font, text
size, and density; Accessibility drives reduced motion, keyboard focus, and
non-colour indicators and applies text scaling at the shell root; Measurements and
Currency and Numbers consume U-3's formatters and currency availability, showing
the effective currency mode truthfully and disabling National Historical with a
stated reason when it is unavailable; General/Advanced collect the remaining
controls. Strings are externalized through a stable-keyed catalogue with a
complete en-US fallback, and the language and formatting-locale controls list only
fully supported languages and tested locales.

Nothing authoritative changes: the screen edits app-scope presentation preferences
only, so no campaign snapshot, save, or golden hash moves.

## User Stories

1. As a player, I want a real Options screen, so that I can configure the game to
   my liking in one place.
2. As a player, I want to reach Options before I start a campaign, so that the
   game is right from the first screen.
3. As a player, I want to reach Options from inside a campaign too, so that I can
   change a setting without leaving the game.
4. As a player, I want my changes to preview immediately, so that I can see what a
   setting does before I commit.
5. As a player, I want a reset for each section and for everything, so that I can
   undo a bad configuration.
6. As a player, I want a high-contrast theme, so that I can read the game in
   difficult conditions.
7. As a player, I want every screen to honour my theme, so that the game is
   consistent.
8. As a player, I want a text-size control that actually changes the text, so that
   I can make the interface readable.
9. As a player, I want a reduced-motion setting that actually stops motion, so that
   the game is comfortable for me.
10. As a player, I want a density control, so that I can fit more or less on screen.
11. As a player, I want a tooltip-detail control that changes what tooltips show,
    so that I get the level of detail I want.
12. As a player, I want visible keyboard focus everywhere, so that I can navigate
    without a mouse.
13. As a player, I want status shown in words as well as colour, so that I am not
    reliant on colour vision.
14. As a player, I want to choose my measurement units, so that readings match how
    I think.
15. As a player, I want to choose a per-category unit, so that a screen shows what
    I prefer.
16. As a player, I want to choose whether long numbers are abbreviated, so that
    dense screens stay readable.
17. As a player, I want to choose my currency display, so that money reads how I
    prefer.
18. As a player, I want National Historical to be offered only when it is honestly
    available, so that I am never shown a made-up currency.
19. As a player, I want to be told why a currency is unavailable, so that I
    understand the control.
20. As a player, I want the currency control to update when I open or close a
    campaign, so that it stays truthful.
21. As a player, I want my currency choice preserved across campaigns, so that it
    returns when it can.
22. As a player, I want a language control that lists only real languages, so that
    I am not offered a half-finished translation.
23. As a player, I want a formatting-locale control independent of language, so
    that I can read English with my own number formatting.
24. As a player, I want every label to come from a complete catalogue, so that the
    UI never shows a raw key.
25. As a player, I want changing a setting never to change my campaign, so that
    presentation is not gameplay.
26. As an engine developer, I want the screen to read and write only the U-2
    domain, so that there is one source of preference truth.
27. As an engine developer, I want U-3's formatters and availability to drive the
    units and currency controls, so that the screen does not re-implement them.
28. As an engine developer, I want the `highContrast` value added to the one
    preferences schema, so that it is validated like every other value.
29. As an engine developer, I want text scaling applied once at the shell root, so
    that it is consistent and not per-component.
30. As an engine developer, I want the stored reduced-motion preference to override
    the media query, so that the toggle has effect.
31. As an engine developer, I want one externalization resolver, so that missing
    keys fall back to en-US and never leak.
32. As an engine developer, I want no second preference store, so that
    `localStorage` is not a competing source.
33. As an auditor, I want the screen to move no authoritative hash, so that
    presentation-only is enforced.
34. As an auditor, I want the a11y audit to cover the new screen, so that it meets
    the accessibility bar.
35. As an auditor, I want no save or wire format changed, so that the compatibility
    surface is untouched.
36. As a release engineer, I want U-4 to land with no golden re-pin and no
    compatibility bump, so that it ships independently of outcome work.
37. As a release engineer, I want the full gate green on the exact commit, so that
    acceptance is evidence, not a build.

## Implementation Decisions

Decisions live in the map (`decisions/D1`-`D7`); summarised here with the
interfaces U-4 fixes.

- **Scope boundary (D1).** U-4 owns the seven-section Options screen,
  reachability from the main menu and campaign, live preview and reset, the
  high-contrast theme and the released-screen theme/a11y sweep, the accessibility
  applications, the currency control, and the language/locale controls +
  externalization. It does not build the domain (U-2), the formatters (U-3), the
  invariance suite (U-5), tactical preferences (T-2), or saves (F-4).
- **Structure and reachability (D2).** One `options` screen in the `settings`
  group with the seven sections; a pre-campaign entry point added to the main menu
  / pre-campaign shell so the same screen opens before a campaign, keeping the
  in-campaign route.
- **Theme and high contrast (D3).** Add `highContrast` to `THEME_PREFERENCES` and
  the U-2 schema; implement it with the existing CSS-token architecture and verify
  every released screen consumes semantic tokens.
- **Applying preferences (D4).** Apply `textScale` once at the shell root;
  make the stored `reducedMotion` authoritative over `prefers-reduced-motion`
  (through one shared hook); drive `tooltipDetail` on the shared tooltip surface;
  provide visible keyboard focus and word/shape non-colour indicators.
- **Currency control (D5).** Present Naval Credits (default), Budget Points and
  National Historical with the ADR-0206/0207/0211 descriptions; use U-3's
  availability/resolution and U-2's `useCurrencyDisplayMode`; disable/hide National
  Historical with a stated reason when unavailable; show the effective mode
  truthfully; update on campaign change; never render an amount itself.
- **Language, locale, externalization (D6).** English-only language control;
  tested-locale formatting control, independent of language; a stable-keyed string
  catalogue with a complete en-US fallback, a dev warning and no raw keys in
  production; migrate the Options strings onto it.
- **Preview, reset, gating (D7).** Optimistic live preview and per-section/all
  reset through the U-2 write path; presentation-only and golden-neutral;
  externally blocked by U-3; stop if a control would require an authoritative,
  save/wire, or invented-content change.

## Testing Decisions

- **One seam.** Drive the real shell composition: mount the screen under the U-2
  `PreferencesProvider` with a preferences bridge stub
  (`apps/desktop/src/renderer/lib/preferences-test-bridge.ts`), interact with the
  controls, and observe the persisted app preferences and the applied
  `documentElement` state. This is the existing highest seam (the Options screen
  test already uses it); no new seam is invented. Currency availability is driven
  through a compiled campaign/nation context or the availability fixture.
- A good test asserts observable behaviour: the written preference value, the
  applied DOM attribute/class/token, the visible effective mode and reason, the
  reset result, and the a11y audit — never internals or file paths.
- **Cover:**
  - **Reachability:** Options opens from the pre-campaign main menu and from a
    campaign, and the same controls work in both.
  - **Sections:** each of the seven sections renders and its controls write the
    corresponding preference.
  - **Theme:** all four themes apply; `highContrast` applies its token set; a
    `highContrast` value round-trips through the schema.
  - **Accessibility:** `textScale` changes the shell root scale; `reducedMotion`
    (including `system`) overrides the media query; keyboard focus is visible;
    status is conveyed without colour; the axe audit passes.
  - **Measurements/Numbers:** preset, per-category selections and `numberScale`
    write and preview (rendering delegated to U-3).
  - **Currency:** the effective mode shows truthfully; National Historical is
    disabled/hidden with the right reason when unavailable; the request is
    preserved; the control updates when the campaign changes.
  - **Language/locale:** only `en` and tested locales are listed; changing one does
    not change the other.
  - **Externalization:** a missing key falls back to en-US with a warning; no raw
    key renders in the production path.
  - **Reset:** per-section and reset-all restore `DEFAULT_APP_PREFERENCES`.
  - **Invariance:** changing every control leaves the compiled campaign snapshot,
    the save and the golden reference run unchanged.
- **Prior art:** `OptionsScreen.test.tsx` (screen + domain writes + no legacy
  localStorage), `preferences-context.test.tsx` (selector + write semantics),
  `DensityContext.test.tsx`/`FontContext.test.tsx` (provider round-trip and
  `documentElement`), `a11y.audit.test.tsx` + `lib/axe.ts` (axe harness),
  `campaign-screen-registry.test.tsx` (outlet routing), `type-floor.test.ts`
  (scaling guard), and the cross-process golden run for invariance.

### Acceptance criteria traceability

Each `.ai/SPRINT-PLAN.md` U-4 acceptance clause maps to stable requirement IDs
(see [`.ai/REQUIREMENTS.md`](../../.ai/REQUIREMENTS.md)) and the tests/gates that
prove it.

| # | Acceptance clause (U-4) | Requirement IDs | Proving test / gate |
| --- | --- | --- | --- |
| 1 | Seven sections; reachable from main menu and campaign | BW-PRS-002/004; ADR-0203/0209 | screen + registry/navigation tests |
| 2 | Live preview, reset per section and all | BW-PRS-002; ADR-0203 | preview + reset tests |
| 3 | Themes system/light/dark/high-contrast on every released screen | BW-PRS-002, BW-ARC-002; ADR-0203 | theme test + released-screen sweep |
| 4 | Text size, density, reduced motion, tooltip detail, keyboard focus, non-colour | BW-PRS-002, BW-ARC-002; ADR-0203 | application tests + a11y audit |
| 5 | Currency control with the three modes, default NC, disable/hide with reason, effective mode, campaign-change update | BW-PRS-003; ADR-0206/0207/0208/0211 | currency-control tests |
| 6 | Language lists only supported languages; locale only tested locales | BW-PRS-004; ADR-0209 | control tests |
| 7 | All strings externalized; en-US fallback; no raw keys | BW-PRS-004, BW-RUL-001; ADR-0209 | catalogue/fallback tests |
| 8 | Presentation invariance | BW-PRS-001, BW-ARC-002; ADR-0202 | invariance test + golden verify |

### Definition of done (reviewer checklist)

- [ ] The seven-section Options screen exists and is reachable from the main menu
      and from a campaign.
- [ ] Every control writes the U-2 domain with optimistic live preview; per-section
      and reset-all restore the central defaults; no `localStorage` preference store
      remains for these settings.
- [ ] `highContrast` is added to the one preferences schema and implemented through
      the token system; every released screen consumes semantic tokens.
- [ ] `textScale` applies at the shell root; `reducedMotion` overrides the media
      query; `tooltipDetail` drives the tooltip surface; keyboard focus and
      non-colour indicators are present and axe-clean.
- [ ] The currency control shows the three modes, defaults to Naval Credits,
      disables/hides National Historical with a stated reason, shows the effective
      mode truthfully, never describes NC as historical, and updates on campaign
      change.
- [ ] The language control lists only fully supported languages; the
      formatting-locale control lists only tested locales; they are independent.
- [ ] Strings are externalized with a stable-keyed catalogue and a complete en-US
      fallback; no raw key renders in production.
- [ ] No authoritative value, save/wire format, or golden hash changes; the
      invariance test proves it.
- [ ] All eight acceptance clauses are traceable to the named tests/gates above.
- [ ] Focused and full gates are green on the exact commit (see Further Notes);
      clean tree; Conventional Commit subjects.

## Out of Scope

- The preferences domain, storage, schema, scopes, capability and selectors
  (U-2, done).
- The formatters, conversion module, currency availability/resolution and the
  national-currency schema (U-3).
- Presentation-invariance as a standing suite (U-5).
- Per-nation National Historical currency configurations (owner decision, U-3 D7).
- Tactical report-detail/map-display/auto-pause preferences (T-2).
- Save slots, copy, autosave controls (F-4).
- Debug/dev screens (exempt).

## Further Notes

- **Dependency.** U-4 is externally blocked by **U-3** (formatters, conversion
  module, currency availability/resolution). Within this effort, tickets carry
  only sibling edges; the U-3 dependency is recorded here and in the map.
- **Gating.** U-4 is **golden-neutral and ungated**: it edits app-scope
  presentation preferences only, so no re-pin and no compatibility bump (the
  `highContrast` value is a preferences-schema addition, versioned through U-2, not
  a save/wire change). **Stop surface:** if a control would require an authoritative
  value, a save/wire-format change, a golden hash move, or invented historical
  currency data, stop and raise a decision request.
- **Manual grounding.** The manual has no settings screen and describes only
  scattered in-context options (`docs/research/u-2-preferences-domain.md` §4); the
  sections, themes, text scale, reduced motion, tooltip detail and currency control
  are Bluewave presentation design (ADR-0203/0202/0209/0206-0208/0211).
- **String-migration sizing.** D6 migrates the Options screen's strings; whether
  the remaining released screens' strings land in U-4 or a bounded follow-on is a
  sizing call at implementation, recorded rather than silently deferred.
- **Requirement traceability.** The role's `docs/requirements/REQUIREMENT-MAP.md`
  is absent in this checkout (unavailable under ADR-0210); mapping uses the stable
  IDs in `.ai/REQUIREMENTS.md`.
- **Validation commands.** Focused: the Options/preferences/a11y tests and
  `pnpm preflight`. Full orchestrator gate: clean uncached build (`vp run -r build
  --no-cache`), `tsc -b`, `pnpm lint`, `pnpm format`, the full test suite, the
  cross-process child run twice (byte-identical), `node
  scripts/verify-golden-hashes.cjs`, then `pnpm preflight`, `pnpm test:scripts`
  and `pnpm check`.
- **Compatibility.** U-4 changes no save/wire format and no compatibility version;
  it adds a preference value (`highContrast`) versioned through the U-2 schema.
- **Risk.** U-4 is not accepted until the screen is reachable from both entry
  points, every control drives the domain and takes effect, the currency and
  language controls are honest, the a11y audit passes, strings are externalized,
  and the invariance test shows no authoritative hash moves.
