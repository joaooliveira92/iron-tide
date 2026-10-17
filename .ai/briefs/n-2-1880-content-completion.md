# Milestone N-2: 1880 content completion

## Objective

Close the residual 1880 starting-scenario content gaps so every one of the
fourteen committed nations opens with **legal, classifiable starting ships**;
make the post-1880 horizon unreachable at the 1880 start; document every
abstraction and balance value; and prove the result with a static viability gate
and a deterministic twelve-month smoke run over all fourteen nations.

## Canonical requirements

- `.ai/SPRINT-PLAN.md` row **N-2** (acceptance): gaps closed from research
  notes; abstractions documented; no later technology copied in; ten nations each
  pass a campaign viability test and a deterministic smoke run.
- **ADR-0201** sole 1880 start; **ADR-0210** authority order (new cited research
  replaces unavailable legacy references); **ADR-0212** initial-fleet legality =
  the global 1880 technology set; **ADR-0213** opening posture is authored canon
  and magnitudes are balance choices with provenance; **ADR-0214** ten playable
  nations; **ADR-0224** divisions/officers; **ADR-0228** the classifier opening
  band; **ADR-0145** deliberate content-lock refresh.
- Map issue #26 (wayfinder) and its closed decisions: #27 (1880 hull
  classification), #28 (classifier v2), #29 (Custoza and Temeraire designs), #30
  (Courbet sister-ship reuse), #31 (acceptance harness), #40 (the 14-inch
  Whitehead model identity).
- Research: `docs/research/n-2-1880-ship-classification.md`,
  `docs/research/n-2-whitehead-14in-identity.md`; intake
  `.ai/reports/n-1-1880-scenario-audit.md`.

## Starting state

Verify, do not assume:

- N-1 is complete: officer rosters and seeded divisions landed under ADR-0224.
- The N-1 audit's residual gaps are the N-2 intake: `bra_brasil` below the
  classifier minimums; `aut_custoza` (and the sibling unclassifiable hulls)
  without a compiled design; the French Courbet shared design.
- The combat ship-type guard (`packages/combat/src/tactical/shipType.ts`) still
  hardcodes the DESIGN-22 v1 `B` floors; the scenario authors classification
  ruleset v2.
- The `whitehead_14in_1886` torpedo model carries `availableFrom: 1880-01` while
  its id embeds 1886, and its provenance cited two files that do not exist in the
  repository or its reachable history.

## In scope

- Research-grounded 1880 armoured-hull families and the opening-era classifier
  band, recorded as ADR-0228 and implemented in the combat classifier without
  retyping any currently-classifying ship.
- Compiled designs for the last design-less starting ships (`aut_custoza`,
  `gbr_temeraire`) with ADR-0213 ESTIMATE provenance; record Courbet as
  deliberate Dévastation-class reuse.
- The `whitehead_14in_1886` identity resolution: keep the frozen contract id,
  record that its trailing year is a retrospective vintage label, replace the
  unavailable legacy citations, and pin the relationship with a regression test.
- The N-2 acceptance harness: static ten-playable/legal/classifiable/1880-only
  gate plus the deterministic twelve-month fourteen-nation smoke run.
- Content-lock refresh and traceability for every production-content change.

## Out of scope

- N-3 (1880–1890 progression: docks, torpedoes, protected cruisers, steel, QF
  guns).
- Authoring new post-1880 designs; `des_pw_*` / `des_iw_*` stay era-gated.
- Submarines, mines, air, carriers, and campaign-level coastal defence.
- S-2 (prestige) and S-3 (unrest), owner-blocked.
- Renaming frozen torpedo-contract ids (`torpedo_models_v1` / `torpedo_v1`),
  which is N-3 scope.
- Fixing the pre-existing S-1 economy baseline (Portugal/Netherlands negative
  treasury); the smoke run allowlists exactly those known pairs.

## Required implementation

- `SHIP_TYPE_CLASSIFIER_VERSION` v2 with the four opening-era armoured families
  floored at 1,500 t / 4 in armour / 6 in calibre / ≤18 kn; the modern
  pre-dreadnought band stays v1.
- `des_aut_custoza` and `des_gbr_temeraire` authored and linked; the
  design-less exemption list is empty and the production-promotion test asserts
  full linkage.
- `con_fra_courbet` provenance records deliberate sister-ship reuse.
- The torpedo id documented at its definition site and in
  `docs/research/n-2-whitehead-14in-identity.md`; unavailable legacy citations
  removed from the model.
- `packages/content-compiler/test/perNationViability.test.ts` extended with the
  ten-playable roster, unconditional design linkage, and post-1880 reference
  rejection for starting ships, constructions, and divisions.
- `packages/cross-process-test/test/ten-nation-smoke.test.ts` plus the
  `production-ten-nation` mode in `run-child.ts`: twelve command-free months over
  fourteen nations, two fresh processes byte-identical, an in-process repeat, and
  a `(nationId, reasonCode)` allowlist for the known S-1 baseline only.

## Acceptance tests

- Static gate: fourteen nations; exactly the ADR-0214 ten playable; every nation
  has ships, an own design, and a research programme; every starting ship links
  and classifies; no starting ship, construction, or division references a
  post-1880 design; every post-1880 design is unavailable at campaign year 1880
  via `isDesignBuildableByYear`.
- Smoke run: twelve months succeed except the documented baseline pairs; every
  nation still fields at least one hull; the closing snapshot and monthly hashes
  are byte-identical across two fresh processes and across an in-process repeat.
- Torpedo pin: `whitehead_14in_1886` is indexed as a torpedo part, available
  from 1880-01, revised from 1884-01, and every mounted model id resolves to an
  indexed torpedo part.

## Determinism proof

The production pack compiles and advances deterministically: the cross-process
child run is byte-identical across two processes, the smoke run's closing hash
and monthly hashes repeat in-process, and no content or classifier change moves
the synthetic cross-process golden (`golden/hashes.json` is compiled from the
synthetic fixture, not the production pack). Production-content changes refresh
`content/production/1880/content-lock.json` deliberately with old/new hashes and
cause recorded.

## Compatibility and versions

- The classifier version bump is a versioned ruleset change, not a wire-format
  change; no save schema or compatibility version moves.
- Production content changes keep content version `0.5.0` and re-pin the body
  hash with the cause recorded in the commit.
- The frozen torpedo id surface is unchanged.

## Stop conditions

- A proposed content value cannot be grounded and cannot be responsibly
  classified as an ADR-0213 `balance_adjustment` — return it for owner decision
  rather than guessing.
- A change would rename or repin a frozen torpedo-contract id (N-3 scope).
- Fixing the S-1 economy baseline would require changing gameplay outcomes;
  the harness documents and allowlists it instead.
- The smoke run surfaces a new `(nationId, reasonCode)` pair; stop and diagnose
  rather than widening the allowlist.

## Required delivery

- Code and focused tests for each ticket.
- Traceability: map #26 decision lines, closed child tickets, `.ai/reports/*`,
  and the SPRINT-PLAN row.
- ADR-0228 indexed; research notes under `docs/research/`.
- `.ai/reports/n-2-1880-content-completion.md` with exact commands and observed
  results.
- Conventional Commits and a checks-green pull request.
