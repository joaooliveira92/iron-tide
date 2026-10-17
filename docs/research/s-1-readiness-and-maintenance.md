# S-1 readiness and maintenance — manual grounding

Status: new research note, created 2026-10-15 by the S-1 scoping sprint. Grounds the
sprint S-1 acceptance in `.ai/SPRINT-PLAN.md` ("Ship readiness and maintenance": active /
reserve / mothballed / working-up, crew quality ramp, maintenance by status, repair
cost ×2, wartime maintenance; working-up ships excluded from battles). It extends the
citation map in [`rtw3-manual-baseline.md`](rtw3-manual-baseline.md); that note is not
rewritten.

## Source and method

- Source: `docs/Rule the Waves 3 Manual EBOOK.pdf` — the RTW3 game manual, authority
  order 3 per [`.ai/AUTHORITY-INDEX.md`](../../.ai/AUTHORITY-INDEX.md) and ADR-0210.
- Method: text extracted page-by-page with `pypdf` **6.14.2** (`PdfReader.pages[i]
  .extract_text()`), 148 pages. The full extraction and a per-page working copy are kept
  in the session temp dir, not tracked. Text is 0-based in `pypdf`; the manual's printed
  page number is the PDF page index + 1 (e.g. `pages[50]` is printed p.51). All citations
  below are the **manual's printed page number**, matching the header text on each page
  and the convention already used in `rtw3-manual-baseline.md`.
- Pages read in full for S-1 context: printed pp.41–72 (the "Managing your fleet"
  section pp.45–58 and the start of "Politics and relations" pp.59–66), plus the dock /
  shipyard capacity pages (pp.32–33), the halt-construction note (p.30), and the
  appendices (pp.128–143). Every claim below is excerpt-verified against that extraction.
- Scope guard: only mechanics on the S-1 acceptance path are recorded. Values the manual
  omits are listed under "What the manual does not supply" and are never inferred.

## Terminology confirmed by the manual

The manual's own ship-list key (p.48) is the authoritative status nomenclature:

| Code | Meaning (p.48) |
| --- | --- |
| `AF` | Active fleet |
| `RF` | Reserve Fleet |
| `MB` | Mothballed |
| `R` | Raider |
| `FS` | On foreign station |
| `TP` | Trade protection |
| `WU` | Working Up |
| a number | "the ship is in repair for that number of months" |
| `*` after status | "the ship needs maintenance and should return to an area with sufficient base capacity" |

Note the manual treats "Raider", "On foreign station" and "Trade protection" as *status*
values in the same list as active/reserve/mothballed/working up. These are mission
assignments, not readiness states; S-1's four readiness states map to `AF`, `RF`, `MB`,
`WU` (p.48, p.51).

## Confirmed mechanics (excerpt-verified)

### Readiness states and what each means (p.51)

- "Ships in commission can be put in varying states of readiness, which will affect their
  maintenance costs, but also their readiness for war." (p.51) — i.e. readiness is a
  per-ship state that trades maintenance cost against war availability.
- **Active fleet:** "have the best trained crews and are immediately available for
  service." (p.51)
- **Reserve fleet:** "man­ned by reservists and will take time to get to full
  effectiveness." (p.51)
- **Mothballed:** "have poorly trained crews and will and take substantial time to get to
  full effectiveness." (p.51; the manual's duplicated "and will and" is verbatim)
- **Working up:** "New ships and ships just mobilized will be placed in 'Working up'
  status until they have decent crew quality. They can be changed to another status by
  the player (but not back). Ships in working up status will not take part in battles."
  (p.51)
- The "(but not back)" clause means working-up is an entry-only state: a ship may leave
  working up for another status but cannot be returned to it. (p.51)
- Reserve and mothballed ships **can still fight / be attacked**: "Ships in reserve or
  mothballed status might be included as defending ships in a surprise attack, even
  though they will otherwise not take part in battles. This is to make them vulnerable,
  and make it impossible for the player to 'hide' ships from surprise attacks by putting
  them in reserve." (p.69)
- Base capacity interacts with readiness: exceeding an area's base value "may cause ships
  to suffer from maintenance problems and reduced crew quality"; base limits are checked
  at end of turn, so a fleet can still fight in an over-base area that turn. (p.45; the
  `*` list marker, p.48)

**Not stated:** the manual does not say whether reserve/mothballed ships can *move*
strategically. It only states that working-up ships do not fight (p.51) and that
reserve/mothballed ships do not otherwise take part in battles (p.69). Whether they are
stationary is not defined.

### Crew quality / experience

- The manual gives **no named crew-quality grades** (no "green / trained / veteran /
  elite" scale). It describes quality only comparatively: active = "best trained"
  (p.51); reserve = "reservists", takes "time to get to full effectiveness" (p.51);
  mothballed = "poorly trained", takes "substantial time" (p.51); working up applies
  "until they have decent crew quality" (p.51).
- The ramp is **qualitative only, with no schedule**: no monthly progression rate, no
  sea-time counter, and no per-grade table are given anywhere in the manual (verified by
  searching all 148 pages for "green", "veteran", "trained", "quality").
- The manual implies a bracket system but does not enumerate it: officers with brilliant /
  above-average ability "can push the crew quality over the edge into the next better
  bracket"; incompetent / below-average "into the next worse bracket" (p.57). The bracket
  names are never listed.
- What crew quality affects, per the manual: gunnery accuracy and rate of fire ("Crew
  quality" is a listed factor for both, pp.92–93); trade-protection / ASW effectiveness
  ("the crew quality of patrolling ships will have an effect", p.71); and battle
  readiness generally (pp.51, 92–93).
- Factors the manual names as *modifying* crew quality:
  - **Cramped accommodation** "will affect crew quality negatively if ships are outside of
    home waters"; after 1955, spacious accommodation is needed to keep up crew quality
    (p.42).
  - **Over-base deployment** causes "reduced crew quality" (p.45).
  - **Poor education level** national characteristic "affects the quality of ship crews
    and pilots" (p.59).
  - **Division experience** "has a slight impact on ship crew quality for battle" (p.55);
    a division commander's ability "slightly" affects crew quality of his ships (p.56).
  - Officer ability and some characteristics nudge crew quality at battle determination
    (p.57; p.143, e.g. Disciplinarian "His crew will improve relatively fast, but … will
    stop the crew from becoming really good").
- **Sea time as a ramp driver is not stated.** The manual ties improvement to *status*
  (active best, reserve/mothballed worse) and to special training / fleet exercise, not to
  accumulated months at sea.

### Maintenance

- Charged while a ship is in commission, at a rate that varies by readiness state (p.51).
  The manual does **not** name a single "monthly" charge for base active maintenance —
  maintenance is a recurring cost implied by the monthly turn, not a stated figure.
- **Ships under repair cost about 2× the active maintenance cost:** "Ships under repair
  will cost about 2 times the active maintenance cost. This is to reflect the cost of
  making the repairs." (p.51) — this is the S-1 "repair cost ×2".
- **Mothballed ships do not pay the repair premium:** "Ships in Mothballed status will
  have repair work halted and will not incur the extra cost." (p.51) They show an `H` in
  the ship list as a notification. Rationale given: repair cost "crowds out other
  important ship construction" (p.51).
- **Fleet exercise:** "Ships participating in the exercise will cost twice the active
  maintenance cost and gain some experience." Held once a year with selected ships; large
  exercises can raise tensions. (p.53)
- **Special training** increases maintenance cost while paid for: each subject selected
  "will increase maintenance cost for your ships" (p.53), with per-subject percentages
  (see below).
- **Wartime maintenance rises sharply — no number:** "Designer's Note: In wartime,
  maintenance costs will rise sharply. There is a prediction in the main screen of the
  cost of having all ships in active status. In addition to this, there will be extra
  wartime maintenance costs." (p.52) The manual gives no multiplier or figure.
- **Construction relation:** halted construction "will cost half of their mothballed
  maintenance cost" (p.30). This is the only place the mothballed rate is referenced
  indirectly; the manual never states the mothballed rate itself.
- **Officer effect:** the "Good administrator" characteristic "Reduces maintenance cost of
  his ship." (p.143) — no number.

#### Special training (pp.53) — the quantified maintenance adders

- 12 months to reach proficiency in a subject; must keep spending to keep benefits;
  benefits disappear immediately on stopping. (p.53)
- Maximum **two** subjects. (p.53)
- Gunnery: +10% gunnery accuracy, **+30% maintenance**. (p.53)
- Night fighting: better night spotting, less hesitation, +10% night accuracy,
  **+20% maintenance**. (p.53)
- Torpedo tactics: better light-force torpedo response/hit chances, **+20% maintenance**.
  (p.53)
- Damage control: faster flooding/fire control, **+20% maintenance**. (p.53)
- "The cost of special training is reduced for Japan." (p.53) — no number; the only
  per-nation modifier in this section.

### Repair

- Repair is expressed as a **duration in months per ship** in the ship list, not a cost
  table: "A number means the ship is in repair for that number of months" (p.48).
- Repair cost is the ~2× active maintenance premium (p.51); mothballing halts repair and
  removes the premium but leaves the ship unrepaired (p.51).
- The manual recommends considering a **rebuild** while damaged — "It is a good idea to
  consider taking the opportunity to rebuild damaged ships, as that will enable some
  savings and use the repair time to improve the ship." (p.51) Rebuild rules are pp.31–32.
- Repair capacity is **not** tied to dock size in the manual. Dock size limits ship
  *construction/operation* size and feeds shipyard capacity for construction; the manual
  never states that damage repair consumes dock or shipyard capacity (pp.32–33).
- The battle-side repair model uses per-ship damage state rather than a dock, but that is
  a tactical-battle rule (pp.78–101), out of S-1's strategic scope.

### Working-up

- Trigger: "New ships and ships just mobilized will be placed in 'Working up' status
  until they have decent crew quality." (p.51) — both newly built and reactivated ships.
- Exclusion: "Ships in working up status will not take part in battles." (p.51)
- Exit: player may move a working-up ship to another status, "but not back". (p.51)
- Duration: not stated beyond "until they have decent crew quality" (p.51). No month
  count.
- The manual elsewhere demonstrates the crew-quality difference working up represents:
  "a carrier that has been in the active fleet will have better pilots than a newly
  mobilized one" (p.68) — but that is about pilots, not a working-up timer.

### Foreign station / presence (adjacent, S-5 but cited on the S-1 pages)

- Minimum tonnage presence per area depends on possessions; "Only active ships or ships
  on foreign stations status … count"; colonial-service ships count 1.5×; cramped or
  short-range ships count less. (p.46)
- During wartime under blockade, foreign-station deployment requirements are not enforced.
  (p.46)
- Reaching requirements can be automatic via Foreign Station status, letting the AI move
  the ship. (p.47)

## Deliberate divergences

- **Sole 1880 start** (ADR-0201 / DR-001): the manual's starts are 1890/1900/1920/1935
  (p.21). Carried from the baseline note; it does not change S-1's mechanics, only the
  seed fleet that S-1 will show readiness states for.
- No S-1-specific divergence is recorded in the plan or ADRs. The S-1 acceptance restates
  the manual rather than departing from it, so the manual's rules are the default unless
  the orchestrator or spec records a divergence.

## What the manual does not supply

These are gaps for S-1; they must be **escalated as decision requests or left as
non-normative BALANCE TARGET**, never invented as fact:

1. **Per-status maintenance multipliers.** Only relative anchors are given: repair =
   ~2× active (p.51), fleet exercise = 2× active (p.53), halted construction = half of
   mothballed (p.30). The absolute active rate, and the reserve and mothballed rates, are
   never stated. "Maintenance by status" therefore has one grounded ratio (repair ×2) and
   no table.
2. **Crew-quality grades and progression.** No named grades and no ramp schedule exist.
   The manual gives only "best trained" / "reservists, takes time" / "poorly trained,
   substantial time" / "until decent crew quality" (p.51), and refers to unnamed
   "brackets" (p.57). Any green/trained/veteran/elite scale and any monthly ramp is an
   S-1 design decision, not a manual value.
3. **Wartime maintenance magnitude.** "Rises sharply" (p.52) with no figure.
4. **Transition times and costs between readiness states.** The manual implies time for
   reserve/mothballed to reach full effectiveness (p.51) and states 12 months for special
   training (p.53), but gives no commissioning, decommissioning, reactivation or
   working-up duration. Whether any transition charges a one-off cost or only a changed
   recurring rate is not stated.
5. **Repair capacity/time model.** No dock-capacity cost for repair, no repair-time
   formula, and no statement of which statuses a ship must be in to repair beyond
   "mothballed halts it" (p.51, pp.32–33). Repair time only ever appears as a per-ship
   month count in the list (p.48).
6. **Per-nation differences.** Only two appear: Japan's reduced special-training cost
   (p.53) and the "Global naval power" 10%-foreign-station / no-cramped-quarters rule
   (p.59). No per-nation maintenance or crew-quality multipliers are given.
7. **Definitions of "commissioned" and "mobilized".** Both are used (pp.51, 68) but never
   defined, and the manual does not say which states count as "in commission".

## Recommendations for S-1

- **Grounded values the implementator may use as canonical:**
  - Readiness states and their names/codes: active (`AF`), reserve (`RF`), mothballed
    (`MB`), working up (`WU`) (pp.48, 51).
  - Working-up ships are excluded from battles (p.51); reserve/mothballed ships are
    excluded from ordinary battles but may be caught by a surprise attack (pp.51, 69).
  - Repair cost = about **2× active maintenance**, and mothballing halts repair and its
    premium (p.51).
  - Special-training maintenance adders and 12-month proficiency, max two subjects
    (p.53); fleet exercise at 2× active and once a year (p.53).
  - Repair appears in the list as a month count (p.48).
- **Must remain BALANCE TARGET (non-normative):** the absolute active maintenance rate;
  reserve and mothballed rates; the reserve → active and mothballed → active ramp times;
  the crew-quality grade scale and its ramp; the wartime maintenance multiplier; any
  one-off transition cost; and any repair-capacity or repair-time formula. These have no
  manual source and must be authored as explicit, versioned ruleset constants with an
  owner, not presented as manual facts.
- **Suggested S-1 design constraints (proposals, not findings):** model readiness as a
  per-ship enum with a status-specific recurring maintenance rate and a crew-quality
  value that ramps toward the state's ceiling; keep the working-up exclusion and the
  repair-×2 / mothball-halts-repair rules exactly as the manual states them; and expose
  the wartime multiplier as a single ruleset constant so it can be tuned without changing
  the model.

## Deferred

- Repair/dock capacity semantics (does repair consume dock size or shipyard capacity?)
  needs an owner decision; the manual is silent. Cross-reference: N-1 (docks) and S-5.
- Whether "Raider", "Foreign Station" and "Trade Protection" are readiness states or
  mission assignments is a modelling choice; the manual lists them in the same status
  field (p.48) but describes them as assignments (pp.46–47, 71). No owner assigned; flag
  to the spec, do not resolve silently.
- Any per-nation maintenance/crew differences beyond Japan's training discount (p.53)
  and the "Global naval power" rule (p.59) are unresearched; the manual does not give
  them. If S-1 needs variance, raise a decision request.

## S-1 production constants and their provenance (ticket 08)

Every S-1 numeric gameplay value is a named, centralized ruleset constant; none is
embedded in a phase. The table records each constant, its value, and whether it is
grounded in the manual or an admitted ADR-0213 `balance_adjustment` (a balance
choice, never presented as a manual fact). Constants live in
`packages/campaign/src/maintenance.ts` (maintenance) and
`packages/campaign/src/readiness.ts` (readiness/crew).

| Constant | Value | Class | Basis |
| --- | --- | --- | --- |
| `MAINTENANCE_ACTIVE_MULTIPLIER_BP` | 10_000 (base) | grounded anchor | Active is the base rate the manual's ratios are stated against (p.51) |
| `MAINTENANCE_WORKING_UP_MULTIPLIER_BP` | 10_000 | balance_adjustment | Working-up ships are in commission at the base rate; the manual gives no figure |
| `MAINTENANCE_RESERVE_MULTIPLIER_BP` | 7_500 | balance_adjustment | The manual says reserve is cheaper but gives no figure (p.51) |
| `MAINTENANCE_MOTHBALLED_MULTIPLIER_BP` | 5_000 | grounded | Mothballed = half active (p.30) |
| `MAINTENANCE_REPAIR_MULTIPLIER_BP` | 20_000 | grounded | Repair ≈ 2× active (p.51) |
| `MAINTENANCE_WARTIME_MULTIPLIER_BP` | 12_500 | balance_adjustment | "Rises sharply", no figure (p.52); applied to active only |
| `ACTIVE_CREW_CEILING` | 100 | balance_adjustment | "Best trained" (p.51); no scale given |
| `WORKING_UP_CREW_CEILING` | 100 | balance_adjustment | Working-up ramps to the active standard (p.51) |
| `RESERVE_CREW_CEILING` | 70 | balance_adjustment | "Reservists … time to get to full effectiveness" (p.51); no figure |
| `MOTHBALLED_CREW_CEILING` | 30 | balance_adjustment | "Poorly trained … substantial time" (p.51); no figure |
| `REPAIR_CREW_CEILING` | 100 | balance_adjustment | A repairing ship keeps its crew (p.51) |
| `CREW_QUALITY_RAMP_PER_MONTH` | 5 | balance_adjustment | Status-driven, no RNG (D4); the manual gives no ramp schedule (p.51) |
| `WORKING_UP_DECENT_THRESHOLD` | 60 | balance_adjustment | "Until they have decent crew quality" (p.51); no value given |
| `REPAIR_MONTHS_MAX` | 120 | balance_adjustment | Bounds the per-ship repair month counter (p.48); no maximum stated |
| `BATTLE_READINESS_FLOOR` | 60 | balance_adjustment | Pre-existing campaign combat floor; readiness below it is `FUEL_BATTLE_INELIGIBLE` |
| `AUTO_TORPEDO_CREW_QUALITY_BP` | 7_000 | balance_adjustment | Auto-resolution torpedo neutral crew (ADR-0026); pending per-ship crew threading |

The battle-readiness value combat consumes is the ship's crew quality (0..100), so no
separate battle-readiness constant is needed; the former hard-coded `80` is removed
(ADR-0223).

No golden re-pin accompanies ticket 08: the reference run's fleet is all active, at
its crew ceiling, and at peace, so every one of these constants is a no-op on the
reference output. Observable production output therefore does not change, and the
goldens stay pinned (`pnpm check:golden`: 11/11).
