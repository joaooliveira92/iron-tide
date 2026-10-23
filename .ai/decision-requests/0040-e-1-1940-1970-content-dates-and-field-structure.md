# Decision Request: E-1 1940-1970 content dates, source policy and field structure

## Status

Resolved (2026-10-23): the owner approved every recommendation (D1 A, D2 A, D3 accept except D3i, D4 all, D5 A), recorded as
[ADR-0283](../../docs/adr/ADR-0283-e1-1940-1970-content-decisions.md). E-1 tickets 04 to 09 (#253 to #258) are unblocked.

## Trigger

ADR-0282 moved the authored horizon to 1970 and requires research first. The research
([`docs/research/e-1-1940-1970-timeline.md`](../../docs/research/e-1-1940-1970-timeline.md)) found that the manual gives mechanics
for radar and missiles (pp.121-127) and one date ("missiles from circa 1945", p.121), but no technology list, years or costs for
1940-1970. Authoring them would invent simulation values (AGENTS.md stop condition), so each decision is returned here.

## Evidence

- Manual pp.121-127 (mechanics, no dates); Steam community guide anchors (medium trust, not game data); real-world introduction years
  from named reference works (candidates only). All in the research note.
- The pack has ten research fields and no radar-electronics, missile or aircraft field; radar fits FIRE_CONTROL, missiles fit none.
- `shipTypes.ts` already names eras `MID_CENTURY` (1940) and `LATE` (1960); dock-expansion steps already reach 1970.

## Why agent judgment is insufficient

Dates and costs change when a player can build jets and missiles and what a 1950 nation can do. A different field structure changes the
research screen, schemas and goldens. These are gameplay decisions, not engineering ones.

## Decisions requested (each separate)

### D1: Field structure for radar, missiles and aircraft

- Option A: add fields `RADAR_ELECTRONICS`, `MISSILES` and `NAVAL_AVIATION`. Clear player model; touches the field vocabulary and screens.
- Option B: radar into FIRE_CONTROL, missiles into GUNNERY, aviation into SHIP_DESIGN. No new fields; muddier grouping.
- Recommendation: A. Minimum response: "A", "B", or a different grouping.

### D2: Date source policy

- Option A: adopt the `historical-analogue` year for each technology as a `BALANCE_TARGET`, with the community anchors overriding where
  they exist.
- Option B: adopt only the community and manual anchors and return every other date individually.
- Option C: the owner supplies the dates.
- Recommendation: A, since the manual gives none and ADR-0239 set the precedent. Minimum response: "A", "B" or "C".

### D3: Years per candidate group (decide each independently)

For each, accept the candidate in the research note, change the year, or drop the technology: D3a FIRE_CONTROL (radar, blind fire,
radar MAA, proximity fuze); D3b GUNNERY; D3c TORPEDOES; D3d MINES_AND_ASW; D3e SUBMARINES; D3f MACHINERY; D3g HULL_CONSTRUCTION;
D3h SHIP_DESIGN (helicopters; decade unpinned); D3i DAMAGE_CONTROL (no source: add nothing, or the owner proposes);
D3j carrier jets, steam catapult and angled deck; D3k SAM heavy and medium, light SAM; D3l SSM heavy, medium AShM; D3m data link and
cruise missiles. Recommendation for each: accept the candidate, except D3i (add nothing).

### D4: Postwar ship classes

Which of fleet carrier (jet), escort carrier, guided-missile destroyer and frigate, ASW corvette and frigate, missile corvette and fast
attack craft, guided-missile cruiser enter, and when. Recommendation: all, dated by the technology each requires.

### D5: Costs and discovery weights

The manual gives none. Option A: derive from the nearest existing technology in the same field and label them `BALANCE_TARGET`
(ADR-0239 precedent). Option B: the owner supplies them. Recommendation: A.

## Owner response needed

One line per decision (D1, D2, D3a to D3m, D4, D5).
