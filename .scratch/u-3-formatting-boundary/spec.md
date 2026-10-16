# Spec: U-3 Formatting boundary

**Status:** done (sliced into `issues/`) · **Map:** `map.md` ·
**Decisions:** `decisions/D1`-`D7` · **Authority:** ADR-0202 (presentation-only),
ADR-0209 (language/locale), ADR-0206/0207/0208/0211 (currency modes),
ADR-0215/0216/0217/0218 (canonical table, money bridge, rounding/float gate,
conversion/locale boundary) · **Gating:** none on the boundary work — U-3 is
golden-neutral and ungated; per-nation currency **data** is a separate owner
decision (D7).

## Problem Statement

Bluewave's canonical values are exact and unit-agnostic: money is an integer
treasury unit (one unit = GBP 10,000), length/calibre are micrometres, speed is
micrometres per second, ratios are basis points, and campaign time is an integer
month/year (ADR-0215/0216). Presentation must render those values without ever
changing them (ADR-0202). Today it does not have one place to do so.

Formatting is scattered across the renderer with no single home: roughly two
dozen call sites use `"en-US"`, five use `"en-GB"`, dozens use the bare system
locale, and `£` is hard-coded; measurements are converted ad hoc (`/1000`,
`/1_000_000`, `/UM_PER_INCH`) at each call site; the ship-design cost model renders
micro-pounds directly. There is no formatter that understands the three currency
display modes, no currency **availability** logic (National Historical is claimed
only as a request), no localized number/date path, and no gate preventing the
next ad-hoc `toLocaleString`, `toFixed`, or unit conversion. A domain package
(`packages/ship-design/src/*`, `packages/phase-engine/src/reviseProject.ts`) still
builds human-readable strings, and UI language is not yet separated from
formatting locale in practice.

From the player's side this means numbers, money, dates and measurements can
change with the machine locale, a currency choice is not honestly reflected, and
units can silently disagree between screens. From the team's side, every later
surface (the Options screen U-4, presentation invariance U-5, tactical screens
T-2) would retrofit formatting that ADR-0218 already said must have exactly one
home.

## Solution

Build the one presentation formatting boundary ADR-0218 fixes: a single,
effect-free renderer-side module that renders canonical values and parses user
input, plus the matching source gate and the removal of the domain leak.

One module converts canonical→display and formats: measurements (imperial
default from manual p.18, metric alternative, per-category selections validated
against the canonical table), money in Naval Credits (default), Budget Points, or
a nation's validated National Historical configuration, percentages from basis
points, ordinary numbers honoring a `numberScale`, and campaign month/year dates
from the canonical integer month — with UI language and formatting locale kept
separate. Currency availability is computed from the active campaign and the
validated configuration; the requested mode resolves to an effective mode
(falling back to Naval Credits with a stated reason code) and the request is
never rewritten. Naval Credits is the render and malformed-content fallback, never
silent. User input is parsed once into canonical branded values, and a standing
gate bars any ad-hoc `Intl`/`toLocaleString`/`toFixed` or unit conversion outside
the module. Nothing authoritative changes; no historical currency data is
invented — the configurations are an owner decision with primary sources.

## User Stories

1. As a player, I want money shown in a currency I chose, so that I can read the
   game in the units that make sense to me.
2. As a player, I want Naval Credits as the default, so that the game reads the
   same whatever nation I play.
3. As a player, I want Budget Points as an abstract alternative, so that I can
   reason about the economy without a historical currency framing.
4. As a player, I want a nation's historical currency when it is properly
   configured, so that the game reflects the period.
5. As a player, I want the game to tell me honestly when a historical currency is
   not available, so that I am never shown a made-up one.
6. As a player, I want my currency choice remembered even when it cannot be shown,
   so that it is restored when it can.
7. As a player, I want my measurements in the manual's imperial units by default
   (inches, yards, pounds), so that the game reads like naval history.
8. As a player, I want a metric alternative, so that I can work in the units I
   know.
9. As a player, I want a per-category unit choice, so that a screen can show the
   unit I prefer for that quantity.
10. As a player, I want numbers and dates formatted in my chosen locale, so that
    they read naturally to me.
11. As a player, I want to read English while formatting numbers in a different
    locale, so that language and number formatting are independent choices.
12. As a player, I want long numbers abbreviated when I ask, so that dense screens
    stay readable.
13. As a player, I want campaign months shown as a localized month and year, so
    that the timeline reads correctly.
14. As a player, I want percentages shown the same way everywhere, so that basis
    points never appear as raw integers.
15. As a player, I want changing units, currency, number scale or locale never to
    change what happens in my campaign, so that presentation is not gameplay.
16. As a player, I want a value I enter in display units to be interpreted
    correctly, so that a measurement I type means what I expect.
17. As a content author, I want the display-unit taxonomy to be one declaration,
    so that I do not guess a suffix per screen.
18. As a content author, I want historical currency configurations validated
    (symbol, position, decimals, grouping, period, source), so that an invalid or
    unsourced configuration cannot ship.
19. As a content author, I want a malformed currency configuration to fall back to
    Naval Credits with a reason, so that bad content never breaks a screen or
    silently implies a supported economy.
20. As an engine developer, I want one presentation conversion module, so that
    canonical↔display conversion has exactly one home.
21. As an engine developer, I want the module to import only the runtime-free
    contracts and preferences contract, so that the renderer stays runtime-free.
22. As an engine developer, I want pure formatters with explicit locale and
    preference arguments, so that they are testable without Electron or the host
    locale.
23. As an engine developer, I want the module to own the canonical→display
    conversions, so that ad-hoc `/1000`-style conversion disappears.
24. As an engine developer, I want a single parse-once input path, so that a
    user-entered value is converted once and never re-parsed.
25. As an engine developer, I want a component-scoped gate, so that ad-hoc
    `Intl`/`toLocaleString`/`toFixed` and unit conversion cannot reappear.
26. As an engine developer, I want currency availability resolved from the active
    campaign and the validated configuration, so that the effective mode is
    truthful.
27. As an engine developer, I want the requested and effective modes distinct, so
    that a fallback never rewrites the stored request.
28. As an engine developer, I want no authoritative package to build display
    strings, so that presentation cannot leak into the domain.
29. As an engine developer, I want the content compiler to validate currency
    configurations at the compile boundary, so that invalid ones block downstream
    stages.
30. As an auditor, I want a formatter change to move no authoritative hash, so
    that presentation-only is enforced, not asserted.
31. As an auditor, I want no formatted text in saves and no save/wire-format
    change, so that the compatibility surface is untouched.
32. As an auditor, I want the fallback reason codes mapped to localized messages,
    so that an unavailable currency is explained.
33. As an auditor, I want tests that pin exact output per locale, so that a
    formatting regression is caught without host-locale dependence.
34. As an ARB owner, I want the manual's one grounded fact (imperial default,
    p.18) separated from the Bluewave-only formatting design, so that the manual
    is not over-read.
35. As an ARB owner, I want per-nation historical currency data left to an owner
    decision with primary sources, so that U-3 does not fabricate canonical
    content.
36. As a release engineer, I want U-3 to land with no golden re-pin and no
    compatibility bump, so that it ships independently of outcome work.
37. As a release engineer, I want the full gate green on the exact commit, so that
    acceptance is evidence, not a build.

## Implementation Decisions

Decisions live in the map (`decisions/D1`-`D7`); summarised here with the
interfaces U-3 fixes.

- **Scope boundary (D1).** U-3 owns the central formatters/parsers, the single
  presentation conversion module, currency availability/resolution, the
  national-currency configuration schema and its production validation, the
  parse-once input path and the component gate, and the domain-formatting-leak
  removal. It does not build preferences storage (U-2, done), the Options screen
  (U-4), the standing invariance suite (U-5), tactical preferences (T-2), or the
  per-nation historical currency **content** (an owner decision, D7).
- **Module home and shape (D2).** One effect-free presentation module under the
  renderer `lib/` presentation area, importing only `@bluewave/contracts` (the
  canonical table, `Money`, `BP_ONE`, `RoundingMode`) and the shared effect-free
  preferences contract; pure functions taking the value, the preference(s), and an
  explicit locale; no `effect`, no authoritative package, no Node, no new package.
- **Measurement presets (D3).** The module owns the canonical→display conversions
  and the display-unit taxonomy (speed `UmPerSec`→knots; length/calibre/armour/
  range `Um`→inches/yards or mm/m; mass `Kg`→tonnes/pounds; volume/power; ratio
  `Bp`→percent). `measurementPreset` (`imperial` default, p.18; `metric`) and
  `measurementSelections` come from U-2; U-3 validates selections against the
  canonical table.
- **Currency modes and resolution (D4).** Render canonical `Money` (treasury
  units, one = GBP 10,000) as Naval Credits (default, comparison unit), Budget
  Points (abstract), or National Historical (validated configuration). Availability
  from the active campaign + validated configuration; effective = request if
  available else `navalCredits` with a `CurrencyFallbackReason`
  (`noActiveNation`, `nationalCurrencyNotConfigured`, `nationalCurrencyInvalid`,
  `nationalCurrencyOutsideSupportedPeriod`); the request is never rewritten; NC is
  the render/malformed fallback, never silent.
- **National-currency schema (D4/D7).** A content schema and production validation
  for a national configuration: identifier, names, symbol and position, spacing,
  decimals, grouping, negatives, scale rules, period, source, gameplay
  interpretation, relabel-or-transform. Production validation rejects
  symbol-only, floating-point-factor, unsourced, unidentified, locale-conflicting
  or economy-altering configurations. **No production configurations ship** (D7).
- **Dates, numbers, locale (D5).** Format the canonical integer month/year (no
  wall clock) into a localized month/year; render numbers through the chosen
  `formattingLocale` honoring `numberScale` (`full`|`abbreviated`); percentages
  from `Bp`. UI language (string catalogue, en-US fallback) and formatting locale
  stay separate; the locale allowlist holds only locales with automated tests.
- **Parse-once and gate (D6).** Every user-entered value is parsed once into a
  canonical branded value; a standing component-scoped gate fails on ad-hoc
  `Intl`/`toLocaleString`/`toLocaleDateString`/`toFixed`, hard-coded symbols/unit
  suffixes, or ad-hoc unit conversion outside the module, proven by a self-test
  fixture; the ship-design/phase-engine formatting leak is removed.
- **Gating and authority (D7).** Authority ADR-0202/0209/0206-0208/0211/
  0215-0218; depends on U-2 (on `dev`) and U-1; golden-neutral and ungated; the
  national-currency data is an owner decision needing primary sources; stop if a
  formatter would move an authoritative value or require invented history.

## Testing Decisions

- **One seam.** Drive the formatters as pure functions with explicit inputs
  (value, preferences, locale) — a fixture, not a mock — and drive the currency
  availability/resolution through the real preferences contract and a compiled
  campaign/nation context. The highest existing seam for the boundary is the
  effect-free module itself plus the preferences contract; for availability it is
  the compiled content bundle. No new test seam is invented.
- A good test asserts **exact formatted output for an explicit locale** (never the
  host locale), the typed error `_tag` for an invalid value or configuration, and
  observable authoritative invariance. It never asserts internals or hard-coded
  path details.
- **Cover:**
  - **Measurements:** each category converts from the canonical value under both
    presets and a per-category selection; an unknown category or incompatible unit
    is rejected; the imperial default matches the manual's units (inches/yards/
    pounds).
  - **Money modes:** NC, BP and a fixture national-historical configuration each
    render exact strings; the malformed/unsupported case falls back to NC with the
    right reason code; no `customCurrency`.
  - **Currency availability/resolution:** the effective mode is derived from the
    active campaign + configuration; the stored request survives an unsupported
    context unchanged; each reason code maps to a message.
  - **National-currency validation:** a valid fixture passes; symbol-only,
    floating-point-factor, unsourced, unidentified, locale-conflicting and
    economy-altering configurations are rejected at the compile boundary.
  - **Dates/numbers/locale:** campaign month/year and numbers render exactly per
    locale; `numberScale` abbreviates; language and locale change independently;
    an unsupported locale is not selectable.
  - **Parse-once:** a display-unit input parses once into the canonical value and
    round-trips; no double conversion.
  - **Gate:** the ad-hoc-formatting gate fails on a violating fixture and passes on
    the clean tree; the domain formatting leak is gone (source guard).
  - **Invariance:** changing every preference (modes, presets, scale, locale)
    leaves the compiled campaign snapshot, the save and the golden reference run
    unchanged; no formatted text is persisted.
- **Prior art:** the canonical-unit tests (`packages/contracts/test/units.test.ts`,
  `packages/ship-design/test/treasury-units.test.ts`), the preferences contract/
  store/bridge/context tests (`apps/desktop/src/shared/preferences-contract.test.ts`,
  `apps/desktop/src/main/preferences/*.test.ts`, `.../renderer/lib/preferences-context.test.tsx`),
  the renderer formatting tests to be replaced (`preTurnReviewFormat.test.ts`,
  `campaign-month.test.ts`, `status-strip-state.test.ts`, `engineering-status.test.ts`),
  the source guards (`content-boundary.test.ts`, `priorities.test.ts`), and the
  cross-process golden run for the invariance assertion.

### Acceptance criteria traceability

Each `.ai/SPRINT-PLAN.md` U-3 acceptance clause maps to stable requirement IDs
(see [`.ai/REQUIREMENTS.md`](../../.ai/REQUIREMENTS.md)) and the tests/gates that
prove it.

| # | Acceptance clause (U-3) | Requirement IDs | Proving test / gate |
| --- | --- | --- | --- |
| 1 | Central formatters/parsers (measurements, money, dates, localized numbers) | BW-PRS-001/004, BW-RUL-001; ADR-0202/0218 | module unit tests (explicit locale) |
| 2 | NC/BP/national-historical rendering | BW-PRS-003; ADR-0206/0207/0211 | money-mode tests + fixture config |
| 3 | Content-driven currency availability; validated national configurations | BW-PRS-003; ADR-0211 | availability test + content-compile validation tests |
| 4 | Production validation rejects bad configurations | BW-CMP-001, BW-RUL-001; ADR-0211 | compile-boundary rejection tests |
| 5 | Effective-mode reason codes mapped to localized messages | BW-PRS-003, BW-PRS-004; ADR-0209/0211 | resolution + message-mapping tests |
| 6 | NC is the render/malformed fallback, never silent | BW-PRS-003; ADR-0211 | malformed-content fallback test |
| 7 | Single parse-once input path | BW-PRS-001, BW-CMD-001; ADR-0202/0218 | parser round-trip test |
| 8 | Boundary and round-trip tests; no formatted money in saves | BW-PER-001/003, BW-ARC-002; ADR-0202 | boundary/round-trip test + save inspection |
| 9 | Presentation invariance | BW-PRS-001/004, BW-ARC-002; ADR-0202 | invariance test + golden verify |
| 10 | Domain formatting leak removed; ad-hoc gate | BW-RUL-001, BW-ARC-001; ADR-0218 | source gate + `priorities.test.ts` precedent |

### Definition of done (reviewer checklist)

- [ ] One effect-free presentation module in the renderer `lib/` area owns all
      canonical↔display conversion and formatting; it imports no `effect`, no
      authoritative package, no Node; no new package.
- [ ] Measurements render under both presets and per-category selections, with
      selections validated against the canonical table; the imperial default
      matches p.18.
- [ ] Money renders in NC/BP and a fixture national-historical configuration; the
      malformed/unsupported case falls back to NC with a reason code; no
      `customCurrency`.
- [ ] Currency availability is computed from the active campaign + validated
      configuration; the effective mode is derived and the stored request is never
      rewritten.
- [ ] A national-currency configuration schema and production validation exist and
      reject symbol-only, floating-point-factor, unsourced, unidentified,
      locale-conflicting and economy-altering configurations; **no production
      configuration** ships.
- [ ] Campaign dates format from the canonical integer month (no wall clock);
      numbers honor `formattingLocale` and `numberScale`; language and locale are
      independent; only tested locales are selectable.
- [ ] A single parse-once input path converts user input into canonical branded
      values.
- [ ] The component-scoped gate fails on a violating fixture and passes clean; the
      ship-design/phase-engine formatting leak is removed.
- [ ] No authoritative value, save/wire format, or golden hash changes; the
      invariance test proves it.
- [ ] All ten acceptance clauses are traceable to the named tests/gates above.
- [ ] Focused and full gates are green on the exact commit (see Further Notes);
      clean tree; Conventional Commit subjects.

## Out of Scope

- The preferences domain, its storage, schema, scopes, capability and selectors
  (U-2, on `dev`).
- The Options screen sections, live preview, reset controls and the externalized
  string catalogue (U-4).
- Presentation-invariance as a standing suite across modes/presets (U-5).
- **Per-nation National Historical currency configurations** — an owner decision
  requiring primary historical sources; a decision request, not a U-3 deliverable
  (D7). U-3 ships the schema and validation; it ships no configurations.
- Tactical report-detail/map-display/auto-pause preferences (T-2).
- Changing the canonical representation, the save format, the wire format, or any
  authoritative value (D7).
- Any new package or runtime dependency.

## Further Notes

- **Gating.** U-3's boundary work is **golden-neutral and ungated**: it renders
  canonical values and stores nothing authoritative, so it needs no golden re-pin
  and no compatibility bump. **Stop surface:** if a formatter turns out to require
  an authoritative value, a save/wire-format change, a golden hash move, or
  invented historical currency data, stop and raise a decision request rather than
  resolving it in U-3.
- **Manual grounding.** Only the imperial measurement default (p.18) is a manual
  fact; the currency modes, locale split and all formatting are Bluewave design
  (ADR-0202/0209/0206-0208/0211). See `docs/research/rtw3-manual-baseline.md` and
  `docs/research/u-1-canonical-values.md` §5.
- **Recommendation for the owner.** Per-nation historical currency data should be
  captured as a decision request (owner + primary sources) before National
  Historical is offered; U-3 must not invent it (D7).
- **Requirement traceability.** The role's `docs/requirements/REQUIREMENT-MAP.md`
  is absent in this checkout (unavailable under ADR-0210); mapping uses the stable
  IDs in `.ai/REQUIREMENTS.md`.
- **Validation commands.** Focused: the formatter/contract/preferences tests and
  `pnpm preflight` (tracker-consistency, boundary-decode, runtime-free gates).
  Full orchestrator gate: clean uncached build (`vp run -r build --no-cache`),
  `tsc -b`, `pnpm lint`, `pnpm format`, the full test suite, the cross-process
  child run twice (byte-identical), `node scripts/verify-golden-hashes.cjs`, then
  `pnpm preflight`, `pnpm test:scripts` and `pnpm check`.
- **Compatibility.** U-3 introduces no save/wire-format change and no
  compatibility-version bump; it adds presentation code and a new content schema
  (unused by production until configurations are authored).
- **Risk.** U-3 is not accepted until the module is the single conversion home,
  the modes/resolution render truthfully, the gate holds, the leak is gone, and
  the invariance test shows no authoritative hash moves.
