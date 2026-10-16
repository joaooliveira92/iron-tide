# Validation report: U-3 Formatting boundary

Status: **partially accepted** as of the last commit on `feat/u-4-options-screen`
(which contains U-3 merged). The presentation boundary, its tests, the gate, and
the national-currency schema are complete and green; the domain-formatting-leak
sweep (ticket 06) is not.

## What landed

| Ticket                                     | State       | Evidence                                                                                                                                                                                                                                                                                             |
| ------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 presentation format core + measurements | done        | `apps/desktop/src/renderer/lib/presentation-format/{units,format}.ts` + tests                                                                                                                                                                                                                        |
| 02 money modes (NC/BP/national-historical) | done        | `money.ts`, `national-currency.ts` shapes + tests                                                                                                                                                                                                                                                    |
| 03 dates, localized numbers, number scale  | done        | `dates.ts` + tests                                                                                                                                                                                                                                                                                   |
| 04 national-currency schema + validation   | done        | `packages/content-schema/src/national-currency.ts` + 4 tests                                                                                                                                                                                                                                         |
| 05 availability + requested→effective      | done        | `currency-availability.ts` + tests                                                                                                                                                                                                                                                                   |
| 06 parse-once + ad-hoc-formatting gate     | **partial** | `parse.ts` + `scripts/assert-presentation-formatting.mjs` (wired into preflight); the **locale-dependent** `toLocaleString`/`Intl` sites in ship-design are removed (deterministic `numberText.ts`); the deterministic residue is ratcheted by `packages/ship-design/test/presentation-leak.test.ts` |
| 07 acceptance                              | **partial** | boundary import test + full-suite green; no formal invariance report beyond this file                                                                                                                                                                                                                |

The single conversion module (`presentation-format/`) imports only
`@bluewave/contracts` (proved by `boundary.test.ts`); the renderer imports no
`effect`. The gate ratchets the remaining renderer sites (189 baselined, 0 new).

## Commands run and observed results

- `node scripts/assert-presentation-formatting.mjs --self-test` → `self-test ok`.
- `node scripts/assert-presentation-formatting.mjs` → `ok (189 baselined, 0 new)`.
- `pnpm --filter @bluewave/desktop exec vp test run src/renderer/lib/presentation-format` → 5 files, 34 tests passed (plus boundary 2).
- `pnpm --filter @bluewave/content-schema exec vp test run test/national-currency.test.ts` → 4 passed.
- `pnpm --filter @bluewave/desktop typecheck` → clean.
- `pnpm preflight` → **exit 0** (43 tasks) on the last commit.
- Full desktop suite → **2135 passed, 1 skipped** (one intermittent axe timing flake observed once, green on rerun).

## Determinism and compatibility

- No authoritative value, save/wire format, or golden hash changed; U-3 is
  presentation-only (`golden/hashes.json` untouched).
- No compatibility-version bump.

## Remaining

- **Ticket 06 structured-explanation migration:** the locale-dependent
  `toLocaleString`/`Intl` calls are gone (deterministic `numberText.ts`, output
  unchanged, 1368 ship-design tests green), and a guard **bans** locale formatting
  in the domain. What remains is the owner-reviewed migration of the deterministic
  string templates (`toFixed` + surrounding text) to structured explanation data
  the renderer formats; the exact inventory is frozen by
  `packages/ship-design/test/presentation-leak.test.ts` so it cannot grow.
- **Ticket 07:** the renderer migration sweep is baselined, not exhausted.
