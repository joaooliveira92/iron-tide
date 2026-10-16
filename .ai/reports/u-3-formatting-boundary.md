# Validation report: U-3 Formatting boundary

Status: **accepted** as of `feat/u-4-options-screen`. The presentation boundary,
its tests, the ad-hoc-formatting gate, the national-currency schema, the
parse-once input path, and the domain-formatting-leak removal (ticket 06) are
complete and green. No authoritative value, save/wire format, or golden hash
moved.

## What landed

| Ticket                                     | State | Evidence                                                                                                                                                                                                                                           |
| ------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 presentation format core + measurements | done  | `apps/desktop/src/renderer/lib/presentation-format/{units,format}.ts` + tests                                                                                                                                                                      |
| 02 money modes (NC/BP/national-historical) | done  | `money.ts`, `national-currency.ts` shapes + tests                                                                                                                                                                                                  |
| 03 dates, localized numbers, number scale  | done  | `dates.ts` + tests                                                                                                                                                                                                                                 |
| 04 national-currency schema + validation   | done  | `packages/content-schema/src/national-currency.ts` + 4 tests                                                                                                                                                                                       |
| 05 availability + requested→effective      | done  | `currency-availability.ts` + tests                                                                                                                                                                                                                 |
| 06 parse-once + ad-hoc-formatting gate     | done  | `parse.ts`; `scripts/assert-presentation-formatting.mjs` (preflight); structured-explanation migration (ADR-0221): no `toFixed`/`Intl` remains in `packages/ship-design/src` or `packages/phase-engine/src`; `presentation-leak.test.ts` bans both |
| 07 acceptance                              | done  | this report; boundary/round-trip/malformed/invariance evidence below                                                                                                                                                                               |

## Commands run and observed results

- `node scripts/assert-presentation-formatting.mjs --self-test` → `self-test ok`.
- `node scripts/assert-presentation-formatting.mjs` → `ok (189 baselined, 0 new)`.
- `pnpm --filter @bluewave/ship-design exec vp test run` → **88 files, 1369 passed**
  (includes the rewritten `presentation-leak` guard: no locale formatting and no
  `toFixed` in an authoritative package).
- `pnpm --filter @bluewave/phase-engine exec vp test run` → **52 files, 537 passed**.
- `pnpm --filter @bluewave/desktop exec vp test run` → **316 files, 2149 passed, 1
  skipped**; includes `src/shared/explanation-text.test.ts` (the structured
  renderer) and the drawing-board/shipbuilding screens.
- `pnpm --filter @bluewave/content-schema exec vp test run test/national-currency.test.ts`
  → 4 passed.
- `pnpm --filter @bluewave/desktop typecheck` → clean.
- `pnpm preflight` → **exit 0** (43 tasks); `pnpm test:scripts` → **207 passed**;
  `pnpm lint` → 0 errors; `pnpm exec vp fmt --check .` → clean.

### Ticket 06 — structured-explanation migration

`packages/ship-design/src/{hull,machinery,rebuild,refit,report,suggest,workshop}.ts`
and `packages/phase-engine/src/reviseProject.ts` no longer build display numbers.
The domain emits **structured explanation data** (`packages/ship-design/src/explanation.ts`,
ADR-0221): literal text plus display-value tokens (`{ value, scale, fractionDigits,
unit }` with a stable unit code). `Finding.what/why/consequence`,
`Remedy.description`, `WorkshopView.metric.value`, and `SuggestedFix.description`
are `ExplanationText`; the renderer formats them
(`apps/desktop/src/shared/explanation-text.ts`, re-exported from the presentation
home). `formatBalanceTable` was relocated to the test-support folder (a display
artefact with no production consumer). The engine's rebuild-project diagnostic now
carries a stable code and the raw progress in basis points, not a formatted
percentage (the user-facing message is produced in the main process).
`presentation-leak.test.ts` now asserts no `toFixed` (BASELINE emptied) and no
locale formatting.

## Determinism and compatibility

- No authoritative value, save/wire format, or golden hash changed; U-3 is
  presentation-only. Findings are not persisted and the compiled-design hash
  already excludes the presentation `subject` (`withoutSubjects`).
- `node scripts/verify-golden-hashes.cjs` → **All 11 hashes match golden reference**.
- `pnpm test:cross-process` (run twice) → byte-identical, `success: true`:
  - `initialSnapshotHash` `39f30c0e1b7089d0284f0fe4199e5a82a12ba9a1d917ddaf44eae58966c9c7ec`
  - `closingSnapshotHash` `eeff24fb00cc6bede0078aef6a70b1d97580682a49a79036e67e9e2e03c20eee`
  - `commandLedgerHash` `08b3225bcc14ab01371c0fbb72a7f328a467423585ebfa1dc3d072aac17200fa`
  - `eventLedgerHash` `26af2cf3b853a824b98cb33af1d85086748b2848253538f8986e38f014c20ee5`
  - `randomDecisionLedgerHash` `cb9e67f9a76ac4c5cc79f85eade020775beaef9053d1f4c0d6ff19eb3100f678`
  - `battleGenerationHash` `dcdb85c43321b44523b881ccd12623d1689455f060b5d98487850184bbdcb9b6`
- No compatibility-version bump.

## Remaining

- Locale-aware rendering over the explanation tokens (rather than the canonical
  fixed decimal) is the U-4/U-5 migration; the current renderer reproduces the
  exact en-US strings.
- **Per-nation National Historical currency configurations** remain an owner
  decision (D7); U-3 ships the schema and validation, no production configurations.
