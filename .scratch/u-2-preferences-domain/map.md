# Map: U-2 Preferences domain

**Label:** wayfinder:map · **Status:** charted; the route is clear — no ticket
remains to decide before implementation. U-2 is golden-neutral and ungated.

## Destination

A spec and a ticket set for sprint U-2 (`.ai/SPRINT-PLAN.md` Phase 2): a
versioned, strictly validated, deterministically migrated, atomically persisted
preferences domain with app, campaign, and session scopes, a narrow preload
capability and typed renderer selectors — the architecture ADR-0203 fixes, on
which the formatting boundary (U-3) and the Options screen (U-4) are then built.
No implementation happens in this effort.

## Notes

- Authority order per ADR-0210. ADR-0203 governs the architecture; ADR-0202 the
  presentation-only constraint; ADR-0209 the language/locale split; ADR-0206/0207/
  0208/0211 the currency display modes. The manual is authority 3 and grounds only
  the measurement default (p.18) and the options it names; the settings taxonomy
  is Bluewave design — see
  [`docs/research/u-2-preferences-domain.md`](../../docs/research/u-2-preferences-domain.md).
  Simulation matches RTW3; only UI/UX may deviate.
- Resolved by the orchestrator without a live human (user directive: run
  autonomously). Each decision derives from a higher authority, not a gameplay
  preference; the manual's silence is already covered by accepted ADRs, so this
  effort raises no decision request and hits no stop condition.
- Existing surfaces U-2 builds on: renderer app-scope settings in `localStorage`
  (`ThemeContext`, `DensityContext`, `FontContext`, `BackgroundContext`); the
  campaign display-preference hook (`useDisplayPreferences`); the Electron
  main/preload/renderer boundary (`preload/index.ts`, the `withStrictSchema`
  decode pattern, `assert-boundary-decode.mjs`); the atomic-write sidecar pattern
  (`sidecarStores.ts`) and the campaign package layout; U-1's canonical units and
  branded money in `packages/contracts`.
- U-2 is an **application** concern, not a game domain: preferences never enter
  authoritative state, so it adds no package to the domain graph and moves no
  golden hash.
- Skills: `to-spec`, `to-tickets`, `tdd` for implementation later.

## Decisions so far

- [D1 Scope boundary](decisions/D1-scope-boundary.md): U-2 owns the versioned
  schema, defaults, validation, deterministic migration, scopes, persistence,
  preload capability, selectors and the requested/effective currency model; the
  formatters (U-3), the Options screen (U-4) and invariance tests (U-5) are named
  seams; campaign-start options, autosave slots (F-4) and tactical preferences
  (T-2) are not preferences.
- [D2 Home and shape](decisions/D2-home-and-shape.md): an app-local main-process
  model (strict Effect `Schema` + atomic store) with an effect-free shared
  renderer contract, tied by a parity test; no new package, no new dependency.
- [D3 Scopes and precedence](decisions/D3-scopes-and-precedence.md): app scope =
  cross-campaign presentation + the stored currency request; campaign scope = the
  existing display preferences in a campaign sidecar; session scope = in-memory;
  resolve `session ?? campaign ?? app ?? default`.
- [D4 Settings taxonomy](decisions/D4-settings-taxonomy.md): the exact keys,
  value types, defaults and validation, with the manual-backed (measurement
  default) separated from the Bluewave-only presentation settings.
- [D5 Migration, recovery, currency](decisions/D5-migration-recovery-currency.md):
  pure ordered versioned migration from the `localStorage` era; corrupt/unknown
  values recover to defaults without touching saves; the currency request is
  stored and the effective mode derived (never rewriting the request).
- [D6 Capability and selectors](decisions/D6-capability-and-selectors.md): a
  dedicated narrow `preferences.read`/`preferences.write` capability with strict
  boundary decode and typed effect-free renderer selectors; existing consumers
  rewired off `localStorage`.
- [D7 Gating and authority](decisions/D7-gating-and-authority.md): authority
  ADR-0203/0202/0209/0206-0208/0211; depends only on U-1's landed structural
  tickets; golden-neutral and ungated; no new decision request; stop if a setting
  would move an authoritative value, hash, or wire format.

## Not yet specified

- The `numberScale` and `measurementSelections` taxonomy — which presets/categories
  exist and how a preset maps to a formatter — is a U-3 concern; U-2 stores a
  validated selection, not the mapping.
- Where the presentation conversion module lives (renderer vs a shared module) and
  how it consumes the stored preset — U-3.
- The `formattingLocale` allowlist (only locales with automated formatting tests)
  — U-3 populates it; U-2 validates against it.
- Whether `reducedMotion`/`theme` also follow an OS signal at runtime — a U-4
  presentation choice over the stored preference.
- The exact app-scope file location and name within `AppPaths` — settled at
  implementation.

## Out of scope

- Central formatters/parsers, currency-mode availability/resolution, reason-code
  messages and render fallback — U-3.
- The Options screen sections, live preview, reset controls, themes-on-every-screen
  and externalized strings — U-4.
- Presentation-invariance and round-trip tests across modes/presets — U-5.
- Per-nation National Historical currency configuration content — U-3 (needs an
  owner and primary sources).
- Save slots, copy-to-slot, autosave count/cadence — F-4 (manual pp.22-23; the
  cadence values are manual-silent).
- Tactical-battle preferences: realism levels (manual pp.98-99), report detail,
  map display, auto-pause events, game speed (pp.81/88/98) — T-2.
- Campaign-start options (research speed, technology variation, historical
  budgets, legacy-fleet build) — compiled new-game configuration, not preferences
  (manual p.19/21).
- Key rebinding (the manual's hotkeys are fixed, pp.137-138); audio and
  display-device settings (not in the manual's option set).
