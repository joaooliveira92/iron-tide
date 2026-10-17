# N-2 — 1880 content completion: validation report

Date: 2026-10-17. Branch: `feat/n-2-1880-content-completion` (based on
`origin/dev` `ee94026`). Map: issue #26.

## Scope delivered

- **#27 / #28** — 1880 armoured-hull classification research and the
  `ship_type_classifier_v2` opening band (ADR-0228). Seven authored ironclads
  now classify as `B`; the modern pre-dreadnought band stays v1; no currently
  classifying ship retypes.
- **#29** — `des_aut_custoza` and `des_gbr_temeraire` authored with ADR-0213
  ESTIMATE provenance. Every 1880 starting ship now links a compiled design.
- **#30** — French Courbet recorded as deliberate Dévastation-class sister-ship
  reuse (`con_fra_courbet` provenance), not a fabricated design.
- **#31** — the N-2 acceptance harness:
  - static gate extended in
    `packages/content-compiler/test/perNationViability.test.ts` (ten-playable
    roster, unconditional design linkage, no post-1880 reference from a starting
    ship/construction/division);
  - classifiability and post-1880 catalogue unreachability in
    `packages/cross-process-test/test/ten-nation-smoke.test.ts`;
  - `production-ten-nation` mode in
    `packages/cross-process-test/src/run-child.ts`: twelve command-free months
    over fourteen nations, two in-process passes, cross-process byte identity.
- **#40** — the `whitehead_14in_1886` identity research note
  (`docs/research/n-2-whitehead-14in-identity.md`): the id is a canonical
  repository identifier with a retrospective vintage label, not a manufacturer or
  service designation. The frozen id is kept (rename is N-3 torpedo-contract
  scope); the unavailable legacy citations are replaced and the relationship is
  pinned by a regression test.

## Content lock

- Old body hash: `bbead4e4da8d835aa5cc3998af61601ff54930a19a3017142995c4fdac8b2a32`
- New body hash: `868f34b7ceb1074ee03629343d4e9a5bc570d3c56de75959a4d97ce4111956ca`
- Cause: the 14-inch Whitehead model's provenance note and citation set changed
  (identity documentation); no gameplay value changed. Content version stays
  `0.5.0`.

## Known baseline (not an N-2 regression)

The twelve-month smoke run reaches the pre-existing S-1 economy baseline. On
clean `e8cad96` and on the N-2 content tree the same months and messages
reproduce:

- month 11 — `portugal` + `NEGATIVE_TREASURY_OBLIGATION`
- month 12 — `netherlands` + `NEGATIVE_TREASURY_OBLIGATION`, plus Portugal again

The harness allowlists exactly those two `(nationId, reasonCode)` pairs and fails
on any other pair. N-1 first observed Portugal at month 10 because the perf
tripwire uses the built artifact and a different loop boundary; the underlying
treasury squeeze is the same. The perf tripwire is left unmodified.

## Gate results (exact observed)

| Command                                                               | Result                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| `pnpm preflight`                                                      | ok (all standing gates, content lock verified)            |
| `pnpm test:run`                                                       | 327 files passed, 1 skipped; 2218 tests passed, 1 skipped |
| `pnpm test:scripts`                                                   | 209 passed                                                |
| `pnpm check:golden`                                                   | all 11 hashes match                                       |
| `pnpm check:determinism`                                              | two runs byte-identical                                   |
| `pnpm check:equivalence`                                              | report and catalogue byte-identical across two processes  |
| `pnpm check:balance-reports`                                          | ok (reports match the deterministic benchmark)            |
| `pnpm content:verify`                                                 | lock verified at `868f34b7…`                              |
| `pnpm --filter @bluewave/cross-process-test test -- ten-nation-smoke` | 3 passed                                                  |
| `pnpm --filter @bluewave/content-compiler test -- perNationViability` | 4 passed                                                  |

`pnpm check:golden-repin` reported its range (`1f34161…`) unavailable and
skipped; the synthetic golden did not move, and `check:golden` confirms it.

### CI baseline on the PR

The PR's three red jobs are the pre-existing baseline recorded by N-1
(`.ai/reports/n-1-1880-scenario-audit.md`, "Pre-existing validation baseline"),
not N-2 regressions:

- **quality** — the perf tripwire fails at month 10 with the Portugal
  `NEGATIVE_TREASURY_OBLIGATION` (same baseline; the tripwire is unmodified).
- **determinism (windows-latest)** — the three documented Windows path /
  directory-order tests (`schemaCoverage`, `manifestAuthority`,
  `shipBuildingDiscovery`).
- **desktop-e2e** — the debug-only battle-drill spec stalls on the battle dialog
  intercepting the bottom-nav click (the documented debug-spec issue; the
  standard 30/30 suite is unaffected).

Fixing those is S-1/e2e scope and is not part of N-2; the gates were not
weakened to hide them.

## Determinism

- No authoritative content, ruleset, or wire-format change moves the synthetic
  cross-process golden (`golden/hashes.json`).
- The smoke child compiles the production pack once and advances it twice; the
  monthly hashes, closing hash, and diagnostics repeat exactly. Two fresh child
  processes emit byte-identical JSON.
- The classifier version bump is a versioned ruleset change; no save schema or
  compatibility version moves.

## Follow-ups

- N-3 owns renaming frozen torpedo-contract ids, if that is ever approved.
- The S-1 economy baseline (Portugal/Netherlands) is unchanged and remains S-1
  scope.
