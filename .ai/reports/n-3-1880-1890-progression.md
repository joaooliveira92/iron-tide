# N-3 — 1880–1890 progression: acceptance report

Date: 2026-10-17. Branch: `feat/n-3-progression` (base `dev` `0d77550`). Map:
issue #42. Spec: issue #47. Tickets: #48–#53.

## Scope delivered

- **#48 — progression ledger.** `packages/cross-process-test/src/progression-ledger.ts`
  derives a canonical per-year ledger (year, then kind, then id) from the compiled
  production bundle: technology `year` events, part `lifecycle.availableFrom`
  events and component `introduction.fromMonth` events, each with its
  machine-readable provenance status/confidence. `progression-ledger.test.ts`
  proves canonical order, every year 1880–1889 covered, quiet technology years
  passing only through part/component introductions, a pruned fixture naming the
  idle year, and byte identity across two fresh processes.
- **#49 — technology `year` semantics.** ADR-0229 records decision D4: `year` is
  the global designer/construction unlock year as implemented (`year <= calendar
  year`), explicitly not an RTW3 research or per-nation discovery claim; per-nation
  research wiring is deferred. ADR-0212's `completedTechs` sentence is corrected in
  place and an amendment section records the correction. `GLOSSARY.md` (through
  `CONTEXT.md`) gains the term; the ADR index is regenerated.
- **#50 — ten-year run.** `production-ten-year` mode in
  `packages/cross-process-test/src/run-child.ts`: 120 command-free months over the
  fourteen committed nations from the compiled 1880 pack, a checkpoint as each
  calendar year opens (1880–1889) and a closing hash at 1890-01. Two in-process
  passes and two fresh processes are byte-identical. Owner decision 0014-A accepts
  `NEGATIVE_TREASURY_OBLIGATION` for any nation as the command-free baseline; the
  solvency fix is follow-up ticket #95, not N-3.
- **#51 — qualifying-decision probes.** `decision-probes.ts` probes the
  player-facing command lifecycle (validate → authorize → resolve) without
  committing state, at each January snapshot of the ten-year run. Each of 1880–1889
  accepts one command in the research-priority, construction-order and
  ship-design/refit families. A restricted fixture fails naming the year and
  family; snapshot hashes are unchanged by probing.
- **#52 — named unlocks.** `designer-unlocks.ts` reads each unlock's date from
  content and checks the designer gate at the month before and at the declared
  month. A forged ledger month fails with the id and both months.
- **#53 — this report**, the sprint-plan update, the decision-request responses and
  the full gate.

## Requirements evidence

| Req                             | Evidence                                                                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1 Progression ledger           | `packages/cross-process-test/src/progression-ledger.ts`; `test/progression-ledger.test.ts` (canonical order, provenance, cross-process byte identity). Ledger hash `601645e6af29ec1a1dc833bfda989ed3fb1cbd9ecf1c33ad20258020a9affe2f`.     |
| R2 No idle year                 | `idleYears`/`assertNoIdleYears`; every year 1880–1889 has ≥1 event; pruned fixture returns `[1885]`.                                                                                                                                       |
| R3 Named unlocks                | `packages/cross-process-test/src/designer-unlocks.ts`; `test/named-unlocks.test.ts`. Dates are read from content, never hard-coded; a mismatch names the id and both months.                                                               |
| R4 Qualifying decisions         | `packages/cross-process-test/src/decision-probes.ts`; `test/decision-probes.test.ts` (10 years × 3 families accepted, restricted fixture names year/family, snapshot hash unchanged, two processes identical).                             |
| R5 Ten-year run and determinism | `production-ten-year` in `run-child.ts`; `test/ten-year-run.test.ts` (120 months, 10 checkpoints, closing hash, two fresh processes identical, only `NEGATIVE_TREASURY_OBLIGATION` tolerated).                                             |
| R6 Semantics of `year`          | ADR-0229; ADR-0212 amendment; `GLOSSARY.md` term; `pnpm adr:index`.                                                                                                                                                                        |
| R7 Non-regression               | Content lock unchanged at `868f34b7ceb1074ee03629343d4e9a5bc570d3c56de75959a4d97ce4111956ca`; `golden/hashes.json` unchanged; no schema/compatibility/content edit; torpedo id `whitehead_14in_1886` unchanged and its existing pin green. |
| R8 Evidence and tracking        | This report; `.ai/SPRINT-PLAN.md` N-3 row; decision requests 0013 and 0014 responses; tickets #48–#53.                                                                                                                                     |

## Progression ledger (1880–1889)

330 events. Counts by year and kind:

| Year | Total | Technology | Part | Component |
| ---- | ----- | ---------- | ---- | --------- |
| 1880 | 264   | 10         | 222  | 32        |
| 1881 | 7     | 1          | 5    | 1         |
| 1882 | 1     | 1          | 0    | 0         |
| 1883 | 10    | 0          | 9    | 1         |
| 1884 | 3     | 0          | 2    | 1         |
| 1885 | 30    | 5          | 22   | 3         |
| 1886 | 9     | 5          | 3    | 1         |
| 1887 | 12    | 0          | 11   | 1         |
| 1888 | 1     | 1          | 0    | 0         |
| 1889 | 3     | 2          | 1    | 0         |

Quiet technology years 1883, 1884 and 1887 pass only through part/component
introductions, as decision B4 requires. The ledger surfaces machine-readable
provenance where content carries it: 72 `ESTIMATE`, 181 `DERIVED`, 19
`PLACEHOLDER`, 3 `BALANCE_TARGET`, and 55 events whose records carry no
machine-readable provenance (mostly legacy components/technologies documented in
YAML comments). A generated part and its legacy component sharing one id and
month are one fact: the ledger keeps the authoritative part and drops the
duplicate component, so 10 fitting entries are counted once. The schema has no `UNVERIFIED` source status; `ESTIMATE` is the
machine-readable flag for the estimated dates. No date is certified as RTW3
behaviour.

## Named unlocks

| Unlock            | Id                                  | Declared month |
| ----------------- | ----------------------------------- | -------------- |
| Dry dock          | `infra_dry_dock` (technology)       | 1880-01        |
| Whitehead torpedo | `whitehead_14in_1886` (part)        | 1880-01        |
| Torpedo boat      | `torp_torpedo_boat` (technology)    | 1882-01        |
| Protected cruiser | `sd_protected_cruiser` (technology) | 1885-01        |
| All-steel hull    | `hc_all_steel_hull` (technology)    | 1886-01        |
| QF light guns     | `gun_qf_light` (technology)         | 1886-01        |

Each is unavailable at the month before and available at the declared month; the
torpedo part's identity pin is unchanged.

## Ten-year run evidence

- Checkpoints (state as each year opens):

| Year | Snapshot hash                                                      |
| ---- | ------------------------------------------------------------------ |
| 1880 | `11b6f824348b686c98ccb77d0ce34b5112c938c8f7a4da88179f544e756112c6` |
| 1881 | `ff93ba1bb2710440eeb46d6d5e91f36c896eab9ac125f2e7f4473ed43ad4f611` |
| 1882 | `ccf400699defbc6b2aae34e2ada95e21940a8555b9d32dfe42485a82ba291baa` |
| 1883 | `7c6b01a49467de258373f7c587db3f275eed6dce5165f50e8f8998bd2d8b5d20` |
| 1884 | `d212e0efccce4311a072c2f3304e391ed82ba67d8d91851bb6786e24b4afc845` |
| 1885 | `2b56fa847b20d787d20ff165b2b51432e559b31099f2980e96c1bef329a8f3f1` |
| 1886 | `1ffa41a69de9c0448188037208de8845768f606c6eb240cf407235266fa14163` |
| 1887 | `ab1396cf5af90f8f426788e2bc7cb59e503e5134fc9d1ea5f2a8f13fef17815d` |
| 1888 | `c523fde0a5e6d96af08c2c9903e44e434c110fa683034c84585652402e88589f` |
| 1889 | `74fbc40b1479d9c7a9a1a2ffb8525d4d0759b52f67c176719b9ea0708bdb4be0` |

- Closing hash at 1890-01:
  `f54d498186c568a170fdd0ed868558c1ffb0dfdadbd8922414c60acde19c3d17`.
- Two fresh processes emit byte-identical JSON (checkpoints, 120 monthly hashes,
  diagnostics, hull counts); `inProcessRepeatMatches` is true.
- All fourteen nations still field hulls at 1890-01.

### Command-free treasury baseline (owner decision 0014-A)

The run records `NEGATIVE_TREASURY_OBLIGATION` for all fourteen nations
(Portugal first at month 11, the Netherlands at 12, Qing at 13, and the rest
between months 17 and 24; the latest is the USA at 24). It reproduces
identically. Owner decision 0014-A accepts this as the
command-free decade baseline and requires every other diagnostic code to fail;
the economy/AI solvency fix is ticket #95. N-3 itself changes no economy rule.

## Decision probes

At each January of 1880–1889, the player-facing lifecycle accepts:

- **research priority** — `SetResearchPriority` (one HIGH field, the rest LOW);
- **construction order** — `OrderConstruction` for a design buildable that year
  (`des_aut_custoza` on the committed pack);
- **design/refit choice** — `SubmitDesign` using a reference design available that
  year (`kaiser_max_1876` on the committed pack).

The probes do not commit, and the snapshot hash is unchanged. A restricted slot
fails `assertDecisionProbes` naming the year and family.

## Non-regression

- **Content lock:** unchanged,
  `868f34b7ceb1074ee03629343d4e9a5bc570d3c56de75959a4d97ce4111956ca`
  (`pnpm content:verify`).
- **Golden:** `golden/hashes.json` unchanged (all 11 hashes match).
- **Torpedo id:** `whitehead_14in_1886` unchanged; existing torpedo-identity pin
  green.
- **Schema/compatibility:** no change; no save migration.
- **Content:** no technology, part, component, date or research seed authored,
  renamed or redated.

## Gate results (exact observed)

Run on the N-3 branch; the final gate is repeated on the exact ticket commit
before delivery, with `test:e2e` excluded by owner instruction.

| Command                                           | Result                                                                                                                                                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm preflight`                                  | ok (all standing gates; content lock verified)                                                                                                                                                                       |
| `pnpm test:scripts`                               | 209 passed                                                                                                                                                                                                           |
| `pnpm check` (without `test:e2e`)                 | green: format, lint, lint:effect, test:scripts, licences, typecheck, build, content:verify, test:run (327 files/2218 tests passed, 1 skipped), heavy (12), golden (11/11), determinism, equivalence, balance reports |
| `pnpm --filter @bluewave/cross-process-test test` | 49 passed                                                                                                                                                                                                            |
| `pnpm check:golden`                               | all 11 hashes match                                                                                                                                                                                                  |
| `pnpm check:determinism`                          | two runs byte-identical                                                                                                                                                                                              |
| `pnpm content:verify`                             | lock verified at `868f34b7…`                                                                                                                                                                                         |

`pnpm check:golden-repin` reported its range (`1f34161…`) unavailable and
skipped, as in N-2; the synthetic golden did not move and `check:golden` confirms
it. Per owner instruction, `pnpm test:e2e` was **not** run on the final commit.
The prior standalone run on the same desktop build (N-3 touches no desktop code)
passed 30/30; a focus-sensitive ship-types spec flaked only while a stale
Playwright test-server from an earlier session was running. No e2e code or
fixture was changed.

## Follow-ups

- #95 — economy/AI solvency of a command-free decade (owner-requested, separate
  from N-3).
- Per-nation research wiring (decision D2/D3) remains a future milestone and
  would require its own compatibility/fidelity decision (ADR-0229).
