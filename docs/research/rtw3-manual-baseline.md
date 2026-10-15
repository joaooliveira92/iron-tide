# RTW3 manual baseline

Status: new research note, created 2026-10-15 by the G-1 sprint. First citation map of
the manual; later research extends it with new files rather than rewriting this one.

## Source and method

- Source: `docs/Rule the Waves 3 Manual EBOOK.pdf` (the RTW3 game manual).
- Method: text extracted page-by-page with `pypdf` 6.14.2 (148 pages); the extraction
  is a working copy, not a tracked artifact. Navigation verified against the manual's
  own contents page (PDF page 3-6). Page numbers below are the manual's printed page
  numbers; they match the PDF page index in the extracted ranges.
- Authority: per ADR-0210 the manual is authority order 3 — authoritative for mechanics,
  terminology, and design intent, except where an accepted decision deliberately
  diverges. It is not authoritative for scope.

## Confirmed section map

Table of contents, verified against the extracted text.

| Manual section | Pages |
| --- | --- |
| The object of the game | 12 |
| The world and your economy: budget, areas and possessions, strategic map, canals, research | 12-17 |
| General: starting a game, options, starting fleet, loading and saving | 18-22 |
| Building your fleet: building, rebuilding, docks, shipyard capacity, submarines, coastal artillery | 23-36 |
| Construction choices | 37-44 |
| Managing your fleet: movement, blockade and movement, maintenance and readiness, special training, divisions, officers | 45-58 |
| Politics and relations: national characteristics, government type, tension, events, prestige, unrest, intelligence, enemy ships, arms limitation, allies, peace | 59-66 |
| Tactical battles: surprise attacks, blockade, trade protection, raiders, ASW, mine warfare, invasions, blitzkrieg, fuel shortage, winning or losing | 67-77 |
| Your fleet in battle: order of battle, log, reports, objectives, manoeuvre, formations, roles, speed, targeting, turns, damage, gunnery, torpedoes, weather, smoke, MTB, minefields, land targets, submarines, preferences, force orders, victory | 78-101 |
| Aircraft operations | 102-120 |
| Radar and missiles | 121-127 |
| Questions and answers; player notes; appendices (incl. officer characteristics) | 128-143 |

## Confirmed mechanics (excerpt-verified)

- Budget grows about **3-5% a year** with economic growth; colonies add income that
  declines over time (pp.12-13). Naval budget share rises with tension (p.13).
- Research can be set to a maximum of **12%** of budget, with diminishing returns above
  **10%**; priorities are relative (high/medium/low); unspent points in a finished field
  are reallocated (p.16).
- Measurement units are imperial: inches for calibre and armour, yards for range,
  pounds for bomb weight (p.18).
- Playable nations are **Great Britain, Germany, France, Austria-Hungary, Russia,
  Italy, Japan, China, and Spain** (nine), against eight opponents; no human-vs-human
  play (p.18). The manual's starts are **1890, 1900, 1920, or 1935** (p.21).
- Readiness states: active, reserve, mothballed, and working up (working-up ships do not
  fight); repair costs about **2x** active maintenance; wartime maintenance rises sharply
  (pp.51-52).
- Special training takes **12 months** to proficiency and raises maintenance; a maximum
  of two subjects (Gunnery +30% cost, Night fighting +20%, Torpedo tactics +20%, Damage
  control +20%) (pp.52-53).
- Divisions: 1-5 ships (destroyer divisions up to six); division experience affects
  signalling, contact, fire distribution, and spotting (pp.54-56).
- Officers: ranks Commander, Captain, Rear Admiral, Admiral; ability (brilliant..
  incompetent) revealed after years of service; promotion around every five years; Naval
  Academy after research (pp.56-59).
- National characteristics and government types (Liberal democracy, Limited democracy,
  Autocratic, Fascist, Communist, Eastern); tension 0..; events with hawk/dove answers
  moving budget, prestige, and tension (pp.59-61).
- Prestige: proportional loss; sacked at **16 or below**; final score and Hall of Fame
  (pp.61-62).
- Unrest: raised by high military spending, long wars, blockade, cramped accommodation,
  defeats, events; lowered by war breaking out (initially), social programmes, victories,
  lower spending; revolution less likely in liberal democracies (p.62).
- Intelligence ramps up over time, risks detection raising tension, aids ASW and war
  planning (pp.63-64).
- Arms limitation treaties limit displacement, main calibre, and total tonnage; liberal
  democracies cannot cheat, others may cheat up to **10%** of displacement but not main
  calibre (p.65).
- Blockade requires **110%** of the enemy's weighted naval strength in its build area;
  Britain's value is multiplied by **1.2**, Russia's by **0.7** (p.70).
- Trade protection is a global pool sized to fleet, economy, and enemy submarines;
  raiders need long range and speed; AMCs and Q-ships have special rules (pp.70-72).
- ASW and mine warfare are ratings; operational mining and minesweeping are abstracted
  monthly (pp.72-74).
- Invasions use an invasion range in nautical miles from a friendly port; blitzkrieg is
  unavailable before **1935** (pp.74-76).
- Surprise attack has a base **80%** chance, reduced in later wars with the same enemy;
  reserve/mothballed ships can still be caught (pp.68-69).

## Deliberate divergences (accepted decisions, not manual gaps)

- **Sole 1880 start** (ADR-0201/DR-001): the manual's 1890 start is intentionally not
  used. The 1880 start is production content.
- **Horizon through 1939** (ADR-0204/DR-004): the manual runs to 1970 with radar and
  missiles (pp.121-127); those eras are out of scope for now.
- **Nine playable nations** (ADR-0205/DR-005): matches the manual p.18 roster; the USA
  is demoted.
- **Presentation** (ADR-0202/0203/0206..0209/0211): units, language, and currency are
  display preferences over canonical values; the manual's imperial units are the
  default measurement preset, not canonical storage.

## What the manual does not supply

The manual states rules and many numbers but not complete tables. It does not give the
full tech tree, per-nation starting fleets, ship class rosters, or precise event
catalogues. Values it omits are researched into `docs/research/` or raised as a decision
request; they are never invented (ADR-0210 stop conditions). This note records only what
the manual confirms; newly accepted scope lives in the ADR corpus.

## Using this note

Cite a page above when a sprint claims a mechanic. When the manual is silent, open a
research note or a decision request rather than filling the gap by assumption.
