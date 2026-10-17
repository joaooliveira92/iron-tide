# Spec: U-2 Preferences domain

**Status:** done (sliced into `issues/`) · **Map:** `map.md` ·
**Decisions:** `decisions/D1`-`D7` · **Authority:** ADR-0203 (architecture),
ADR-0202 (presentation-only), ADR-0209 (language/locale), ADR-0206/0207/0208/0211
(currency modes) · **Gating:** none — U-2 is golden-neutral and ungated (D7).

## Problem Statement

Bluewave is a deterministic game whose presentation must never change the
simulation: units, currency, language, theme, and density are display preferences
over canonical values (ADR-0202). Today those preferences have no home. Each one
is a hard-coded `localStorage` key owned by a separate renderer context
(`bluewave-theme`, `bluewave-density`, `bluewave-font`, `bluewave-background`),
plus a separate campaign display-preference key; there is no versioned schema, no
defaults, no validation, no migration, no scoping, and no main-process storage.

From the player's side this shows up as settings that cannot be trusted or moved:
there is no way to change a preference before a campaign exists, no guarantee a
corrupt or stale value is recovered, and no single place the game agrees on what a
setting is. From the team's side, the Options screen (U-4) has nothing to build
on: the formatting boundary (U-3) and the presentation-invariance tests (U-5)
would each have to invent their own storage, validation, and scope handling — and
the runtime-free renderer has no safe way to read a preference that was validated
at the boundary.

The currency settings sharpen this: ADR-0211 requires the player's **requested**
currency-display mode to be stored and preserved, while the **effective** mode is
resolved at runtime (falling back to Naval Credits when no validated national
configuration applies) — and the request must never be rewritten by a fallback.
No such model exists.

## Solution

Give preferences one versioned, validated, migrated, atomically-persisted home in
the desktop application, and confine every consumer to typed selectors over it.

Preferences are an application concern, not a game-domain concern, so the domain
lives inside the desktop app: a main-process module owns a strict Effect `Schema`,
the central defaults, a version constant, pure migration steps, the scope
resolution, and atomic file storage; an effect-free shared module holds the
renderer-facing keys, value unions, and decoded shape, with a parity test binding
the two. A dedicated narrow preload capability
(`preferences.read`/`preferences.write`) crosses the boundary, decoding every
payload with a strict schema and rejecting excess keys. The renderer reads and
writes through typed selectors and imports no `effect` and no `localStorage`.

Preferences are scoped: **app** (cross-campaign presentation and the currency
request), **campaign** (per-campaign display preferences, stored in a campaign
sidecar), and **session** (in-memory only), resolved as
`session ?? campaign ?? app ?? default`. Existing settings are migrated
deterministically from the `localStorage` era; corrupt or unknown values recover
to the central defaults without touching saves. Preferences never enter the save
snapshot, so no authoritative hash moves.

Nothing about gameplay changes: U-2 stores presentation preferences and models
the currency request/effective split; U-3 renders them, U-4 exposes them, U-5
proves them invariant.

## User Stories

1. As a player, I want my display settings to persist across restarts, so that I
   do not re-choose theme, density, and font every time I launch the game.
2. As a player, I want to change presentation settings before I have started a
   campaign, so that the game looks how I want from the first screen.
3. As a player, I want my settings to follow me across campaigns, so that I set
   my preferences once.
4. As a player, I want a per-campaign display preference to override my global
   one, so that a campaign can look different without changing my defaults.
5. As a player, I want a temporary display choice to apply just for this session,
   so that experimenting does not change my saved preferences.
6. As a player, I want my stored currency-display *request* to be remembered even
   when the current nation cannot honour it, so that it is restored when it can.
7. As a player, I want the game to show an effective currency mode truthfully
   when my request cannot be honoured, so that I am never misled.
8. As a player, I want a corrupt or outdated settings file to fall back to safe
   defaults instead of breaking startup, so that a bad setting never costs me my
   game.
9. As a player, I want changing units, currency, language, theme, or density
   never to change what happens in my campaign, so that presentation is not
   gameplay.
10. As a player, I want to read English while formatting numbers and dates in my
    preferred locale, so that language and number formatting are independent.
11. As a player, I want the measurement default to match the manual's imperial
    units, so that the game reads the way naval history does.
12. As a player, I want a text-size and density control that survives restarts, so
    that I can make the interface readable for me.
13. As a player, I want a reduced-motion preference that is remembered, so that I
    do not reset it every session.
14. As a player, I want a tooltip-detail preference that is remembered, so that
    the interface shows the level of information I chose.
15. As a player, I want an invalid value I somehow stored to be corrected to a
    valid default, so that the game never shows a broken control.
16. As a content author, I want the preferences domain to know nothing about
    canonical units or money, so that presentation never leaks into content.
17. As a content author, I want the measurement preset to be a display choice
    over canonical values, so that no authored value depends on the player's
    units.
18. As an engine developer, I want the preferences schema to be the single
    definition, strict at the boundary, so that I do not hand-parse settings.
19. As an engine developer, I want an effect-free shared contract for the
    renderer, so that the runtime-free gate is not weakened.
20. As an engine developer, I want a parity test binding the shared type to the
    schema, so that the two definitions cannot drift.
21. As an engine developer, I want deterministic, ordered, total migration, so
    that the same legacy state always migrates to the same preferences.
22. As an engine developer, I want atomic app-scope writes, so that a crash mid-
    write cannot corrupt my preferences.
23. As an engine developer, I want a dedicated narrow preload capability, so that
    preferences do not ride the campaign command channel or open a generic IPC.
24. As an engine developer, I want strict boundary decoding that rejects excess
    keys, so that a malformed or hostile payload cannot slip through.
25. As an engine developer, I want typed per-key selectors, so that components
    read one value with one type.
26. As an engine developer, I want the existing theme/density/font/background and
    campaign display preferences rewired onto the domain, so that `localStorage`
    stops being a second preference store.
27. As an engine developer, I want preferences to live outside the save snapshot,
    so that no authoritative hash depends on them.
28. As an auditor, I want the requested and effective currency modes modelled
    separately, so that a fallback can never rewrite the stored request.
29. As an auditor, I want recovery of corrupt/unknown values to be explicit and
    logged, so that silent repair cannot hide a defect.
30. As an auditor, I want a test proving no preference change moves the campaign
    or golden hash, so that presentation-only is enforced, not asserted.
31. As an auditor, I want no save file or wire format changed by U-2, so that the
    compatibility surface is untouched.
32. As an ARB owner, I want the taxonomy's manual-backed settings separated from
    the Bluewave-only ones, so that the manual is not over-read.
33. As an ARB owner, I want the manual-silent enumerations (autosave cadence,
    report/map/auto-pause) left to F-4/T-2, so that U-2 does not invent values.
34. As a release engineer, I want U-2 to land with no golden re-pin and no
    compatibility bump, so that it can ship independently of S-1/U-1 outcome work.
35. As a release engineer, I want the full gate green on the exact commit, so that
    acceptance is evidence, not a build.

## Implementation Decisions

Decisions live in the map (`decisions/D1`-`D7`); summarised here with the
interfaces U-2 fixes.

- **Scope boundary (D1).** U-2 owns the versioned schema, central defaults, strict
  validation, deterministic migration, the app/campaign/session scope model,
  atomic main-process persistence, the narrow preload capability, typed renderer
  selectors, and the requested/effective currency-mode model. It does not build
  the formatters/parsers or currency availability (U-3), the Options screen (U-4),
  invariance tests (U-5), national-historical currency content (U-3), campaign
  start options, save slots/autosave (F-4), or tactical preferences (T-2).
  Existing renderer settings are migrated and their controls rewired in U-2; the
  Options screen itself is U-4.
- **Home and shape (D2).** Preferences live in the desktop app, not a package: a
  main-process model holds the versioned Effect `Schema`, defaults, version
  constant, pure `migrate` steps, scope resolution, and the atomic store; an
  effect-free shared module holds the keys, value unions, scope enum, and decoded
  shape for the renderer; a parity test asserts the shared type equals the
  schema's decoded type. No new package; no new persistence dependency (atomic
  write is the existing `tmp` + rename pattern).
- **Scopes and precedence (D3).** App scope (cross-campaign presentation +
  `currencyDisplayMode` request) in one app-data JSON file; campaign scope (the
  existing display preferences) in a campaign sidecar beside the existing
  per-campaign files; session scope in memory only. Resolution
  `session ?? campaign ?? app ?? default`; a session value never persists; the
  effective currency mode is derived, not stored.
- **Settings taxonomy (D4).** The key set, types, defaults and validation in D4,
  grounded per ADR-0203 and the U-2 research note. `theme` (`system|light|dark|
  highContrast`), `background` (the eight existing styles), `font` (`inter|
  jakarta`), `textScale` (bounded integer percent, default `100`),
  `interfaceDensity` (`comfortable|compact`), `reducedMotion` (`system|reduce|
  noPreference`), `language` (`en`), `formattingLocale` (validated allowlist,
  initially `en-US`), `measurementPreset` (`imperial|metric`, default imperial),
  `measurementSelections` (per-category, validated against the canonical table),
  `numberScale`, `tooltipDetail`, and `currencyDisplayMode`
  (`navalCredits|budgetPoints|nationalHistorical`, default `navalCredits`, no
  `customCurrency`). Campaign scope: `showDetailedTooltips`, `confirmBeforeTurn`,
  `showUnitFatigue`, `showSupplyOverlay`.
- **Migration, recovery, currency (D5).** A version constant stamps each file;
  migration is a pure, ordered, total list of steps from the implicit
  `localStorage`-era `0` to `1`, idempotent, filling missing keys from defaults.
  Corrupt/undecodable files or unknown/out-of-range values recover to defaults
  with a logged diagnostic, never failing startup and never touching saves. The
  domain stores the currency **request** and models the derived **effective**
  mode; fallback to `navalCredits` with reason codes (`noActiveNation`,
  `nationalCurrencyNotConfigured`, `nationalCurrencyInvalid`,
  `nationalCurrencyOutsideSupportedPeriod`) is U-3's resolution, never rewriting
  the request.
- **Capability and selectors (D6).** A dedicated `preferences.read` /
  `preferences.write` capability on `window.bluewave`, with strict
  `{ onExcessProperty: "error" }` decode at the main boundary and stable `_tag`
  errors; app-scope writes atomic, campaign writes in the sidecar; renderer
  selectors are typed hooks over the effect-free shared contract that import no
  `effect` and never read `localStorage`.
- **Gating and authority (D7).** Authority ADR-0203/0202/0209/0206-0208/0211;
  depends only on U-1's landed structural tickets; golden-neutral; ungated; no new
  decision request. Stop if a setting would move an authoritative value, hash, or
  wire format.

## Testing Decisions

- **One seam.** Drive the real desktop composition: the main-process preferences
  store over a temporary app-data directory, the preload capability across the
  boundary, and the renderer selectors consuming it. The highest existing seam is
  the main/preload boundary already exercised by the command tests; no new seam is
  invented. The domain model can additionally be tested directly because it is
  pure (schema, defaults, migration, resolution) — a fixture, not a mock.
- A good test sets up through production composition, replaces only true external
  boundaries (the app-data directory, and the OS reduced-motion signal), and
  asserts observable behaviour: the decoded preference value, the typed error
  `_tag`, the persisted file contents, the recovered defaults. It never asserts
  internals or file paths that will go stale.
- **Cover:**
  - **Schema/validation:** each key rejects an out-of-range value and an unknown
    key with a stable `_tag`; defaults are the ADR-0203/D4 values; the
    `currencyDisplayMode` union has no `customCurrency`.
  - **Persistence and atomicity:** an app-scope write round-trips through the
    store; a simulated mid-write failure leaves either the old or the new file,
    never a partial one; a campaign-scope write lands in the campaign sidecar.
  - **Scopes and precedence:** session overrides campaign overrides app overrides
    default; a session value is gone after the session closes and never rewrites
    the app value.
  - **Migration:** the `localStorage`-era values migrate to the versioned state
    deterministically and idempotently; unknown legacy values become defaults.
  - **Recovery:** a corrupt file and an unknown value each recover to defaults
    with a diagnostic, and no save file is touched.
  - **Currency model:** the stored request survives an unsupported context
    unchanged; the effective mode is derived and never rewrites the request.
  - **Boundary:** the preload capability rejects an excess-key or malformed
    payload with a typed error and decodes a valid one; the renderer imports no
    `effect` (the runtime-free gate) and the shared type matches the schema
    (parity).
  - **Invariance:** changing every preference (both currency modes, both unit
    presets, language/locale, theme, density) leaves the compiled campaign
    snapshot, the save, and the golden reference run unchanged.
- **Prior art:** the existing `withStrictSchema`/`withSchema` command decoding and
  its tests (`campaignCommandSchemas.test.ts`), the sidecar persistence and UI-state
  tests (`uiState.ts`/`sidecarStores.ts` and their tests), the settings/theme
  renderer context tests (`OptionsScreen.test.tsx` and the context tests), and the
  cross-process golden run (`packages/cross-process-test`) for the invariance
  assertion.

### Acceptance criteria traceability

Each `.ai/SPRINT-PLAN.md` U-2 acceptance clause maps to stable requirement IDs
(see [`.ai/REQUIREMENTS.md`](../../.ai/REQUIREMENTS.md)) and the tests/gates that
prove it.

| # | Acceptance clause (U-2) | Requirement IDs | Proving test / gate |
| --- | --- | --- | --- |
| 1 | Versioned schema, central defaults, validation | BW-PRS-002, BW-STA-001; ADR-0203 | schema/validation tests; parity test |
| 2 | Deterministic migration | BW-PRS-002; ADR-0203 | migration determinism/idempotence test |
| 3 | Atomic main-process persistence | BW-PRS-002, BW-PER-002; ADR-0203 | atomic round-trip + interrupted-write test |
| 4 | Narrow preload capability, typed selectors | BW-PRS-002, BW-ARC-001; ADR-0203, ADR-0159 | preload boundary test; runtime-free gate |
| 5 | App, campaign and session scopes | BW-PRS-002; ADR-0203 | scope-precedence test |
| 6 | Settings key set | BW-PRS-001/002/004; ADR-0202/0203/0209 | schema tests; D4 table |
| 7 | `currencyDisplayMode` union (no custom) | BW-PRS-003; ADR-0206/0207/0208/0211 | schema union test |
| 8 | Requested vs effective modelled separately | BW-PRS-003; ADR-0211 | currency request-survival test |
| 9 | Corrupt/unknown recovers without touching saves | BW-PRS-002; ADR-0203 | recovery test + save-untouched assertion |
| 10 | Presentation invariance | BW-PRS-001/004, BW-ARC-002; ADR-0202 | invariance test + golden verify |

### Definition of done (reviewer checklist)

- [ ] The preferences schema, defaults, version constant, migration, scope model,
      and atomic store exist in the desktop main process; the effect-free shared
      contract exists for the renderer; a parity test binds them.
- [ ] Every D4 key is validated strictly; the `currencyDisplayMode` union has no
      `customCurrency` and no fallback-status value.
- [ ] App-scope persistence is atomic; campaign-scope preferences live in a
      campaign sidecar; session scope is in-memory only; precedence is
      `session ?? campaign ?? app ?? default`.
- [ ] Deterministic, idempotent, total migration from the `localStorage` era;
      corrupt/unknown values recover to defaults, logged, without touching saves.
- [ ] The requested and effective currency modes are modelled separately; the
      request is never rewritten by a fallback.
- [ ] The `preferences.read`/`preferences.write` capability decodes strictly at the
      boundary and rejects excess keys with a stable `_tag`; the renderer imports
      no `effect` and no `localStorage`.
- [ ] The existing theme/background/font/density controls and the campaign display
      preferences are rewired onto the domain (no second preference store).
- [ ] No authoritative value, no save/wire format, and no golden hash changes;
      the invariance test proves it.
- [ ] All ten acceptance clauses are traceable to the named tests/gates above.
- [ ] Focused and full gates are green on the exact commit (see Further Notes);
      clean tree; Conventional Commit subjects.

## Out of Scope

- Central formatters and parsers, currency-mode availability/resolution and
  reason-code messages, and the render fallback (U-3).
- The Options screen sections, live preview, reset controls, themes on every
  released screen, and externalized strings (U-4).
- Presentation-invariance and round-trip tests across modes and presets (U-5).
- Per-nation National Historical currency configuration content (U-3; needs an
  owner and primary historical sources).
- Save slots, copy-to-slot, and autosave count/cadence (F-4; manual pp.22-23, and
  the cadence values are manual-silent).
- Tactical-battle preferences — realism levels (manual pp.98-99), report detail,
  map display, auto-pause events, game speed (pp.81/88/98) — T-2.
- Campaign-start options (research speed, technology variation, historical
  budgets, legacy-fleet build) — compiled new-game configuration, not preferences.
- Key rebinding (manual hotkeys are fixed, pp.137-138); audio and display-device
  settings.
- Any new package or persistence dependency; any ADR beyond those already
  accepted (ADR-0203 fixes the architecture).

## Further Notes

- **Gating.** U-2 is **golden-neutral and ungated**: it stores presentation
  preferences outside the save snapshot and changes no authoritative outcome, so it
  needs no golden re-pin and no compatibility bump, and no open decision request
  blocks it (D7). **Stop surface:** if a setting turns out to require an
  authoritative value, a save/wire-format change, or a golden hash move, stop and
  raise a decision request rather than resolving it in U-2.
- **Manual grounding.** Only the measurement default (p.18) and the save/realism/
  tactical options the manual names are manual facts; the settings taxonomy,
  theme, text-scale, reduced-motion, tooltip-detail, number-scale, locale and
  currency-display settings are Bluewave presentation design (ADR-0203/0202/0209/
  0206-0208/0211). See `docs/research/u-2-preferences-domain.md` §5.
- **Requirement traceability.** The role's `docs/requirements/REQUIREMENT-MAP.md`
  is absent in this checkout (unavailable under ADR-0210); mapping uses the stable
  IDs in `.ai/REQUIREMENTS.md`.
- **Validation commands.** Focused: the desktop preferences/command/sidecar tests
  and `pnpm preflight` (which runs the tracker-consistency and boundary-decode
  gates). Full orchestrator gate: clean uncached build (`vp run -r build
  --no-cache`), `tsc -b`, `pnpm lint`, `pnpm format`, the full test suite, the
  cross-process child run twice (byte-identical), `node
  scripts/verify-golden-hashes.cjs`, then `pnpm preflight`, `pnpm test:scripts`
  and `pnpm check`.
- **Compatibility.** U-2 introduces a new preferences persistence format (app-scope
  file and campaign sidecar), versioned from `0` (the `localStorage` era). It does
  not touch the save format, the wire formats, or any compatibility version.
- **Risk.** U-2 is not accepted until the domain is strict, migration and recovery
  are deterministic, the boundary is decoded, the existing consumers are rewired,
  and the invariance test shows no authoritative hash moves.
