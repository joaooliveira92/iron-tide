# N-2: 1880 small-armoured hull classification and era bands

Status: new research note, created 2026-10-17 for the N-2 "1880 content completion"
effort (wayfinder research ticket #27). It grounds the era's armoured-ship taxonomy
and the band that lets the seven opening-era small armoured hulls classify, so the
classifier's 1880 handling is a citable abstraction rather than an invented floor.

## 1. Question

What hull families and displacement / armour / gun bands did the 1880 navies actually
use for armoured ships — central-battery ships, monitors, coast-defence ships, and
small ironclads — and how should the Bluewave ship-type classifier treat the
opening-era small armoured hulls?

Specifically: seven 1880 designs throw `INVALID_SHIP_TYPE` because they fall below
`packages/combat/src/tactical/shipType.ts` `HULL_FAMILY_MAP`'s "B"-family floors
(`minDisplacementKg: 5_000_000`, `minArmorUm: 6*UM_PER_INCH = 152_400`,
`minCaliberUm: 6in`, `maxSpeedUms: 20 kn`). This note supplies their historical
figures and a recommended band.

## 2. Sources and method

- **Primary (in-repo, directly verified):** `docs/Rule the Waves 3 Manual EBOOK.pdf`
  (the RTW3 game manual, 148 pages). Text extracted page-by-page with `pypdf` 6.14.2.
  Page numbers are the manual's printed page numbers, which match the PDF page index
  in these ranges (see `docs/research/rtw3-manual-baseline.md`, "Source and method").
  The defining passage is **Appendix 1 ("Ship type definitions used by the game"),
  pp.131–134**, extracted and read directly for this note.
- **Primary (in-repo, directly verified):** `content/production/1880/ship-building/balance.ts`
  (`ship.classification`, version 2); `packages/ship-design/src/classificationRules.ts`
  (`DESIGN_22_EARLY`); `packages/combat/src/tactical/shipType.ts`; `content/production/1880/designs.ts`.
- **Secondary (web, reputable, **not** read in the original):** Conway's *All the
  World's Fighting Ships 1860–1905* (Chesneau & Kolesnik, 1979) as quoted/cited by the
  individual ship references below, plus navypedia and Wikipedia. These are flagged as
  secondary throughout. Where Wikipedia itself cites Conway's, that is noted; the
  original Conway's page was not consulted, so every web figure below is
  **secondary and unverified against the book**.

Authority: per ADR-0210 the manual is authority order 3 — authoritative for mechanics
and terminology. Per ADR-0213 magnitudes that no source states are balance choices,
never presented as sourced facts.

## 3. Findings

### 3.1 The manual's own ship-type taxonomy (primary, directly verified)

Appendix 1, pp.131–134, gives the game's *legal* type definitions. The armoured-ship
entries are, verbatim in substance:

| Manual type | Definition (manual pp.) |
| --- | --- |
| **PREDREADNOUGHT BATTLESHIP (B)** | displacement **at least 5000** [tons]; belt armour **at least 6 in**; main gun calibre **larger than 6 in**; speed **less than 20 knots**; **no more than 2 main turrets** (p.132) |
| **ARMOURED CRUISER (CA)** | displacement **more than 4000**, speed **greater than 19 kn**, belt **over 2 in and up to 12 in**, main guns **at least 6 in and no more than 11 in** (p.132) |
| **DREADNOUGHT BATTLESHIP (BB)** | **at least 3 main gun turrets**, displacement **over 8000**, belt **over 6 in**, main guns **more than 10 in** (p.133) |
| **CORVETTE (KE)** | displacement **less than 2500**, belt **2 in or less**, gun calibre **max 6 in**, **no torpedoes** (p.133) |

The manual states: "Anything falling outside these parameters is considered an illegal
ship type" (p.131). The battle prefix list (p.78) confirms the same set — `B` is
"Pre-dreadnought Battleship"; there is **no** monitor, coast-defence, central-battery,
or turret-ship prefix.

**Consequence:** the classifier's hardcoded B floors (`5_000_000 kg`, `152_400 µm`,
`6 in`, `20 kn`) are an *exact* transcription of the manual's pre-dreadnought (B)
definition, and `DESIGN_22_EARLY`'s `bMinDisplacementKg`/`bBeltMinUm`/`bMaxSpeedUms`
match it too. That definition is RTW3's *pre-dreadnought* rule (an 1890s+ ship), not
an 1880 ironclad rule.

### 3.2 What the manual does not supply

The manual has **no type definition for the 1860s–80s small armoured hulls**. Monitors,
coast-defence ships, central-battery (casemate) ironclads and turret ships appear only
as prose in the armour-scheme section: "This armour configuration was common on
ironclad ships of the end of the 19th century" (Flat deck on top of belt, p.38). The
manual is silent on their displacement/armour bands. Under the literal manual rule
these sub-5000-ton, sub-6-inch-belt armoured ships are simply **illegal** — a gap, not
a citable band. This is the central contradiction (see §5).

### 3.3 Historical 1880 armoured-ship taxonomy and bands

Descriptive bands reconstructed from the seven ships in `designs.ts` plus the wider
type literature. All displacement figures below are **secondary** (Conway's-derived web
references); armour values are amidships/max belt unless stated. "Uncertainty" is
recorded where sources disagree.

**Type-level ranges (secondary; ranges are descriptive, not source-stated thresholds
except where noted):**

| Hull family | Typical displacement | Typical belt armour | Source / note |
| --- | --- | --- | --- |
| Coast-defence ship | **~1,500–8,000 t** | ~3–8 in | Wikipedia "Coastal defence ship", which states the 1,500–8,000 t span and cites Conway's 1860–1905 (secondary; the range *is* stated by that source) |
| Monitor (harbour / breastwork) | ~1,000–5,000 t | 5–9 in belt; 9–11.5 in turret | e.g. Cerberus 3,344 t, Cyclops 3,480 t, Glatton 4,912 t (Wikipedia "List of breastwork monitors of the Royal Navy", citing Conway's; secondary) |
| Central-battery ironclad — small/colonial | ~1,500–4,000 t | ~4–9 in | Brasil 1,518 t, Fusō 3,717 t, Vasco da Gama 2,384 t (below) |
| Central-battery ironclad — first-class | ~6,000–10,000 t | up to ~9 in | e.g. HMS Alexandra (designs.ts: 9,500 t, 305 mm) |
| Turret ship (ocean-going) | ~9,000–12,000 t | 12–14 in | Devastation 9,330 t belt 12 in; Dreadnought (1875) 10,886 t belt 14 in (naval-history.net class list, secondary) |
| Small colonial ironclad / armoured corvette | ~1,500–3,500 t | ~3.5–8 in | Brasil, Schorpioen/Buffel, Cerberus-type colonial monitors |

**The seven hulls in `designs.ts` (per-figure provenance):**

| Design | `hullType` | Displacement (kg / t) | Belt (mm / in) | Main gun (mm) | Source for the figure (secondary) |
| --- | --- | --- | --- | --- | --- |
| `des_usa_amphitrite` | monitor | 4,000,000 / 4,000 | 229 / 9.0 | 254 | NHHC DANFS & hazegray: 3,990 long tons, 9-in side/belt; Wikipedia/Conway's give belt **7–5 in (180–130 mm)** → **range 5–9 in, uncertainty flagged** |
| `des_jpn_fuso` | central_battery | 3,720,000 / 3,720 | 230 / 9.1 | 240 | navypedia & Wikipedia: 3,717 t; belt 229 mm amidships tapering to 114–163 mm (6.4–9 in) |
| `des_nld_schorpioen` | coast_defense | 2,175,000 / 2,175 | 152 / 6.0 | 230 | navypedia & Wikipedia: 2,140–2,175 long tons; belt 3–6 in (76–152 mm) |
| `des_nld_buffel` | coast_defense | 2,130,000 / 2,130 | 152 / 6.0 | 230 | Wikipedia "Buffel-class monitor": 2,198 long tons; belt 3–6 in (76–152 mm) |
| `des_por_vasco_da_gama` | central_battery | 3,017,000 / 3,017 | 229 / 9.0 | 260 | Wikipedia: 2,384 t as built, 2,972 t after 1901–03 rebuild; belt 4–9 in (100–230 mm). The YAML figure (3,017 t) is between the two fits — **estimate, not a single source figure** |
| `des_bra_brasil` | central_battery | 1,516,000 / 1,516 | 114 / 4.5 | 203 | Wikipedia "Brazilian ironclad Brasil": 1,518 t; belt 90–114 mm (3.5–4.5 in); casemate 102 mm. Called an "armoured corvette" / central-battery ironclad |
| `des_esp_numancia` | central_battery | 7,017,000 / 7,017 | 130 / 5.1 | 203 | Wikipedia & naval-encyclopedia: 7,305 t; belt 100–130 mm (3.9–5.1 in). Built as a broadside ironclad frigate; the YAML's "central_battery" label is a later refit classification |

Two pattern observations that matter for the classifier:

1. **The belt is authored at the amidships maximum.** For six of the seven the YAML belt
   equals the thickest point of a tapering belt (Fusō 9 in, Schorpioen/Buffel 6 in, Vasco
   9 in, Brasil 4.5 in, Numancia 5.1 in). The single exception is Amphitrite, where the
   YAML uses the 9-in upper figure; a Conway's-derived source gives 7–5 in — see §5.
2. **The seven span 1,516 t to 7,017 t and 4.5 in to 9 in belts.** The binding minima are
   `des_bra_brasil` (1,516 t / 114 mm) and `des_esp_numancia` (130 mm belt); no other ship
   is near those floors.

### 3.4 What the codebase already does (directly verified)

The DESIGN-22 design-side classifier is **already** parameterised for the 1880 opening:

- `DESIGN_22_EARLY` (`classificationRules.ts:92-129`) is version 1 and mirrors the manual
  exactly (`bMinDisplacementKg: 5_000_000`, `bBeltMinUm: 152_400`, `bMaxSpeedUms: 20 kn`).
- `content/production/1880/ship-building/balance.ts:234-279` authors a **version-2
  ruleset** (ADR-0116) with exactly three changes, with an in-file rationale:
  `bMinDisplacementKg 5,000 t → 1,500 t` (`1500000`); `bBeltMinUm 6 in → 4 in`
  (`101600`); `bMaxSpeedUms 20 kn → 18 kn` (`9259992`). Its comment says this "only ever
  ADMITS ships the canonical EARLY band rejected".
- Checked against the seven hulls, that v2 band admits **all seven** as B (displacement
  ≥1.5 M kg, belt ≥101,600 µm, gun >152,400 µm, speed <18 kn).

The **combat-side** classifier (`packages/combat/src/tactical/shipType.ts`) hardcodes the
v1 floors per `HULL_FAMILY_MAP` entry and does **not** read the scenario ruleset. Its own
comment (`:82-83`) says the numeric guards are a "secondary guard" and "the designer's own
validator is the authority and has already run" — so the hardcoded floors are a duplicated,
stale copy of v1, not an independent rule.

## 4. Recommendations

**Recommended EARLY (1880) band for the four opening-era armoured hull families**
(`monitor`, `coast_defense_ship`, `central_battery_ship`, `ironclad_turret_ship`), in
classifier units:

| Guard | Design-22 v1 (manual pre-dreadnought) | Recommended EARLY band | In µm / kg |
| --- | --- | --- | --- |
| `minDisplacementKg` | 5,000,000 | **1,500,000** | = 1,500 t |
| `minArmorUm` (belt) | 152,400 (6 in) | **101,600** | = 4.0 in |
| `minCaliberUm` | 152,400 (6 in) | **152,400** (unchanged) | = 6 in |
| `maxSpeedUms` | 10,288,880 (20 kn) | 10,288,880 (20 kn), or **9,259,992 (18 kn)** to match the v2 ruleset | — |

This is the same band already authored in `balance.ts` classification v2; the
recommendation is that the combat classifier **align to it** rather than re-derive a
second set of floors. Only the displacement and belt floors are needed to admit the
seven; the 18-kn speed cap is needed only for consistency with the design-side v2
ruleset (the seven are 6–7 kn, so speed is not their blocker).

Notes on the choice:

- A 4-in belt floor cleanly separates these hulls from protected cruisers (belt ≤2 in)
  and corvettes (`keBeltMaxUm: 2 in`), while admitting Brasil's 4.5 in / 114 mm — the
  thinnest armoured hull in the set. A 4.5-in floor would exclude Brasil; a 5-in floor
  would exclude Numancia (130 mm = 5.12 in).
- The 1,500 t floor admits Brasil at 1,516 t with only 16 t of margin. If a future
  content revision changes Brasil, the floor would need revisiting; alternatively choose
  1,400,000 kg for margin. **1,500 t is the value the scenario already uses.**
- Historical grounding: the *direction* (small 1880 armoured hulls are capital-type
  coast-defence/casemate/monitor ships down to ~1,500 t and belts down to ~4 in) is
  citable history (§3.3). The **exact** floors (1,500 t, 4.0 in, 18 kn) are **not stated
  by any source** — they are an **admitted design/balance choice**, consistent with
  ADR-0213. They should carry `kind: balance_adjustment` / `sourceStatus: BALANCE_TARGET`
  provenance and must never be presented as a sourced fact.

**Not recommended:** lowering the canonical `pre_dreadnought` (B) floors to 1,500 t / 4 in
globally. The scenario override is scoped to the 1880 scenario; `pre_dreadnought` remains
the manual's 1890s pre-dreadnought rule, and `DESIGN_22_EARLY` deliberately mirrors the
manual.

## 5. Contradictions and unsourced values

1. **The manual contradicts the seven hulls.** Appendix 1 (p.132) requires B ships to be
   ≥5,000 t with ≥6 in belt and ≤2 main turrets; six of the seven are below 5,000 t and
   three (Brasil 4.5 in, Numancia 5.1 in, Schorpioen/Buffel 5.98 in) are below a 6-in
   belt, and Fusō has four main-gun mounts. Under RTW3's literal rule these are "illegal
   ship types" (p.131). **Bluewave's divergence is intentional and already accepted**:
   the ship designer adds the opening-era families (ADR-0088), and the scenario lowers the
   B floors (ADR-0116 v2). The manual cannot be cited for a band that admits them.
2. **`minCaliberUm: 6 in` is inclusive in the combat classifier but exclusive in the
   manual and DESIGN-22.** `classifyShip` rejects only `caliberUm < 152400`, so a ship with
   exactly a 6.00-in main gun passes B; the manual says B needs calibre "larger than 6
   inches" and `classificationRules.ts:307` enforces `> 6 in`. No 1880 hull is affected
   (all seven are 203–260 mm), but it is a real inconsistency between the two classifiers.
3. **Numancia's `hullType` is `central_battery_ship` but she was built as a broadside
   ironclad frigate** (Wikipedia, naval-encyclopedia; secondary). The hull family is an
   authored retro-fit label, not an as-built fact.
4. **Amphitrite's belt is uncertain.** The YAML uses 229 mm (9 in). NHHC DANFS/hazegray
   give a 9-in side/belt; the Amphitrite-class Wikipedia article (citing Conway's) gives
   **7 in amidships tapering to 5 in**, with 11.5-in turrets. The discrepancy is a known
   ambiguity between "waterline belt" and "side armour"; flagged, not resolved.
5. **Vasco da Gama's displacement is uncertain.** The YAML's 3,017 t sits between the
   as-built 2,384 t and the post-1901-rebuild 2,972 t (Wikipedia; secondary). The
   `designs.ts` entry already carries `sourceStatus: ESTIMATE`.
6. **`docs/rules/ship-classification.md` does not exist** in the tree, though
   `classificationRules.ts:38` names it as the home of the "Normative thresholds". The
   normative boundaries currently live only in code (`DESIGN_22_EARLY`) and the scenario
   `balance.ts`; there is no prose authority to amend.
7. **No source states a monitor/coast-defence/central-battery band.** Only the
   coast-defence 1,500–8,000 t span is explicitly stated (Wikipedia, citing Conway's;
   secondary). Every other per-type range in §3.3 is a descriptive envelope assembled
   from individual ship figures of this note and is **not** a citable threshold.

## 6. Deferred

- Aligning the combat classifier to the scenario ruleset is an implementation decision for
  the N-2 effort; this note recommends the band but does not change code.
- Author of `docs/rules/ship-classification.md` (missing): needs an owner if the project
  wants a prose normative source for the boundaries (currently code + `balance.ts`).
- If a future source is found that states a first-class vs small colonial-ironclad
  displacement/armour boundary explicitly, the descriptive envelopes in §3.3 should be
  replaced with a citation.
