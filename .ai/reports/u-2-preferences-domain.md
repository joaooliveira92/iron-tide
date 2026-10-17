# Validation report: U-2 Preferences domain

Status: **accepted** as of `feat/u-4-options-screen` (U-2 tickets 01–07). The
versioned preferences domain, its scopes and precedence, the currency
requested→effective model, migration/recovery, the narrow preload capability, the
boundary/parity tests, and the invariance guard are complete and green. The
controls that expose the language, formatting-locale and measurement preferences
are built and delivered by the U-4 Options screen (tickets 03/04 controls).

## What landed

| Ticket                                                  | State | Evidence                                                                                                                         |
| ------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| 01 versioned domain, persistence, capability, selectors | done  | `src/shared/preferences-contract.ts`, `src/main/preferences/{preferencesSchema,preferencesStore,preferencesBridge}.ts` + tests   |
| 02 currency display mode (requested vs effective)       | done  | `resolveEffectiveCurrencyDisplayMode` + `preferences-contract.test.ts` (5 tests)                                                 |
| 03 UI language and formatting locale                    | done  | `LANGUAGE_PREFERENCES`/`FORMATTING_LOCALES`; controls delivered by the U-4 Options screen                                        |
| 04 measurement preset and per-category selections       | done  | `MEASUREMENT_PRESETS` + validated selections; controls delivered by the U-4 Options screen                                       |
| 05 campaign scope and precedence                        | done  | `campaignPreferencesStore.ts` + `campaignPreferencesStore.test.ts` (3 tests)                                                     |
| 06 deterministic migration and corruption recovery      | done  | `preferencesMigration.test.ts` (4 tests); `preferencesStore.ts` recovers unknown/corrupt/excess-key data without touching a save |
| 07 U-2 acceptance                                       | done  | this report; `preferencesInvariance.test.ts`, parity/boundary/runtime-free evidence below                                        |

## Commands run and observed results

- `pnpm --filter @bluewave/desktop exec vp test run src/shared/preferences-contract.test.ts src/main/preferences src/renderer/lib/preferences-context.test.tsx src/renderer/screens/options/OptionsScreen.test.tsx`
  → **8 files, 46 tests passed** (includes `preferencesSchema` 8, `preferencesBridge`
  6, `campaignPreferencesStore` 3, `preferencesMigration` 4, `preferences-contract`
  5, and the new `preferencesInvariance` 3).
- Parity: `preferencesSchema.test.ts` "binds the shared contract to the schema
  decoded type in both directions" → passed (the shared renderer contract equals
  the schema's decoded type).
- Boundary: `preferencesBridge.test.ts` rejects an excess-key, a malformed and a
  non-object payload with the typed `InvalidPreferencesPayload` `_tag`, and decodes
  a valid object → passed.
- Runtime-free: `preflight`'s `assert-runtime-free` and
  `src/renderer/lib/presentation-format/boundary.test.ts` → the renderer imports no
  `effect`; passed.
- Invariance: `src/main/preferences/preferencesInvariance.test.ts` → every
  preference value (all themes, backgrounds, fonts, densities, text scales,
  reduced-motion, language, locale, measurement preset, number scale, tooltip
  detail, currency mode) decodes through the strict schema, the preferences domain
  imports no `@bluewave/*` authoritative package, the shared contract imports
  nothing, and `golden/hashes.json` is unchanged; passed. The cross-process golden
  run (`pnpm test:cross-process`) is byte-identical across two runs and
  `success: true`.
- `node scripts/verify-golden-hashes.cjs` → **All 11 hashes match golden reference**.
- `pnpm preflight` → **exit 0** (43 tasks).
- Full desktop suite → **2149 passed, 1 skipped**.

## Determinism and compatibility

- Preferences are presentation-only and live in their own app-side file
  (`preferences.json`) and campaign sidecar (`campaign-preferences.json`); the
  domain imports no authoritative package, so no preference can enter a compiled
  design, a save, or an authoritative hash.
- No save format, wire format, or compatibility version changed. The golden
  reference hashes are unchanged from the recorded baseline:

  | Reference hash             | Value                                                              |
  | -------------------------- | ------------------------------------------------------------------ |
  | `initialSnapshotHash`      | `39f30c0e1b7089d0284f0fe4199e5a82a12ba9a1d917ddaf44eae58966c9c7ec` |
  | `closingSnapshotHash`      | `eeff24fb00cc6bede0078aef6a70b1d97580682a49a79036e67e9e2e03c20eee` |
  | `commandLedgerHash`        | `08b3225bcc14ab01371c0fbb72a7f328a467423585ebfa1dc3d072aac17200fa` |
  | `randomDecisionLedgerHash` | `cb9e67f9a76ac4c5cc79f85eade020775beaef9053d1f4c0d6ff19eb3100f678` |

## Remaining

- The **standing** presentation-invariance suite across every currency mode, unit
  preset, number scale and locale is **U-5** (U-2 spec, Out of Scope); U-2 proves
  the structural separation and the unchanged reference hashes.
- The formatters/parsers and the measured-locale allowlist beyond `en-US` are U-3;
  the controls are U-4.
