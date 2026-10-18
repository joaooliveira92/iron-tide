# Decision Request: N-3 (1880–1890 progression) — acceptance meaning, technology gap-filling, torpedo id, and the meaning of technology `year`

## Status

Resolved 2026-10-17 by owner delegation (see Owner response). Created 2026-10-17. Gates **N-3 only** (and, through it, the
roadmap items that follow N-3 in `.ai/SPRINT-PLAN.md`). N-3 is not eligible for `wayfinder`
until the response fields below are filled (see "Eligibility conditions").

Four decisions are asked, labelled **A–D**. They are one request because B and D are
coupled to A: what counts as a "gap" depends on what "unlock" means (D), and what "idle"
means (A).

Conventions used below: **[FACT]** is verified in this tree (with a reference),
**[SOURCE]** is what the RTW3 manual says, **[INTERP]** is an agent interpretation, not an
authority, **[REC]** is a recommendation. Owner choices are made only in "Owner response".

## Trigger

`.ai/SPRINT-PLAN.md` (Phase 1 table, row N-3) defines the acceptance as: "A scripted
10-year run shows decisions and unlocks each year (docks, torpedoes, protected cruisers,
steel, QF guns); no idle stretch." It also lists N-3 as the immediate next action, and
`.ai/ROADMAP.md` Order item 3 ("Validate and complete the 1880 scenario") places it first.
The N-2 report and research note assign N-3 "any approved torpedo-contract id change"
(`.ai/reports/n-2-1880-content-completion.md` lines 29 and 103;
`docs/research/n-2-whitehead-14in-identity.md` §5).

A read-only planning run found this cannot be specified without choosing gameplay,
content-authoring and compatibility policy that no accepted authority chooses. This
request records exactly which choices, with the evidence the owner needs to make them.

## Evidence

### E1. The acceptance wording and its authority

- [FACT] N-3 acceptance text: `.ai/SPRINT-PLAN.md`, Phase 1 table, row N-3. No ADR,
  brief or report defines "decisions", "unlocks" or "idle". `grep` for N-3 across
  `.ai/`, `docs/adr/`, `docs/research/` finds only the references listed under Trigger,
  `.ai/AUTHORITY-INDEX.md` (N-1..N-3 row), and decision request 0005 (transitive scope).
- [FACT] `.ai/ROADMAP.md` "Rules that stay": a capability counts only when a
  deterministic test drives it from a compiled campaign month and observes authoritative
  state; "Values the manual lacks are researched or escalated, never invented."
- [FACT] `AGENTS.md` stop conditions: two plausible interpretations change gameplay;
  a repair would fabricate canonical information; determinism/golden change without an
  understood cause.

### E2. What the manual says about technology timing and research

- [SOURCE] Research is directed by priority, not by naming a technology. p.16: priorities
  are relative high/medium/low per field; "Other research areas will unlock various
  technologies". p.17 designer's note: players "cannot be sure what they will come up
  with"; some developments reflect "the conservatism of naval establishments".
- [SOURCE] p.19: nations have "research advantages in different areas and some bonus
  technologies that they will research easily".
- [SOURCE] p.19 (options): with no technology variation, "all technologies become
  available **for research** at the historical time they were developed"; "some
  variation" means one or two years' variation; "considerable variation" means up to six
  years later (pp.19–21). The manual therefore places `year`-like timing at _availability
  for research_, not at guaranteed discovery.
- [SOURCE] p.21: the manual's starts are 1890, 1900, 1920 and 1935. 1880 is a repository
  scenario (ADR-0201). `docs/research/rtw3-manual-baseline.md` ("What the manual does not
  supply") records that the manual gives no full tech tree. **No manual page therefore
  supplies a technology list or dates for 1880–1889.**

### E3. The technology records, by year

- [FACT] `content/production/1880/technologies.yaml` holds 84 technologies, each with an
  optional integer `year` (schema: `packages/content-schema/src/technology.ts`, bounds
  1880–1970). Count by `year`, 1880–1890: 1880 ×10, 1881 ×1, 1882 ×1, 1883 ×0, 1884 ×0,
  1885 ×5, 1886 ×5, 1887 ×0, 1888 ×1, 1889 ×2, 1890 ×1.
- [FACT] The file contains no `availabilityMonth` (0 occurrences) although the schema and
  the research phase define it (below).

### E4. Part and component availability in the empty years

- [FACT] Although no _technology record_ is dated 1883, 1884 or 1887, other content is
  gated to those calendar months (counts by `grep` over
  `content/production/1880/ship-building/`):
  - 1883-01: `parts/gun.yaml` (5 guns, e.g. `ah_krupp_149`), `parts/gun_mount.yaml` (4),
    `components.yaml` `gun_bl_6in_26`, `armament/gun-models.yaml`, `armament/gun-mounts.yaml`.
  - 1884: `parts/gun.yaml` (1), `parts/gun_mount.yaml` (1), `components.yaml`
    `gun_qf_6pdr`, `armament/gun-mounts.yaml`; and the torpedo model revision
    `parts/torpedo.yaml` (`from: 1884-01`).
  - 1887-01: `parts/gun.yaml` (7, e.g. `br_armstrong_127`), `parts/gun_mount.yaml` (4),
    `components.yaml` `gun_qf_47in`, `armament/gun-models.yaml`, `armament/gun-mounts.yaml`.
- [FACT] Those parts also `requires:` an earlier technology (e.g. `gun_breech_rifled`,
  `gun_qf_light`), so a part's effective availability is its own month plus its required
  technology's availability.
- [FACT] Content provenance in the same files flags several of these dates as estimates:
  e.g. the comment above `gun_bl_6in_26` in `components.yaml` reads "In-service year
  UNVERIFIED (1881-1887); 1884 chosen" while `introduction.fromMonth` is `1883-01`
  (an internal inconsistency in the comment/value pair; not a ruling on either).
- [INTERP] Under the _designer_ model (E5) 1883, 1884 and 1887 are empty only as
  **technology records**; they are not empty of **component introductions**. Whether that
  counts as "an unlock" is Decision A.

### E5. How `year` is consumed today

- [FACT] **Designer / construction gate (global, calendar-driven).**
  `unlockedTechIds` in `packages/ship-design/src/shipBuildingContent.ts` (~line 145, used
  at ~254) returns every technology with `year <= calendarYear(month)`;
  `unlockedTechs` in `packages/ship-design/src/armamentContent.ts` (~line 403) does the
  same. Neither consults any nation's completed or discovered technologies. ADR-0212
  already records this (lines citing `shipBuildingContent.ts:144/254`,
  `armamentContent.ts:403/475`).
- [FACT] **Runtime per-nation research is not connected to content technologies.**
  `resolveResearchPhase` (`packages/phase-engine/src/research.ts`) considers only ids in
  a hard-coded `TECH_DEFINITIONS` table of six stub entries (`basic_hull`, `advanced_hull`,
  `basic_steam`, `advanced_steam`, `basic_gunnery`, `advanced_gunnery`);
  `findEligibleTechsForField` returns false for any id absent from it. The file's own
  comment on `researchCostOf` says "real content technologies are not materialised into
  it". `packages/phase-engine/test/foreign-insight.test.ts` (~lines 325–331) pins this as
  a "reachability gap … so a future fix is deliberate". No `year` is read by the research
  phase; it reads `availabilityMonth` (absent from the content, E3) and applies a
  historical-timing weight modifier (5 000 / 8 000 / 10 000 / 12 500 bp bands).
- [FACT] **Per-nation seeded state.** `content/production/1880/research.yaml` seeds, per
  nation, `technologies` with `completed: true` for the 1880-era ones, plus priorities and
  a `currentProjectTechId`. `discoveredTechs` flows into the projection
  (`packages/campaign-engine/src/projection.ts`) and aircraft gating
  (`packages/phase-engine/src/aircraft.ts`).
- [FACT] **ADR-0212** decided starting-ship legality by global availability by 1880, and
  states that "Per-nation `completedTechs` … gate new construction, modernization, and
  design availability at order time." I found no consumer in `packages/*/src` or
  `apps/desktop/src` that gates construction or design by a nation's completed techs.
  [INTERP] ADR-0212's sentence describes intent that the shipped code does not
  implement; owner confirmation is needed in Decision D.
- [FACT] Correction to the planning run: it described the technology `year` as
  "informational" citing the N-1 report; the N-1 report line about an "informational
  `year`" concerns the _construction design catalog_ (`familyCreationMonth`), not
  technologies. Technology `year` is **functional** in the designer gate.

### E6. The torpedo identifier

- [FACT] Current identifier: `whitehead_14in_1886`. It is `availableFrom: 1880-01` with a
  single revision `from: 1884-01` (`content/production/1880/ship-building/parts/torpedo.yaml`).
- [FACT] **No proposed replacement identifier exists anywhere in the repository**
  (`docs/research/n-2-whitehead-14in-identity.md` §5 decides to _keep_ the id; the N-2
  brief/report only say a rename "if ever approved" is N-3 scope).
- [FACT] Classification by the repository: a "repository-internal canonical identifier of
  the form `<family>_<calibre>_<vintage-year>`" whose year is a retrospective vintage
  label — not a manufacturer (`14-in Fiume Mark IV`) or service (`14-in Mark IV`)
  designation and not the availability year (research note §4; confidence MEDIUM, §6).
- [FACT] Known reference/compatibility surfaces (files containing the string, excluding
  `node_modules`, `vendor`, `repos`, `.worktrees`):
  - content: `ship-building/parts/torpedo.yaml`, `parts/torpedo_launcher.yaml`,
    `ship-building/components.yaml`, `designs.yaml`;
  - frozen contract ids and key sets: `packages/combat/src/torpedoes/constants.ts`
    (`SEED_TORPEDO_MODEL_IDS`; sets `torpedo_models_v1` / `torpedo_v1` `shippedModelIds`),
    `packages/combat/src/torpedoes/detonation.ts` (model→fuze key set),
    `packages/combat/src/simulation/run-battle-resolution-child.ts`;
  - tests/fixtures (≈20 files across `combat`, `campaign`, `content-codemod`,
    `content-compiler`, `content-schema`, `ship-design`);
  - docs: the N-2 brief, report and research note.
- [FACT] The research note states a rename would change the `torpedo_models_v1` /
  `torpedo_v1` id surface, the model→fuze key set and the authoritative content hash.
  The effect on `golden/hashes.json` and on saves has **not** been measured.
- [FACT] Sibling ids follow the same naming policy (`whitehead_18in_1894`,
  `rn_21in_mk_iv_1916`, `usn_21in_mk14_1931`, …; note §5), so a rename of one raises the
  question of the family.

## Why agent judgment is insufficient

- A and D change what the acceptance test can legitimately assert; different readings
  produce different required content, tests and, for D, different authoritative state
  and saves. The manual (E2) contradicts the most literal reading of A ("an unlock each
  year") if it means guaranteed discovery.
- B asks whether to author canonical simulation content (technologies) that no manual
  page or accepted decision supplies. That is the AGENTS.md "fabricate canonical
  information" stop condition; historical plausibility is not RTW3 behavior.
- C changes a frozen contract id, the content hash and potentially goldens, and no
  replacement id has been proposed.

## Decision A — What "no idle stretch" means

Facts: E1, E2, E4. Unsettled: whether the test counts decisions, technology records,
or any availability event; and which player decisions qualify (this request does not
enumerate decision types; the owner or the later specification must define the set that
counts).

### Option A1: A meaningful player decision every year, unlocks not required

- Behavior: acceptance asserts that in each year of the scripted run the player has at
  least one qualifying decision available/pending; no per-year unlock requirement.
- Source fidelity: compatible with manual pp.16–17 (research is uncertain).
- Content: none required beyond defining the qualifying decision set.
- Tests: deterministic scripted run asserting decision availability by year.
- Acceptance: replaces "decisions and unlocks" with "decisions".
- Risks: "meaningful" needs a definition; weaker proof of the progression named in
  the plan (docks, torpedoes, protected cruisers, steel, QF guns).

### Option A2: At least one availability event every year

Owner picks the sub-variant:

- **A2-i, technology records only:** every year 1880–1889 (or –1890, owner states which)
  has ≥1 technology with that `year`. Fidelity: not established by any source for
  1883/1884/1887 (E2, E3); forces Decision B1–B3 content authoring. Tests: assert year
  coverage of `technologies.yaml`.
- **A2-ii, any content availability date:** a year counts if a technology _or_ a part/
  component introduction (E4) becomes available. Fidelity: uses existing content as-is;
  1883/1884/1887 already satisfy it (E4) subject to those dates' own provenance flags.
  Tests: assert from compiled content/month. Risk: content dates are partly flagged
  ESTIMATE/UNVERIFIED (E4), so the test certifies repository dates, not RTW3 behavior.

### Option A3: Quiet years are permitted

- Behavior: acceptance becomes an audit-style assertion that the named unlocks (docks,
  torpedoes, protected cruisers, steel, QF guns) occur at the dates the content
  declares, with no per-year guarantee.
- Source fidelity: highest (introduces nothing the sources lack).
- Content: none. Tests: dated-unlock assertions over existing content.
- Risk: departs from the plan's literal "no idle stretch"; the owner must accept that
  wording change.

### Option A4: Other (owner states the definition)

### [REC] for A

None. No repository authority selects among A1–A3. [INTERP] Evidence only excludes one
reading: a guarantee that _research discovery_ occurs each year, which contradicts
manual pp.16–17 and the unconnected research phase (E5).

## Decision B — Missing technology years (1883, 1884, 1887)

Facts: E3 (no technology records in those years), E4 (part introductions exist in those
years), E2 (no manual list for 1880–1889).
Sub-question B0 (owner confirms): under the effective designer model, are 1883/1884/1887
"gaps" at all, or only gaps in the _technology table_? (Answer A2-ii/A3 makes them not
gaps.)

State plainly: **historical plausibility alone does not establish RTW3 behavior.** No
option below names, dates or specifies any new technology; such details would be a later,
separately evidenced step.

### Option B1: Only technology explicitly supported by the manual

- Behavior: new technologies only if a manual page establishes them.
- [FACT/INTERP] E2: the manual's earliest start is 1890 and it has no tree, so this is
  expected to yield no new 1880–1889 technologies; B1 is effectively B4 plus a stated
  rule.

### Option B2: Historically grounded technology from identified sources

- Behavior: add technologies supported by named primary or high-quality secondary
  sources, each with per-value provenance, following the research-first pattern of
  ADR-0223/ADR-0226 and the `balance_adjustment` labelling of ADR-0213 where a number is
  not sourced.
- Fidelity: an explicit **repository deviation** from "simulation matches RTW3"
  (sources would be historical, not RTW3). Owner must authorize that deviation and name
  the acceptable source standard (which sources; whether single-source is allowed).
- Cost: one research ticket per technology, content authoring, a content-lock change
  and likely a golden re-pin (`docs/agents/golden-repinning.md`); D must be settled first.

### Option B3: Repository-original technology designed to approximate the source game

- Behavior: new technologies authored as balance choices, labelled as such.
- Fidelity: lowest; also an explicit deviation. Same cost profile as B2 without source
  research; the owner must state who defines the content and the labelling.

### Option B4: No gap-filling; revise acceptance instead

- Behavior: no new technologies; Decision A is answered with A1, A2-ii or A3.
- Fidelity: highest. Cost: none to content.

### [REC] for B

None as a sole choice. [INTERP] B4 is the only option that does not need an owner
waiver of AGENTS.md/ROADMAP "never invented" rules, so it is the lowest-risk default if
the owner has no source standard to name.

## Decision C — Torpedo-contract identifier

Facts: E6. Current id `whitehead_14in_1886`. **Proposed id: none exists in the repository;
the owner must supply one if approving.**

[INTERP] Classification by the repository's own account: the id is a repository label
with a retrospective vintage year, so a rename would be **cosmetic/corrective of
naming**, not a semantic change to the weapon. Compatibility effect is nevertheless
authoritative: frozen id surface, key sets, content hash (E6).

### Option C1: Reject the rename; keep `whitehead_14in_1886` as canonical

- Impact: none; N-3 drops the torpedo-contract task. Documented by the N-2 research
  note (already merged).

### Option C2: Approve a rename to an owner-specified id

- Impact: lockstep change to every surface in E6; wire formats are frozen
  (`AGENTS.md`: parity tests from existing fixtures), so a compatibility/ADR decision is
  required on the `_v1` contract surface; compiled content hash and content lock change;
  golden effect must be measured and justified (stop condition if the cause is not
  understood); saves keyed by the old id would need an explicit decision (saves are
  refused on mismatch, never migrated at runtime, per README). Family siblings (E6)
  must be answered: rename only this id, or the whole family under a revised naming
  policy.

### [REC] for C

[REC] C1. Evidence: the id is classified as a deliberate repository label, no
proposed replacement exists, and the rename's blast radius is large (E6) with no
fidelity gain.

## Decision D — Meaning of technology `year`

Facts: E2, E5. The seven candidate meanings, with what the repository does today:

| Meaning                          | Source or repository status today                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Earliest possible discovery year | Manual p.19 supports "available for research at the historical time". Research phase does not read `year`; it reads absent `availabilityMonth`. |
| Guaranteed availability year     | Not supported by the manual (pp.16–17, 19); not implemented.                                                                                    |
| Content-era classification       | Plausible but unratified; no ADR.                                                                                                               |
| Designer / construction gate     | **Implemented**: `year <= calendar year` makes the technology count as unlocked (E5).                                                           |
| Per-nation research eligibility  | Not implemented for content techs (stub table); ADR-0212 states intent.                                                                         |
| Actual per-nation discovery      | Not reachable for content techs (pinned reachability gap, E5).                                                                                  |
| Globally unlocked technology     | **Implemented** for the designer; independent of any nation's research.                                                                         |

### Option D1: `year` is the global availability/unlock year (current designer behavior is canonical)

- Meaning: once the calendar year begins, the technology is globally unlocked for
  design; per-nation research is a separate concept and does not gate designs.
- Fidelity: departs from the manual's research-driven unlocks (pp.16–17); explicit
  deviation unless the owner accepts it.
- Determinism: simple, calendar-only. Saves: no schema change. AI: no research
  dependence for designs. Acceptance: N-3 unlocks are testable by calendar year.
- Effect on A/B: A2-i and B become about technology `year` coverage.

### Option D2: `year` is the earliest year a technology becomes _researchable_; discovery is per-nation

- Meaning: matches manual p.19 for the "no variation" case; designs would be gated by a
  nation's discovered technologies.
- Requires work outside N-3: connecting content technologies to the research phase
  (replace the stub table), mapping `year` to `availabilityMonth`, nation-specific
  progression, a gating change in the designer/construction path; compatibility bump
  and re-pin; migration of research seeds. [INTERP] this is a separate milestone-sized
  change and likely changes authoritative outcomes and goldens.
- Determinism: stays deterministic (seeded `research/month/{nation}/{field}` streams),
  but discovery outcomes become random draws — acceptance tests need fixed seeds and
  cannot assert a discovery each year (links to A).
- Saves: research state already in saves; behavior changes need a version decision.
- Effect on A/B: A2 "unlock every year" is only assertable as researchability/availability.

### Option D3: Hybrid, two fields (global availability year and nation research eligibility)

- Meaning: `year` stays the global content/designer gate; a separate, owner-defined
  concept governs per-nation research eligibility.
- Cost: schema change (frozen wire format, parity test, new field); more content
  authoring; owner must define the second concept's semantics.

### Option D4: Defer; N-3 asserts only what the current model does (no change to meaning)

- Meaning: N-3 documents D1 as the _current_ behavior, makes no claim about canon, and
  the per-nation research connection is a later milestone.
- Cost: none; the plan's "unlocks" are then calendar unlocks by definition.

### [REC] for D

None, because the choice is a fidelity-versus-scope decision for the owner. [INTERP]
D1/D4 describe code that exists today; D2 aligns with the manual but is not N-3 scope
without a scope decision; ADR-0212's sentence about `completedTechs` gating (E5) should
be confirmed or corrected in the owner's response.

## Consequences across decisions (summary, [INTERP])

| Combination             | N-3 shape                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| A3 or A1 + B4 + C1 + D4 | Smallest: audit-style acceptance over existing content; no re-pin; no content authoring.                          |
| A2-ii + B4 + C1 + D1    | Calendar-unlock assertions over existing content; no re-pin expected (to be confirmed by the specification).      |
| A2-i + B2/B3            | Research or authoring tickets per technology; content-lock change; probable golden re-pin; needs source standard. |
| D2 or D3 (any A)        | N-3 splits: a research-connection milestone must precede or replace the unlock acceptance.                        |
| C2 (any)                | Adds a compatibility/ADR decision and a re-pin analysis.                                                          |

## Recommendation (overall)

[REC] Answer C with C1. For A, B and D, no repository evidence selects an option; the
lowest-fidelity-risk and lowest-cost combination is A3 or A1 with B4 and D4 (or A2-ii with
D1 if the owner wants per-year assertions), as listed in the table above. The owner
must make this choice; it is not a settled simulation rule. No behavior is to be
implemented before approval.

## Effect on N-3 acceptance criteria

The acceptance row in `.ai/SPRINT-PLAN.md` stays literal until the owner responds.
Each selection above states the replacement meaning. After approval, the specification
phase must restate the N-3 acceptance in terms of the owner's selections and cite this
request. This request does not edit the sprint plan.

## Downstream milestones and tickets affected

- N-3: gated (no map, specification or tickets exist).
- Anything that depends on a research-connection change (D2/D3), on new technology
  content (B2/B3), or on a torpedo id change (C2) inherits their re-pin and ADR needs.
- S-1 and N-2 are complete and unaffected. Roadmap items after N-3 in
  `.ai/SPRINT-PLAN.md` are affected only through the sequencing of N-3.

## Eligibility conditions for `wayfinder`

N-3 becomes eligible when all hold: (1) A has an explicit selection with a stated
definition of any counted "decision"; (2) B has an explicit selection, and for B2/B3 a
named source standard or labelling rule plus owner authorization of the fidelity
deviation; (3) C is approved or rejected, with an owner-supplied id if approved;
(4) D has an explicit selection and ADR-0212's `completedTechs` sentence is confirmed or
corrected; (5) the owner's responses are recorded in this file's "Owner response"
section (and an ADR if C2, D2 or D3 constrain compatibility or determinism).

## Prohibited until the decision was accepted (now resolved)

- Running `wayfinder`, `to-spec` or `to-tickets` for N-3.
- Authoring, renaming, redating or deleting any technology, part, component, torpedo id,
  or research seed.
- Connecting content technologies to the research phase or changing the designer's
  unlock gate.
- Any golden re-pin or content-lock change attributed to N-3.
- Treating a recommendation here as an established RTW3 rule.

## Work safely completed while blocked

- Read-only investigation behind E1–E6; no repository content other than this file was
  changed, no tracker item was created, and no specification or ticket exists for N-3.
- `pnpm preflight` passed on a clean `dev` before this file was added.

## Owner response

Recorded 2026-10-17 as resolved by delegation to the agent; the four N-3 decision
tickets were worked and closed (#43–#46). See spec #47 for the settled
acceptance and ADR-0229 for the documented `year` semantics.

- Decision A — selection: `[ ] A1  [ ] A2-i  [x] A2-ii  [ ] A3  [ ] A4` ; year range
  covered (1880–1889 / 1880–1890): **1880–1889** ; definition of a counted
  "decision": **at each January, one command accepted by the player-facing
  validation in each of the research-priority, construction-order and
  ship-design/refit families (spec #47 R4)**
- Decision B — B0 confirmation (are 1883/1884/1887 gaps?): `[ ] yes  [x] no`;
  selection: `[ ] B1  [ ] B2  [ ] B3  [x] B4` ; source standard / labelling rule (B2/B3):
  **n/a** ; fidelity deviation authorized: `[ ] yes  [x] no`
- Decision C — `[x] C1 reject  [ ] C2 approve` ; new id (C2): **n/a** ; scope
  (this id only / family): **n/a** ; save/compatibility handling: **n/a**
- Decision D — selection: `[ ] D1  [ ] D2  [ ] D3  [x] D4` ; ADR-0212 `completedTechs`
  sentence: `[ ] confirmed as intent  [x] corrected to match code` ; notes:
  **recorded in ADR-0229; per-nation research wiring deferred**
- Owner / date: **owner delegation, 2026-10-17**
