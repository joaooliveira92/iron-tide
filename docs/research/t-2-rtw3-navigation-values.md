# RTW3 tactical navigation rules and values

Status: research note for issue #327 (parent map #324). Every value below is PROVISIONAL (ADR-0252). It chooses no behaviour; unsourced values go back to the owner as decision requests.

## Source and method

- Manual: `docs/Rule the Waves 3 Manual EBOOK.pdf`, text extracted with PyMuPDF; page numbers are the PDF page index. Read: pp.82-88 (manoeuvring, formations, roles, speed, playing a turn), pp.100-101 (force orders), p.41 (engine priority), plus a full-text search for "grates", "stokers", "vibration", "separated", "flooding", "breakdown".
- Repo: `packages/combat/src/movement/constants.ts` (movement_kinematics_v1, formation_station_v1) and `docs/research/rtw3-manual-baseline.md`.
- Historical: Jellicoe, The Grand Fleet 1914-1916 (Project Gutenberg #75323, https://www.gutenberg.org/cache/epub/75323/pg75323.txt), first 100,000 characters only. A search for Grand Fleet Battle Orders station distances and tactical diameters found nothing citable; those are marked unsourced rather than recalled from memory.
- Headline finding: the manual gives rules in words and almost no numbers. The only numbers are 1 knot, 2 knots, 25 knots, 10 knots, 1500 tons, and "a couple of knots" below maximum. Every timer, interval, rate and probability is unsourced.

## Rules, verbatim from the manual

| Topic | Manual text | Page |
| --- | --- | --- |
| Orders | Orders go to divisions, not ships (unless alone in a division). Square flag = player control, triangular = AI. Course by number, map pick, or shift-click; ctrl-click gives a move-to point and the game pauses on arrival. | 82-84 |
| Formations | Line ahead: all ships follow the division flagship. Line abreast: ships form up on the flagship abreast. Search line: like abreast with "much larger intervals". Screen: ships spread to cover an arc in front of the lead division. | 84 |
| Separation | "Formations other than line ahead have a risk of ships getting separated from the division, especially at night or in poor visibility. Heavy ships (heavier than CL) in line abreast will also tend to have their formation disordered after a while." | 84 |
| Roles | Independent, Core (follows lead division), Support (behind lead or on disengaged side), Scout (considerable distance ahead, spread out), Screen (short distance ahead), Patrol. All divisions except independent have a lead division. No battleship scouts; destroyer scouts only if all ships exceed 1500 tons. | 84-85 |
| Turn together | Check box lets a division in line ahead turn together instead of in succession. | 85 |
| Grates fouled | "After a period at full speed, ships will get 'Grates fouled', which will reduce the speed of the ship by one knot." | 86 |
| Stokers exhausted | Escalates from grates fouled "after an additional period, with a 2 knot speed loss". Coal more sensitive than oil, VTE "even more so". | 86 |
| Recovery | At cruise speed or below the grates are eventually cleaned, "but that will take longer than incurring the penalty". | 86 |
| Breakdown | Long full-speed runs can cause engine breakdowns, "especially for ships with engines that prioritize speed". Engine priority trades weight against breakdown risk, in battle and on strategic turns. | 86, 41 |
| Vibration | "Ships at full speed and above 25 knots will suffer vibrations that give a gunnery penalty." A division at full speed leaves no margin to catch up; advice is to keep division speed "a couple of knots below maximum". | 86 |
| Flooding | Damage control reduces flooding more often at lower speed; high speed with extensive flooding risks the ship; "10 knots is usually 'safe' speed". | 88 |
| Machinery hits | "Engine room hits will in most cases affect the speed of the ship." | 88 |
| Time | The game moves in one-minute turns; a single turn button plays one. | 88 |
| Force orders | Change force lead division; Battle Turn Away (when researched) reverses the line with each ship doing a 180 degree turn and changing order within divisions; "liable to cause some confusion". | 100-101 |

## Candidate value table (all PROVISIONAL)

| Value | Candidate | Source | Notes |
| --- | --- | --- | --- |
| Grates-fouled speed loss | 1 knot | Manual p.86 | Sourced. |
| Stokers-exhausted speed loss | 2 knots total (not additive to the 1) | Manual p.86 | Sourced; "2 knot speed loss" read as total. Interpretation to confirm. |
| Vibration speed threshold | at full speed and above 25 knots | Manual p.86 | Sourced. |
| Vibration gunnery penalty | unsourced | none | Manual says only "a gunnery penalty". |
| Safe flooding speed | 10 knots | Manual p.88 | Sourced as "usually safe", a soft threshold not a hard cap. |
| Flooding speed cap (hard) | unsourced | none | Manual gives no cap, only a lower flood-reduction chance at high speed. Needs a decision. |
| Destroyer scout minimum | above 1500 tons (all ships) | Manual p.85 | Sourced; role gating, not navigation maths. |
| Recommended division speed margin | a couple of knots (use 2) below maximum | Manual p.86; Jellicoe describes a "reserve of speed" so the whole line kept 14 knots when the slowest squadron was about 3 knots slower | Sourced in spirit; 2 is an interpretation. |
| Grates fouled onset (full speed) | unsourced | none | Ordering is sourced (VTE worse than coal worse than oil); no minutes. |
| Stokers exhausted onset | unsourced | none | Same ordering. |
| Fouling recovery time | unsourced | none | Rule: slower than onset, only at cruise speed or below. |
| Coal / oil / VTE sensitivity multipliers | unsourced | none | Ordering only. |
| Breakdown chance per minute at full speed | unsourced | none | Scales with engine priority (speed raises, reliability lowers). |
| Separation chance, non-line-ahead, night / poor visibility | unsourced | none | Qualitative: higher at night and in poor visibility; heavy ships (above CL) in abreast also disorder over time. |
| Turning rate | unsourced in manual; engine holds 1000 mdeg/s design rate and 300 mdeg/s safety minimum | `constants.ts` | Current repo content, not a manual figure. |
| Turn behaviour | line ahead turns in succession unless Turn together is set; Jellicoe: fleets usually turned together, in succession "exceptional" | Manual p.85; Jellicoe ch. III | Manual default and historical practice differ; decision for the spec. |
| Line-ahead column interval | 400 m | `constants.ts` | Unsourced; no manual figure, no historical figure retrieved. |
| Line-ahead division gap | 500 m | `constants.ts` | Unsourced. |
| Line-abreast interval | 400 m | `constants.ts` | Unsourced. |
| Search line interval | unsourced | none | Manual says "much larger" than abreast. |
| Station tolerance / bearing tolerance | 50 m / 3000 mdeg | `constants.ts` | Unsourced. |
| Acceleration / deceleration | 40 / 60 knot-bp per second | `constants.ts` | Unsourced. |

## Open questions for the owner

1. Is "2 knot speed loss" the total at stokers exhausted or additional to grates fouled?
2. Is 10 knots a hard cap for heavily flooded ships or only the point below which the flooding-reduction roll is best?
3. Which turn default applies to line ahead: succession (manual) or together (Jellicoe's fleet practice)? The checkbox implies the former.
4. All timers, probabilities and the vibration penalty need either playtest sourcing or a deliberate PROVISIONAL choice recorded in an ADR; the manual cannot supply them.
5. Further historical sources worth a later pass: Grand Fleet Battle Orders, Naval Staff Monographs, and period tactical-diameter tables for the turning rate and station intervals.
