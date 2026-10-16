# Validation Report: U-1 Canonical values (acceptance)

## Outcome

`PASS`.

Ticket 08 — the U-1 acceptance pass — is complete. All six `.ai/SPRINT-PLAN.md`
U-1 acceptance criteria are traced to named tests/gates; the five implementation
ADRs are recorded and indexed; and the full orchestrator validation gate is green
on the exact commit. Tickets 01–07 (the implementation) were delivered earlier;
this report supersedes the scoping-sprint report and carries the acceptance
evidence.

## Scope delivered

Implemented across tickets 01–07 (commits `c93fa69`…`5e0bcb6` on the U-1 lane):

- one canonical units module in `packages/contracts` (`packages/contracts/src/units.ts`);
- consolidation of the ship-design/campaign unit brands onto it (one definition),
  value-preserving;
- one branded fixed-precision `Money` type in treasury units, every authoritative
  money/ratio field branded, and the single declared-rounding micro→unit bridge;
- checked rounding helpers and the authoritative-float gate;
- the domain-package formatting-leak removal and the canonical↔display / language
  vs locale boundary;
- the combat strength/resolver and construction-capacity float→fixed conversions.

Delivered in this acceptance pass (ticket 08):

- ADR-0215–ADR-0219, recorded and indexed (`pnpm adr:index`);
- this acceptance report;
- the ticket-08 resolution and the `.ai/SPRINT-PLAN.md` Frontier update.

Explicitly deferred (out of U-1 scope, per spec): the preferences domain/schema
(U-2); the central formatters/parsers, currency rendering and Options screen
(U-3/U-4); the presentation-invariance tests (U-5); the ship-design/phase-engine
display-formatting sweep and the component-scoped `Intl`/`toLocaleString`/`toFixed`
gate (U-3); and the final home of the presentation conversion module (U-2/U-3).
Per-nation National Historical currency content is U-3.

## Requirements evidence

| #   | U-1 acceptance criterion                        | Requirement IDs                                            | Proving test / gate (observed)                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Canonical unit table                            | BW-PRS-001, BW-DET-001; ADR-0202, ADR-0215                 | `packages/contracts/test/units.test.ts` ("declares the canonical unit table"; constructors reject non-integer/unsafe/negative); `packages/ship-design/test/units-consolidation.test.ts` (one definition re-exported); `assert-runtime-free` (15 roots)            |
| 2   | Fixed-precision integer monetary representation | BW-PRS-001, BW-DET-001, BW-STA-001; ADR-0216               | `packages/ship-design/test/treasury-units.test.ts` (ceil, never zero, exact beyond double precision, single declared mode, typed reject); `packages/ship-design/test/persistence.test.ts` (`FLOAT_IN_STATE`); `packages/phase-engine/test/economy.test.ts` ledger |
| 3   | Rounding and number-formatting boundaries       | BW-DET-001/003, BW-RUL-001; ADR-0217                       | `packages/contracts/test/units.test.ts` (`mulBp`/`ceilDiv`/`toSafe`); `node scripts/assert-authoritative-determinism.mjs --self-test` (21 fixtures, float fixture fails); the gate on the clean tree; `packages/phase-engine/test/economy.test.ts`                |
| 4   | UI language and formatting locale separate      | BW-PRS-004; ADR-0209, ADR-0218                             | `packages/campaign-engine/test/priorities.test.ts` ("builds no locale-formatted strings (map D6)"); the boundary split is fixed in ADR-0218                                                                                                                       |
| 5   | Audit of float or display-leaking values        | BW-DET-001, BW-ARC-001/002, BW-STA-001; ADR-0217, ADR-0219 | `assert-authoritative-determinism` `FLOAT_ROOTS` float gate; `packages/combat/test/combat.test.ts` (`damagePotential`/`survivability`/`strength` fixed-point); `packages/phase-engine/test/battle-resolution-phase.test.ts`; `new-construction-capacity.test.ts`  |
| 6   | Conversion only at the application boundary     | BW-PRS-001, BW-ARC-001; ADR-0218                           | `packages/ship-design/test/persistence.test.ts` (save stores only integers, no formatted text); `packages/campaign-engine/test/priorities.test.ts` (no domain formatting); ADR-0218 boundary                                                                      |

All six criteria are proved by a named deterministic test or a standing gate; no
criterion rests on "code exists" alone.

## Commands and observed results

```text
pnpm preflight
exit 0 — "vp run: 0/40 cache hit (0%)": git state, single-copy effect, dependency
policy, docs links/anchors/ADR index/status/supersession/deferrals/DESIGN
amendments/doc budgets, no-new-unknown-casts, boundary decode (cli/desktop/
compiler), tagged errors (engine/surface), runtime-free (15 roots),
authoritative-determinism (15 roots, no ambient determinism), single-effect,
vitest-config parity (22 projects), stage-io, content-gate, content-lock,
tracker-consistency all green.

pnpm test:scripts
exit 0 — tests 200, pass 200, fail 0, cancelled 0, skipped 0.

node scripts/assert-authoritative-determinism.mjs --self-test
exit 0 — "self-test ok (21 fixtures)" (the fractional-float-literal and
parseFloat fixtures fail as required; the integer/BigInt/string fixtures pass).

node scripts/assert-authoritative-determinism.mjs
exit 0 — "ok (15 roots, no ambient determinism)".

pnpm check    (full end-to-end gate, run on the exact commit)
exit 0 — pnpm preflight; pnpm format (all matched files correct); pnpm lint;
pnpm lint:effect; pnpm test:scripts; pnpm check:licenses; pnpm typecheck
(vp run -r build + typecheck); pnpm build; pnpm content:verify; pnpm test:run
(full recursive suite); pnpm test:heavy; pnpm check:golden ("All 11 hashes match
golden reference"); pnpm check:determinism ("cross-process determinism: two runs
byte-identical"); pnpm check:equivalence ("two fresh processes byte-identical");
pnpm check:golden-repin (skipped — the baseline range is unavailable in this
clone); pnpm check:balance-reports ("ok (reports match the deterministic
benchmark)"); pnpm test:e2e ("30 passed").
```

## Determinism evidence

- Content artifact hash: unchanged — no content file changed in U-1
  (`content-lock` verified, version 0.5.0).
- Cross-process reference run: two child runs **byte-identical** (`check:determinism`).
- Golden hashes: **11/11 match** the committed reference (`check:golden`).
- Equivalence/codemod determinism: two fresh processes byte-identical.
- Combat reviewed delta (ticket 07): a 4000-matchup sweep + the 7 named fixture
  battles are exactly value-preserving — 0 winner flips, 0 loss flips, 0
  damage-value diffs (max |Δ| = 0).
- Construction-capacity split (ticket 06): the reference run does not move; the
  largest-remainder split differs from the old floor-per-project only when two or
  more projects are funded.
- Replay result: covered by `packages/phase-engine/test/*replay*` and the
  `continuance` desktop E2E (Replay completes deterministically).
- Processes and operating systems used: darwin (macOS), Node per the repo policy.

## Canonical artifact changes

None. No old/new hash pair; no version impact; no migration; no regeneration. The
float→fixed conversions are exactly value-preserving for the reference run, so
`check:golden` and `check:determinism` are green without a re-pin
(`Golden-Repin: not-needed`).

## Tests added

Added across tickets 01–07 (not in this acceptance pass): the canonical-units
module tests (`packages/contracts/test/units.test.ts`), units-consolidation,
treasury-bridge, rounding/float-gate fixtures, the capacity largest-remainder
test (`packages/phase-engine/test/construction-capacity.test.ts`), the
priorities no-locale-formatting guard, and the combat fixed-point tests
(`packages/combat/test/combat.test.ts`, `battle-resolution-phase.test.ts`). The
acceptance pass adds no tests; it proves the existing ones plus the gate.

## Security and cancellation

No change. No trust boundary, parser, path, temp-output, abort, or cleanup code
was touched. The save boundary still rejects floats (`FLOAT_IN_STATE`).

## Performance observations

None authoritative. The float→fixed conversions are integer/bigint arithmetic;
the float gate runs inside the standing `preflight`/`check` gates with no
material cost. The 4000-matchup review sweep is a test-harness measurement, not
a budget.

## ADRs and dependencies

- New ADRs (all indexed via `pnpm adr:index`):
  - **ADR-0215** — canonical units module and its home in `packages/contracts`.
  - **ADR-0216** — fixed-precision money type, treasury-unit scale, and the
    micro→unit bridge.
  - **ADR-0217** — rounding/fixed-point rules and the authoritative-float gate.
  - **ADR-0218** — conversion and locale boundary.
  - **ADR-0219** — combat and construction-capacity float→fixed conversion and
    its re-pin.
- No new dependencies.

## Known limitations and deferred requirements

- U-1 changes representation, not balance. The two converted float paths are
  exactly value-preserving for the reference run.
- Deferred to later sprints (unchanged from the spec's Out of Scope): the
  preferences domain (U-2); formatters/parsers, currency rendering and the
  Options screen (U-3/U-4); presentation-invariance tests (U-5); the remaining
  display-formatting sweep and the component-scoped `Intl` gate (U-3); the
  presentation conversion module's final home (U-2/U-3); and National Historical
  currency content (U-3).
- `check:golden-repin` skips because the branch-point revision is unavailable in
  this clone — a pre-existing environmental condition, not a gate weakening.

## Changed files

- `docs/adr/ADR-0215-canonical-units-module.md` — new.
- `docs/adr/ADR-0216-money-type-and-treasury-bridge.md` — new.
- `docs/adr/ADR-0217-rounding-and-authoritative-float-gate.md` — new.
- `docs/adr/ADR-0218-conversion-and-locale-boundary.md` — new.
- `docs/adr/ADR-0219-combat-and-capacity-fixed-point-repin.md` — new.
- `docs/adr/README.md` — regenerated index (next number ADR-0220).
- `scripts/adr-index.cjs` — AREAS map partitioned to include ADR-0215–0219.
- `.ai/reports/u-1-canonical-values.md` — this acceptance report.
- `.scratch/u-1-canonical-values/issues/08-u-1-acceptance.md` — resolution.
- `.ai/SPRINT-PLAN.md` — Frontier advanced past U-1.

## Git and remote status

- Branch: `chore/u-1-acceptance` (never `dev`/`main`, per ADR-0165).
- Commits: one Conventional Commit for the acceptance pass (recorded below).
- Working tree: clean after the commit.
- Push status: pushed to `origin` (remote configured in this checkout).
- Pull request: opened against `dev`.
- Merge performed: no.

## Secondary consistency check

- `pnpm preflight` re-run green, including `verify-tracker-consistency` (the
  ticket-08 `Blocked by:` references resolve; the spec advertises
  `ready-for-agent` only where non-terminal tickets remain).
- `pnpm adr:index` output diff inspected: exactly ADR-0215–0219 added, next
  number advanced 0215→0220, and no other row changed.
- Re-read the five ADR files: each has an H1, an `## Status` lead keyword of
  `accepted`, and no stray `defer`/`pending` in Status.
- Confirmed only documentation/scripts changed in this pass; no code, content,
  test, or golden file was modified.
- Confirmed `.DS_Store` and other machine files are not staged.
