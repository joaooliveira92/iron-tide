# Validation report: U-5 Presentation invariance

Status: **accepted** as of `feat/u-5-presentation-invariance` (off `dev` @ `6c0d1d9`).
The standing presentation-invariance suite, the live currency-availability wiring,
the dev warning, the boundary-persistence proof, the storage rule, and the register
assertions are complete and green. Every clause below maps to a named test/gate.

## What landed

| Ticket                                           | State | Evidence                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 cross-mode/cross-preset invariance suite      | done  | `apps/desktop/src/main/preferences/presentationInvariance.test.ts` — drives the real production composition (`ContentArtifact.compileProductionCampaign` + `ProjectStore.save` + the real `createPreferencesBridge`) across the matrix, with a negative control and an in-suite cross-process reference check |
| 02 resolve availability from the active campaign | done  | `renderer/lib/preferences-context.tsx`, `renderer/lib/presentation-format/currency-availability.ts`, `renderer/shell/CampaignShellContext.tsx`, `screens/options/OptionsScreen.tsx`; tests in `preferences-context.test.tsx`, `CampaignShellContext.test.tsx`                                                 |
| 03 dev warning for untranslated strings          | done  | `renderer/lib/strings.ts` + `strings.test.ts`                                                                                                                                                                                                                                                                 |
| 04 boundary persistence proof                    | done  | `apps/desktop/src/main/preferences/preferencesBridge.test.ts` (fresh-composition re-read, campaign-scope round-trip, malformed rejection)                                                                                                                                                                     |
| 05 storage rule in the presentation gate         | done  | `scripts/assert-presentation-formatting.mjs`, `scripts/presentation-formatting.baseline.json`, `scripts/test/assert-presentation-formatting.test.mjs`                                                                                                                                                         |
| 06 register + golden-baseline assertions         | done  | `scripts/test/authority-register.test.mjs` (register classification + golden integrity)                                                                                                                                                                                                                       |
| 07 acceptance                                    | done  | this report                                                                                                                                                                                                                                                                                                   |

## Commands run and observed results

| Command                                                                                              | Observed result                                                        |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm --filter @bluewave/desktop test`                                                               | **327 files passed, 1 skipped; 2218 tests passed, 1 skipped** (exit 0) |
| `pnpm --filter @bluewave/desktop exec vp test run <focused preferences/strings/options/shell paths>` | **12 files, 81 tests passed**                                          |
| `pnpm test:scripts`                                                                                  | **209 tests, 209 pass, 0 fail**                                        |
| `pnpm preflight`                                                                                     | **exit 0** (42 tasks)                                                  |
| `pnpm lint`                                                                                          | **0 warnings, 0 errors**                                               |
| `pnpm typecheck`                                                                                     | **exit 0**                                                             |
| `pnpm format`                                                                                        | **exit 0** (no drift)                                                  |
| `node scripts/verify-golden-hashes.cjs`                                                              | **All 11 hashes match golden reference**                               |
| `pnpm check:determinism`                                                                             | **exit 0** (cross-process child twice, byte-identical)                 |
| `pnpm check:equivalence`                                                                             | **exit 0**                                                             |
| `pnpm check:balance-reports`                                                                         | **exit 0**                                                             |
| `pnpm check:golden-repin`                                                                            | **exit 0**                                                             |
| `pnpm content:verify`                                                                                | **exit 0** (content hash `e61a187b…`)                                  |
| `pnpm check:licenses`                                                                                | **exit 0**                                                             |
| `pnpm exec vp run --no-cache -r build`                                                               | **exit 0** (clean uncached build)                                      |

The gate's literal `vp run -r build --no-cache` hits the **pre-existing** TS5072 bug
(forwarded to `tsc -b`); the corrected invocation `vp run --no-cache -r build` (as
recorded in `.ai/reports/u-4-options-screen.md:67-69`) was used.

**Not run (recorded):** `pnpm test:heavy` and `pnpm test:e2e` (Playwright), and the
non-desktop package suites (untouched by U-5). A full `pnpm check` end-to-end was not
invoked.

## Determinism and compatibility

- **No authoritative hash moved.** `golden/hashes.json` is byte-identical (it does not
  appear in the diff); `check:golden` matches all 11 hashes and `check:determinism`
  passes on the exact commit. The invariance suite additionally re-runs the
  cross-process reference in-suite and matches the golden file.
- **No save/wire format change and no compatibility bump.** U-5 edits the renderer,
  main-process tests, and scripts only; `CURRENT_COMPATIBILITY_VERSION` is unchanged.
- **Presentation is proven inert.** The suite compiles and saves the _production_
  campaign under all three currency modes, both measurement presets, every number
  scale, theme, density, language and locale, and asserts the compiled snapshot hash,
  the content hash, the `campaign.json`/`campaign.sig.json` bytes, the payload hash,
  the nation treasuries, and the compatibility version are all identical — with a
  negative control proving the comparison would detect a changed payload.

## Recorded deviations and limitations

- **H1 (reviewer) — cross-process reference not driven _under the preference matrix_.**
  The reference child (`packages/cross-process-test/src/run-child.ts`) compiles an
  in-code synthetic fixture with **no presentation layer** and consumes no preference
  input, so a preference cannot enter it by construction; running it "under each
  preference" would be meaningless. Clause 1's cross-process half is therefore proven
  by (a) the in-suite reference-vs-golden check and `pnpm check:golden` on the commit,
  and (b) the production compile+save matrix as the observable preference proof.
- **M4 — packaged smoke not extended.** `scripts/packaged-smoke.mjs` was not extended
  to assert preference persistence: it drives a full packaged UI new-game flow, and a
  preference assertion there would be neither cheap nor stable, nor exercised by the
  focused gates. The real main/preload capability decode _is_ proven by
  `preferencesBridge.test.ts`. Recorded here per ticket 04 bullet 4.
- **M2 — assertion causality.** The suite now asserts each preference write
  round-trips through the store and adds a negative control, so "unchanged" is not a
  vacuous comparison. The compile/save path does not depend on the preferences store
  (verified structurally), which is exactly why it cannot move a hash.

## Known pre-existing conditions (not caused by U-5)

- `pnpm exec vp run -r build --no-cache` → TS5072 (flag forwarded to `tsc -b`).
- `docs/PROGRESS.md` and `docs/OPEN-ISSUES.md` named by the boot prompt do not exist
  (registered as unavailable in `.ai/AUTHORITY-INDEX.md`).
- Open owner decisions 0005/0006/0007/0008 gate N-1 ticket 07, S-2, S-1's value
  tickets, and baseline restoration respectively.

## Landing

Delivered on branch `feat/u-5-presentation-invariance` against `dev`; no self-merge.
Focused Conventional Commits; clean tree.
