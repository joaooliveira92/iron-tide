# RTW3 prestige values

Status: new research note, created 2026-10-17 by the N-1 ticket-07 research pass.
Extends `docs/research/rtw3-manual-baseline.md`; it does not rewrite it.

## Resolution (2026-10-19)

The unresolved values below were decided by the owner's delegation in
ADR-0239 (decision request 0012,
Option B). Grounded values here are used as sourced; the rest are labelled Bluewave
balance decisions there. The statements below describe the research as it stood and are
kept unchanged as provenance.

## Scope and authority

- **Decision 0003-B authorizes research only.** The owner chose Option B
  ("research against high-trust external sources before authoring production
  prestige values") and recorded it in
  ADR-0225.
  This note is the research product of that decision.
- **No production values are committed here.** Nothing in this note is a
  production content value, a ruleset value, a fixture, or a placeholder. No
  code, test, golden, or content file was changed by this pass.
- **No value in this note is authorized for production** until (a) its provenance
  is explicit and (b) the owner authorizes S-2 ticket 08. Values that could not be
  grounded, or that sources contradict, are returned to the owner individually in
  the [Unresolved and contradictory values](#unresolved-and-contradictory-values)
  section.
- Decision 0003-B forbids substituting a Bluewave calibration, fixture value,
  placeholder, inferred value, or undocumented approximation. Where no source
  exists, this note says **unresolved** rather than inventing a value.

## Method and access

| Source | Type | Access | Directly verified? |
| --- | --- | --- | --- |
| RTW3 game manual (PDF in repo) | Official manual | Local file, text extracted with `pypdf` 6.14.2 | Yes — pages read in full |
| Official Steam announcements / patch notes (NWS/Matrix) | Official developer statements | Steam Web API `ISteamNews/GetNewsForApp` (appid 2008100), 49 items | Yes — full text searched |
| RTW3 save files (`.bcs`) | Reverse-engineered observation | Raw files from GitHub, parsed locally | Yes — sections parsed |
| Privateer save editor source/docs | Reverse-engineered observation (tooling) | Raw files from GitHub | Yes |
| Matrix Games forums (RTW3 sub-forums) | Community observation | `forums.matrixgames.com` search + threads | Yes — threads read |
| Steam Community discussions | Community observation | `steamcommunity.com` threads | Yes |
| NWS official forums (`nws-online.proboards.com`) | Official developer forum | Board index reachable; search endpoint is POST-only and returned no result list to this fetcher | Partially — no value taken |
| DuckDuckGo, Google, Bing, Brave, Ecosia, Startpage, Reddit, Yandex | General web search | Bot-blocked, CAPTCHA, or degraded (Bing returned unrelated dictionary results for exact-phrase queries) | No — could not use |

Notes on the web search failures are recorded so a later pass does not assume the
sources above are exhaustive.

## Provenance classes used

Every value below carries exactly one of:

- **documented RTW3** — official manual, official patch notes, developer statement.
- **historical analogue** — real 1880s history used as a stand-in (none recorded here).
- **community observation** — forums, wikis, community guides.
- **reverse-engineered observation** — game data/save files or observable in-game behaviour.
- **Bluewave balance decision** — an explicitly admitted design choice, NOT a source.

An inference is never presented as a source. Single-player anecdotes are marked
as such and are not treated as authoritative.

---

## Q1 — Prestige scale and bounds

**Question.** Is prestige an integer? What are its minimum and maximum possible
values?

| Proposed | Class | Citation | Confidence | Status |
| --- | --- | --- | --- | --- |
| Prestige is stored as a **plain integer**, one value per nation | reverse-engineered observation | RTW3 1.01.44 save files, `[NationN]` section, key `Prestige=<int>` (e.g. `Prestige=20`). Privateer reads/writes it as an integer: `privateer/save.py`, `set_admiral(...)`. | High | resolved |
| The **lower threshold is 16**: at or below 16 the player risks being sacked | documented RTW3 | Manual p.62: "If your prestige goes too low (16 or below), you run a risk of being sacked, thus losing the game." Corroborated by community observation (Steam, below) | High | resolved |
| A fresh campaign starts every nation at **20** | reverse-engineered observation | Three independent fresh saves: `themindfulbit/RTW3Saves` "US 1900 Start (New Format)" and "(Old Format)" (Year 1900 Month 1 Day 1); `JakeKen25/Privateer` `Game5/RTWGame5.bcs` (Year 1900 Month 1 Day 1); `Game4/RTWGame4.bcs` (Year 1935 Month 1 Day 1). All AI nations show `Prestige=20`. | Medium-high for AI nations | resolved (see anomaly) |
| The **maximum is unknown**; observed careers reach at least **302** | community observation | Matrix Games, "Admiral Mode (AI+)" AAR (EvanJones, 2024): final scores 202, 214, 217, 218, 232, 233, 241, 302. No cap is documented or observed. | Medium (values are anecdotes) | unresolved (upper bound) |
| The **absolute minimum of the stored field is unknown** | — | No manual or observed floor. The player is sacked at ≤16, which ends the game, so values below the threshold are rarely retained. | — | unresolved |
| Prestige is **integer-valued in play** | community observation + reverse-engineered | Community quotes are all whole numbers ("42 Prestige", "232", "only 15 prestige left"); the save field is an integer. | High | resolved |

**Contradiction / anomaly.** In both "US 1900 Start" saves the **player** nation
(`Nation0`, USA) shows `Prestige=19`, while every AI nation shows `20`. In the
Privateer `Game5` 1900-start save the **player** nation (Austria-Hungary,
`Nation0`) shows `20`. So a fresh start is *usually* 20, but at least one
fresh-start save has the player at 19. This is a one-point discrepancy; it may be
a start-specific event, a mod effect, or a first-turn adjustment. It is recorded
here, not resolved.

**Distinction from "victory points".** The manual uses two different things: the
battle **victory points (VP)** tracked in a war, and **prestige** (the career
currency). Manual p.67: "Declining a battle will cost victory points, and may
cost prestige after several declined battles." They must not be conflated.

## Q2 — Per-nation 1880 starting prestige (or RTW3's rule)

**Question.** What are the per-nation 1880 starting values, or by what rule does
RTW3 set them?

| Proposed | Class | Citation | Confidence | Status |
| --- | --- | --- | --- | --- |
| **RTW3 has no 1880 start.** The manual's starts are 1890, 1900, 1920, 1935 | documented RTW3 | Manual p.21; confirmed in `docs/research/rtw3-manual-baseline.md`. Bluewave's 1880-only start is a deliberate divergence (ADR-0201) | High | resolved (as an absence) |
| Therefore **RTW3 provides no per-nation 1880 prestige values** | documented absence | No 1880 scenario exists in RTW3; there is nothing to observe for 1880 | High | resolved (as an absence) |
| RTW3's apparent rule is **flat 20 for every nation at any start** (no per-nation variation observed) | reverse-engineered observation | 1900 start (both RTW3Saves variants): GB/Germany/France/Russia/Japan/Italy/Spain/A-H/China all `20`; 1935 start (Privateer Game4): all `20`; 1900 start (Privateer Game5): all `20` | Medium-high | resolved for RTW3's rule |
| AI nations do store a prestige value, but it is **not displayed to the player** | reverse-engineered observation + community observation | Save files store `Prestige` for every nation; Matrix Games "Victory Conditions" (CaptBeefheart, 2023-08-23): "I couldn't find the prestige levels of any of the other countries." | Medium-high | resolved (display behaviour) |
| Whether AI prestige values **change or matter at all** in RTW3 | — | No source found. The stored AI value is constant 20 across the fresh saves examined | — | unresolved |
| **Bluewave's 1880 per-nation values** | **Bluewave balance decision** (if adopted) | Bluewave's nation set is 14 nations (`content/production/1880/countries.ts`: uk, germany, usa, japan, france, italy, russia, austria_hungary, spain, qing, ottoman_empire, netherlands, portugal, brazil). RTW3 has only ten (GB, Germany, France, A-H, Russia, Italy, Japan, China, Spain, USA). Five Bluewave nations (ottoman_empire, netherlands, portugal, brazil, and a 1880-context `qing`) have **no RTW3 counterpart at all** | — | unresolved — owner decision required |

**Consequence.** If Bluewave mirrors RTW3, the only citable RTW3 rule is "every
nation starts at 20". That rule is a *reverse-engineered observation*, not a
manual fact. Any per-nation differentiation in 1880, and any value for the five
Bluewave-only nations, has no RTW3 source and would be a Bluewave balance
decision (ADR-0213 pattern) — which decision 0003-B does not authorize without
the owner.

## Q3 — Loss fractions by source

The manual documents the **sources** of prestige loss and the fact that loss is
"in most cases proportional", but gives **no fractions**. Community observations
give a few single-player data points, marked as such.

| Source | Rule (class + citation) | Observed magnitude | Class | Status |
| --- | --- | --- | --- | --- |
| **Naval defeat** | "lowered by … defeats"; "Prestige loss is in most cases proportional" — documented RTW3, manual pp.12, 61–62 | Minor defeat ≈ **−10** at ~195 prestige (EvanJones, A-H AAR, 2024); "if I get beat bad, I'd lose **20**" at high prestige; early-war losses **1–2** at low prestige (same author) | community observation (single player) | partially resolved — direction + proportionality documented; no fraction |
| **Losing capital ships** | "Cautious: … Player risks extra prestige loss on losing battles or losing capital ships" — documented RTW3, manual p.59 | "I got nailed very early by losing a weak B … it was only a **1 or 2** prestige loss" (EvanJones) | community observation | partially resolved |
| **"Soft"/doveish event answers** | "Doveish answers … risks lowering your prestige and/or the naval budget" — documented RTW3, manual p.61 | One worked example: **−1** for holding on to a colony in the independence event (Matrix Games, "1.0.84: Granting independence is all backwards", mrchuck, 2025-05-29) | community observation | partially resolved — no general fraction |
| **Running out of funds** | "Running out of funds … will tend to … lower your prestige" — documented RTW3, manual p.13 | None found | — | unresolved (no magnitude) |
| **Missing naval presence** | "If the required number is not met, player prestige may suffer" — documented RTW3, manual p.46 | Community notes keeping minimum ships "so my Prestige didn't collapse" (Matrix Games, v1.00.81 beta thread, Vermin, 2025) | community observation (qualitative) | unresolved (no magnitude) |
| **Officer removal / hurrying a promotion** | "officers can be removed from a command at the cost of some prestige"; manual promotion ahead of time "costs prestige" — documented RTW3, manual p.58. Patch note: "manually promote the senior officer of a rank for free (no prestige cost), You can only do this once per turn" — documented RTW3, Steam "Update v01.00.37" (2024-02-26) | None found | — | unresolved (no magnitude) |
| **Declined battles** | "Declining a battle will cost victory points, and may cost prestige after several declined battles" — documented RTW3, manual p.67. Patch note: "Victory Point losses for declining battles distant from your home port have been greatly reduced" (VP, not prestige) — documented RTW3, Steam "Update v01.00.37" | None found for the prestige component | — | unresolved (no magnitude) |
| **Unmet trade protection** | "your prestige may suffer" — documented RTW3, manual p.71 | None found | — | unresolved (no magnitude) |
| **"Cautious" nation penalty** | "Player risks extra prestige loss on losing battles or losing capital ships" — documented RTW3, manual p.59 | Removing the Caution trait costs **10% of current prestige** (EvanJones: "there comes a point where one is not willing to sacrifice 10% of prestige") | community observation | partially resolved (buy-off cost, not the loss penalty) |
| **Blockade / war weariness events** | Manual does not name blockade directly; community reports it | "sacked with only **15** prestige left" after a long blockade (Steam, "Prestige loss during blockade", Chris35, 2023-06-12) | community observation | unresolved (no fraction) |

**Proportionality.** The strongest quantitative hint is the pair of single-player
statements that the *same class* of loss costs 1–2 early and ~10–20 at high
prestige. That is consistent with the manual's "in most cases proportional" rule
but does not establish a formula. No per-source fraction is documented or
reliably observed.

## Q4 — Gain magnitudes by source

| Source | Rule (class + citation) | Observed magnitude | Class | Status |
| --- | --- | --- | --- | --- |
| **Naval victories** | "enhanced by naval victories" — documented RTW3, manual p.12 | Community reports gains of **+1 to +2** per battle: "We got **two** prestige for our stunning victory" (Matrix Games, "Where the !@#$ are you guys going?", mrchuck, 2025); "+1 Prestige" per battle, "3 prestige battles", "6 prestige victories", "13 prestige victories" (EvanJones, Admiral Mode AAR, 2024) | community observation | partially resolved — direction documented; magnitude only from anecdotes |
| **Gain appears capped per battle regardless of decisiveness** | Not documented | "Why is the gain never more than 1 or 2 even after a heroic victory?" (Matrix Games, "Suggested re-work of prestige and morale", mrchuck, 2024-11-12) | community observation | unresolved (contradicts any "proportional gain" reading) |
| **"Tough"/hawkish event answers** | "Hawkish answers will tend to raise the budget and your prestige" — documented RTW3, manual p.61 | One worked example: **+1** for granting a colony independence in the independence event (Matrix Games, mrchuck, 2025-05-29) | community observation | partially resolved — no general magnitude |
| **End-of-war reparations vs colonies** | Not documented as prestige | Community treats "reparations" as an economy gain, not prestige; colonies are described as "prestige" (EvanJones) | community observation | unresolved |

## Q5 — Monthly sacking probability below the threshold

| Proposed | Class | Citation | Confidence | Status |
| --- | --- | --- | --- | --- |
| There **is** a per-turn/monthly sacking risk at prestige ≤16 | documented RTW3 | Manual p.62: "If your prestige goes too low (16 or below), you run a risk of being sacked, thus losing the game." | High | resolved (existence) |
| The **probability value or formula** | — | Not in the manual; not in official patch notes; not in the save format (no sacking-probability field is stored); no community or reverse-engineered figure found | — | **unresolved** |
| The risk is not an immediate, deterministic sack at 16 (players survive turns at/near the threshold) | community observation | Steam, "Prestige loss during blockade" (2023): a player was "sacked with only 15 prestige left"; Steam, "Why did i get sacked…" (2023): sacking at ≤16. Manual's "risk" wording supports non-determinism | Medium | partially resolved (non-deterministic) |

This is the single largest gap. It cannot be sourced from the manual, the save
files, official patch notes, or any community/reverse-engineered source found in
this pass.

## Q6 — Final-score rule (end-of-career prestige → Hall of Fame)

| Proposed | Class | Citation | Confidence | Status |
| --- | --- | --- | --- | --- |
| End-of-career prestige **is** the career score, saved to a Hall of Fame | documented RTW3 | Manual p.62: "Prestige is also used at the end of the game as a kind of 'victory points' system to evaluate your career as head of the Navy." Manual p.12: "your prestige at the end of the game will be saved in a naval 'Hall of Fame'." | High | resolved (the rule) |
| The score is the **final prestige value itself** (no separate conversion observed) | community observation | Matrix Games, "Admiral Mode (AI+)" AAR (EvanJones, 2024): "I am now trying to push my previous Germany game (214 prestige) off the Hall of Fame. If I make 217, I push Italy off the bottom"; final scores reported as "Final Score: 302 Prestige", "Final score (China): … 241 Prestige" | Medium | partially resolved |
| The Hall of Fame is **ranked by final prestige** (a worst/bottom entry exists) | community observation | Same source ("push Italy off the bottom") | Medium | partially resolved |
| Any **formula, scale, or victory-points conversion** beyond "final prestige" | — | Not documented; not observable in the save format (the `.bcs`, `.sta`, and `.off` files contain no score/Hall-of-Fame field) | — | **unresolved** |

---

## Unresolved and contradictory values

These are returned to the owner individually, per decision 0003-B. None may be
used until the owner decides.

1. **Upper bound of prestige** — no documented maximum; community careers reach
   302. Unresolved.
2. **Lower bound of the stored field** — no documented minimum; the game ends at
   ≤16. Unresolved.
3. **The player's fresh-start value** — 20 in most fresh saves, but **19** for the
   player in both "US 1900 Start" saves. Contradictory; unresolved.
4. **Whether AI-nation prestige values are live** — stored but hidden; observed
   constant at 20. Unresolved.
5. **Per-nation 1880 starting values** — RTW3 has no 1880 start, so no RTW3 values
   exist. Any differentiation, and all values for the five Bluewave-only nations
   (ottoman_empire, netherlands, portugal, brazil, 1880 `qing`), require an owner
   decision (Bluewave balance decision) or acceptance of the flat-20 rule.
6. **Per-source loss fractions** — the manual documents the sources and
   proportionality but no fraction. Only single-player anecdotes exist
   (defeat ≈ −10 at ~195; bad defeat ≈ −20; early capital-ship loss 1–2;
   soft event answer −1; Caution buy-off = 10% of prestige). Unresolved.
7. **Per-source gain magnitudes** — community reports +1 to +2 per battle and a
   possible per-battle cap; no documented magnitude. Unresolved.
8. **Monthly sacking probability at ≤16** — entirely unsourced. Unresolved.
9. **Final-score formula** — "final prestige" is documented as the score, but any
   conversion, scale, or Hall-of-Fame computation is unsourced. Unresolved.
10. **"Victory points" vs "prestige"** — the manual uses both terms; the battle VP
    system and the career prestige system are distinct, but no source fully
    specifies their interaction. Partially contradictory; flagged.

## Sources (full citations)

- **RTW3 manual** — *Rule the Waves 3 Manual EBOOK*, Naval Warfare Simulations /
  Matrix Games, 2023. Local file `docs/Rule the Waves 3 Manual EBOOK.pdf`;
  pages 12, 13, 46, 58, 59, 61, 62, 67, 71 read in full. Directly verified.
- **Steam official announcements** (developer/publisher patch notes), appid
  2008100, retrieved via `ISteamNews/GetNewsForApp` (2026-10-17):
  - "Rule the Waves 3 - Update v01.00.37", 2024-02-26 —
    "It is now possible to manually promote the senior officer of a rank for free
    (no prestige cost), You can only do this once per turn."
    "Victory Point losses for declining battles distant from your home port have
    been greatly reduced."
  - "Rule the Waves 3 - Update + Dev Diary", 2024-05-10 — "The game lets you do
    so, but at a cost of prestige …"; "Dissolving a division with a commander will
    no longer cost prestige."
  - "Rule the Waves 3 - The Admiral Update", 2023-11-29 — "With an intelligence
    coup you can even decline battle without the normal victory point penalty."
- **Save files (reverse-engineered):**
  - `themindfulbit/RTW3Saves` (GitHub), "US 1900 Start (New Format)/RTWGame9.bcs"
    and "US 1900 Start (Old Format)/RTWGame8.bcs". Both Year 1900, Month 1, Day 1.
  - `JakeKen25/Privateer` (GitHub), `developmentResources/exampleSaves/Game4/
    RTWGame4.bcs` (Year 1935, Month 1, Day 1) and `Game5/RTWGame5.bcs`
    (Year 1900, Month 1, Day 1). Saves identify as RTW3 1.01.44 per Privateer's
    format notes. Game4/Game5 contain non-base-game nations (Soviet Union) and a
    "TEST" admiral, so they may be modded/test saves; their `Prestige=20` default
    is corroborating, not primary.
  - `JakeKen25/Privateer`, `privateer/save.py` and
    `guides/rtw3-format-observations.md` (save grammar, integer `Prestige` field).
- **Community observations:**
  - Steam Community, "Why did i get sacked 1 year in after almost nothing?"
    (2023-05-20), ulzgoroth: "You seem to start the game with your prestige barely
    above 16 (16 is a really weird 'do not go below' threshold)"; Stele: "You
    loose when your prestige goes down to 16 or below."
  - Steam Community, "Prestige loss during blockade" (2023-06-12), Chris35:
    "in 1893 i was sacked with only 15 prestige left"; CredibilityProblem: "big
    enough wins will net you prestige too."
  - Matrix Games forums, "Admiral Mode (AI+)" AAR, EvanJones, 2024-04-11 onward:
    final scores 202/214/217/218/232/233/241/302; "42 Prestige At Start";
    "minor defeat … (10-point Prestige loss)"; "if I get beat bad, I'd lose 20";
    "sacrifice 10% of prestige" (Caution buy-off); Hall-of-Fame ranking.
  - Matrix Games forums, "Suggested re-work of prestige and morale", mrchuck,
    2024-11-12: "Why is the gain never more than 1 or 2 even after a heroic
    victory?"
  - Matrix Games forums, "Where the !@#$ are you guys going?", mrchuck, 2025:
    "We got two prestige for our stunning victory."
  - Matrix Games forums, "1.0.84: Granting independence is all backwards",
    mrchuck, 2025-05-29: "+1 prestige to let them go in peace and -1 to hang on."
  - Matrix Games forums, "Victory Conditions", CaptBeefheart, 2023-08-23:
    "I couldn't find the prestige levels of any of the other countries."
  - Matrix Games forums, "Best nation to start with?", ultradave, 2023-05-22:
    "concentrate on not getting sacked in 3 or 4 years … keep losing prestige."

## What this note does and does not do

- It **does** ground: the integer nature of prestige; the ≤16 sacking threshold;
  the flat-20 fresh-start default; the existence and direction of every loss/gain
  source; the "final prestige = career score / Hall of Fame" rule.
- It **does not** ground: any per-source fraction, any gain magnitude, the monthly
  sacking probability, the score formula, the scale bounds, or any per-nation 1880
  value.
- **No value in this note is authorized for production.** Production prestige
  values may be authored only after the owner has accepted each value's provenance
  and authorized ticket 08, per decision 0003-B and ADR-0225.
