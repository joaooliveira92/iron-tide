# RTW3 manual pp.23–33 ship-designer audit

Status: new research note, created 2026-10-18 for wayfinder research ticket **#153**,
child of map **#152** ("Ship designer: close the in-era gap to the RTW manual"). It
audits the fields and mechanics the RTW3 manual names in its ship-designer / ship-design
section and classifies our parity-bar items as **in-era (1880–99)** or **later**, with
page citations. It records only what the manual states; it does not author content or
constants.

## 1. Question

What designer fields/mechanics does the RTW3 manual name in the ship-design section
(pp.23–33 and the pages it cross-references), and — for each item on the Bluewave
parity bar — does the manual present it as available in the 1880–99 window or gate it
behind later research/eras? Specifically the parity bar: turret-side/turret-roof,
secondary/barbette and deck-extended armour; engine priority and unit machinery;
per-mount gun quality and fire-control positions; freeboard as a direct input/preset;
tertiary-gun role; named armour schemes; and "Suggest name".

## 2. Sources and method

- **Primary (in-repo, directly verified):** `docs/Rule the Waves 3 Manual EBOOK.pdf`
  (the RTW3 game manual, 148 pages), extracted page-by-page with `pypdf` 6.14.2.
  Page numbers below are the manual's **printed** page numbers; per
  `docs/research/rtw3-manual-baseline.md` ("Source and method") they match the PDF page
  index in these ranges. Pages read directly for this note: **23–33** (the design
  window, "Building your fleet › Designing ships"), cross-referenced **37–44**
  ("Construction choices"), **18–22** (scenario starts), **89–93** (hit locations and
  gunnery), and **131–135** (Appendix 1 ship-type definitions; Appendix 2 "Explanation
  of values used in ship design").
- **Method:** full-text keyword search across all 148 pages for each parity-bar term
  (`freeboard`, `unit machinery`, `engine priority`, `machinery`, `barbette`,
  `deck extended`, `turret roof`, `gun quality`, `fire control`, `suggest`, `tertiary`,
  `role`, `scheme`, `director`, `hull`). Absences are reported as **UNVERIFIED** (term
  not found), never guessed.
- Authority: per ADR-0210 the manual is authority order 3 — authoritative for mechanics
  and terminology, except where an accepted decision deliberately diverges. It is not
  authoritative for scope.

## 3. Findings

### 3.1 The design-window flow and mechanics named (pp.23–33, primary, verified)

"Building your fleet › Designing ships" (p.23) says the player designs ships from
destroyers to super dreadnoughts, either from scratch, by modifying an existing class
(p.24), or via auto-design (p.25). The report labels problems **Error** (must fix; design
illegal) or **Note** (advisory) (p.25). Ships must keep weights within the displacement
limit; slight overweight is allowed with a stability/flotation penalty (pp.25–26). A new
class takes a **1–4 month design study** and a cost; deriving from an existing class
discounts both, with change limits: displacement ±10% or 1000 t, main guns over 6 in
fixed, speed ±1 kn, vertical armour ±1 in, horizontal ±0.5 in (pp.26–27).

The design window's armament and equipment sections (pp.27–30):

- **Main turrets** — handled individually; each has a fire arc set by gun *position*
  (moving the mount is aesthetic only); positions depend on research and ship type
  (p.27).
- **Secondary guns** — total number only, no individual fire arcs; a proportion fires on
  each bearing; odd guns go on the centreline (pp.27–28).
- **Tertiary guns** — total number only, no fire arcs; mount graphics are purely
  decorative and do not track the target (p.28).
- **Torpedo tubes** — position + number of tubes per mount (p.28).
- **Visual extras, ship graphics, superstructure (6 layers), funnels** — appearance only
  (pp.28–30).
- **Topside points** — every weapon and radar costs topside points; a ship has a maximum
  based on displacement, exceedable at a stability cost (p.30).
- **Building** — cost paid in monthly instalments; can halt; accelerate a limited number
  of ships (10% faster, +5% cost); order up to 12 of a class with **names assigned
  automatically** (pp.30–31).
- **Rebuilding** — main armament swaps (turrets interchangeable if calibres compatible),
  secondary/tertiary battery up to 6 in, machinery swap, fire-control improvement, bulges,
  +1 in deck armour, remove conning tower, change upper belt, convert to CV/CVL
  (pp.31–32).
- **Docks / shipyard capacity** — dock size caps build size and scales shipyard capacity
  (pp.32–33).

### 3.2 The designer data fields (Appendix 2, pp.134–135, primary, verified)

Appendix 2 enumerates the data fields (with a note that "some features can only be used
when researched"):

**Class/identity:** Class name (unique; used as filename), Enemy class name, Misidentified
class name (both program-generated) (pp.134–135).

**Hull / protection:** Displacement (standard, tons); Belt; BU (upper belt); BE (belt
extended); D (deck); DE (deck extended); T (main gun turret **and barbette** armour);
TT (turret top); SEC (secondary gun armour); CT (conning tower); Belt coverage (narrow
belt); Torpedo defence (p.135).

**Mobility/machinery:** Speed (max designed); the engine type/priority choices are in
§3.3 (pp.41).

**Fire control:** Fire control (the equipment); **Fire control positions** (the *number*
of positions; more = redundancy; positions are fragile and can be shot away) (p.135).

**Armament:** Main gun calibre (rounded to inches); Increased elevation; **Gun quality**;
Cross-deck fire (wing turrets F/G/K/J) (p.135).

### 3.3 Construction choices (pp.37–44, primary, verified) — the option list

- **Armour abbreviations** (p.37): B, BU, BE, D, DE, T ("main gun turret and barbette
  armour"), TT ("roof of main gun turrets"), SEC, CT. "Armour values in the game are
  always in inches" (p.37). The same set appears again in the battle damage list (p.89,
  where T is "Turret" and TT "Turret top").
- **Armour schemes** (pp.38–39): **Protected cruiser** (sloping armour deck, no belt; the
  belt value = the sloping deck side; no upper belt); **Belt and sloping deck**
  ("standard WW1 era"); **Flat deck on top of belt**
  ("common on ironclad ships of the end of the 19th century"); **All or Nothing** (must
  be researched). The manual illustrates each with a side-scheme figure (the figure
  images are **UNVERIFIED** — not extractable as text; the prose descriptions are
  verified).
- **Narrow belt; Low freeboard; Cramped accommodation; Triple/quadruple turrets;**
  **Casemates; Turreted guns of smaller calibres** (pp.39–40).
- **Turret top armour** — assumed slightly sloped, so penetration is better against TT
  than against D; recommend TT slightly thicker than D (p.40).
- **Maximum armour** — belt up to 20 in (over 12 in gives diminishing protection); turret
  up to 26 in (p.40).
- **Fuel** — coal or oil; oil restricted to oilfield nations **before 1920** (p.41).
- **Engine type** — VTE initially; turbines ~**1904**; diesel; later gas turbines (p.41).
- **Engine priority** — speed-optimised (lighter, more breakdowns) vs reliability-
  optimised (heavier, fewer breakdowns) (p.41); the player-notes echo "optimize engines
  for reliability" for colonial/raider cruisers (pp.129–130).
- **Armour and splinter damage; Gun shields; Colonial service; Accommodation** (cramped/
  normal/spacious; spacious needed after **1955**) (pp.41–42).
- **Automatic loading; Dual-purpose guns; Light/medium AA; AA directors** (max 4)
  (pp.42–43).
- **Inclined belt; Box protection; All-forward armament; Diving shells; Oxygen
  torpedoes; Radar** (pp.44).

### 3.4 Era signals the manual states explicitly (primary, verified)

The manual's own scenario starts are **1890, 1900, 1920, 1935** (p.21) — there is **no
1880 start**, so every "in-era" judgement below for 1880 is an inference from "not gated
+ historically present", not a manual date. Explicit dating the manual does give:

| Feature | Manual statement | Page |
| --- | --- | --- |
| "Flat deck on top of belt" armour scheme | "common on ironclad ships of the **end of the 19th century**" | p.38 |
| "Belt and sloping deck" scheme | "the standard **WW1 era** armour configuration" | p.38 |
| "All or Nothing" scheme | "must be **researched** before it can be used" | p.39 |
| Casemate secondary mounting | "the usual method … in the **early part of the game**" | p.40 |
| VTE engines | "**Initially** ships will be powered by vertical triple expansion engines (VTE)" | p.41 |
| Turbines | "developed around **1904**" | p.41 |
| Oil firing | oilfield nations only "**before 1920**" | p.41 |
| Spacious accommodation | needed "**after 1955**" | p.42 |
| Light cruiser configuration | before it is researched, "all light cruisers must be built as protected cruisers" | p.38 |

### 3.5 Parity-bar classification (in-era 1880–99 vs later)

"Manual-backed" means the manual names the field/mechanic and does not gate it behind
later research/era. "In-era" combines that with the item being historically present in
1880–99 (inference; the manual's earliest start is 1890).

| # | Parity-bar item | Manual treatment (page) | In-era 1880–99? | Note |
| --- | --- | --- | --- | --- |
| 1 | **Turret side armour** | Field **T** = "main gun turret **and barbette** armour" (pp.37, 135); battle list "T Turret" (p.89) | **In-era** (manual-backed field; not dated) | Manual has **no separate "turret side"** value — T combines turret + barbette |
| 2 | **Turret roof armour** | Field **TT** = "roof of main gun turrets" (pp.37, 135) | **In-era** | Manual-backed, universal field |
| 3 | **Secondary/barbette armour** | Field **SEC** = secondary gun armour (pp.37, 135). Barbette is folded into **T**, not SEC | **In-era** (SEC) | No distinct "secondary barbette" region; barbette lives in T |
| 4 | **Deck-extended armour** | Field **DE** = "deck extended: corresponds to BE above" (pp.37, 89, 135) | **In-era** | Manual-backed, universal field |
| 5 | **Engine priority (Normal/Economy/Speed)** | Manual axis is **speed ↔ reliability** (p.41; pp.129–130) | **In-era** as a two-way choice | **Divergence:** no Normal/Economy/Speed triad; "Economy" is **not** a manual term |
| 6 | **Unit machinery** | **NOT FOUND** (searched "unit machinery"/"unit mach") | **UNVERIFIED** | Manual is silent; no grounding in-repo |
| 7 | **Per-mount gun quality** | "Gun quality: … gun quality **of that calibre** … given by your research and **cannot be changed**" (p.135) | Quality is in-era, but **per-calibre, not per-mount** | **Divergence:** not a per-mount input; it is a research-derived per-calibre property |
| 8 | **Fire-control positions** | Field "Fire control positions" = number of positions; redundancy; fragile (p.135) | **In-era** as a field (not dated) | Manual-backed; adopt manual term (plural) |
| 9 | **Freeboard as direct input/preset** | "**LOW FREEBOARD** … can be selected **for all ships**" (p.39) | **In-era** | It is a **low/normal preset toggle**, not a numeric direct input |
| 10 | **Tertiary-gun role** | Tertiary guns are a **count only**, no fire arcs, graphics decorative (p.28) | Present in-era as a count | **Divergence:** manual gives **no "role"** concept for tertiary guns |
| 11 | **Armour schemes (named + diagram)** | Four named schemes (pp.38–39); figures for each | **In-era scheme = "Flat deck on top of belt"** (p.38). Belt-and-sloping (WW1) and AoN (researched) are **later**; Protected cruiser is pre-CL era | Scheme **figures** are images → **UNVERIFIED** as text (prose is verified) |
| 12 | **"Suggest name" / class-name suggestion** | **NOT FOUND**. "Class name" is a field (p.134); names "assigned automatically" when ordering a batch (p.31) | **UNVERIFIED / absent** | No suggest-a-name feature named in the manual |

## 4. Recommendations

**Manual-backed for 1880–99 (safe to treat as in-era, citing the pages above):**
armour regions **B, BU, BE, D, DE, T, TT, SEC, CT** as universal designer fields
(pp.37, 135); **low/normal freeboard** as a preset toggle (p.39); the **"Flat deck on top
of belt"** armour scheme (p.38); **casemate** secondary mounting (p.40); **VTE** engine
type (p.41); **coal** fuel (p.41); a **speed↔reliability** engine-priority choice (p.41);
the **fire-control positions** count field (p.135); **per-calibre gun quality** as a
displayed, research-given value (p.135); **tertiary guns as a count** (p.28).

**Later / gated (do not present as 1880–99):** "Belt and sloping deck" (WW1, p.38); "All
or Nothing" (researched, p.39); light-cruiser configuration (p.38); oil firing (pre-1920
oilfield-only, p.41); turbines (~1904, p.41); spacious accommodation (after 1955, p.42);
and the AA/radar/missile-age items (pp.42–44).

**Glossary terms worth adopting verbatim:** `Belt`, `Upper belt (BU)`, `Belt extended
(BE)`, `Deck (D)`, `Deck extended (DE)`, `Turret (T, incl. barbette)`, `Turret top (TT)`,
`Secondary gun armour (SEC)`, `Conning tower (CT)`, `Belt coverage` (narrow belt),
`Topside points`, `Fire control positions`, `Gun quality` (per-calibre, research-given),
`Engine priority` (speed vs reliability), `Flat deck on top of belt`, `Belt and sloping
deck`, `All or Nothing`, `Protected cruiser`, `Low freeboard`, `Casemate`, `Colonial
service`, `Cramped/Normal/Spacious accommodation`. Note the manual's imperial units
(inches for armour/calibre, yards for range, p.18; armour always inches, p.37).

**Must remain BALANCE TARGET (non-normative; no source states a number):** any magnitude
we attach to these fields — armour-thickness bands, freeboard weight savings, engine-
priority weights/breakdown probabilities, topside-point budgets, fire-control-position
counts. Per ADR-0213 these are balance choices, never presented as sourced facts.

## 5. Gaps and UNVERIFIED

1. **Unit machinery** — the term does not appear anywhere in the manual (searched). No
   in-repo grounding; needs another source or a decision-request if the feature is
   required.
2. **"Suggest name" / class-name suggestion** — no such feature is named. The manual has
   a Class name field (p.134) and auto-assigns names to batch-ordered ships (p.31), but
   nothing that suggests/pencils a name for an empty class.
3. **Per-mount gun quality** — the manual's **Gun quality is per-calibre and fixed by
   research** (p.135), not a per-mount editable value. A per-mount quality model
   diverges from the manual and needs an explicit accepted decision.
4. **Engine-priority taxonomy** — the manual offers a **two-way speed/reliability**
   choice (p.41), not **Normal/Economy/Speed**. The "Economy" label is unsourced here.
5. **Tertiary-gun "role"** — the manual models tertiary guns only as a number with
   bearing-based fraction firing (p.28); there is no tertiary "role" concept.
6. **Armour-scheme diagrams** — prose for all four schemes is verified, but the scheme
   **figures** are embedded images and were not readable as extracted text; only the
   prose is cited.
7. **No 1880 scenario in the manual** — the earliest start is 1890 (p.21); every "in-era"
   call that is not explicitly dated by the manual is an inference from "not gated +
   historically present", and is labelled as such above.

## 6. Deferred

- If **unit machinery** and **per-mount gun quality** are genuine parity requirements,
  they need either a grounded source or a recorded decision (ADR/decision-request) —
  the manual cannot back them.
- The **Normal/Economy/Speed** engine-priority naming and the **tertiary-gun role**
  concept likewise need an owner to confirm the intended taxonomy against the manual's
  speed/reliability and count-only models.
- Any numeric values chosen for the in-era fields are a design/balance decision for the
  map #152 effort, not from this note.
