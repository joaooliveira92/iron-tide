# Bluewave Roadmap

Direction for reaching _Rule the Waves 3_ rules parity. The RTW3 manual is
authoritative for mechanics, terminology and design intent, not for scope. Sprints,
acceptance criteria and evidence live in `.ai/SPRINT-PLAN.md`.

## Accepted scope (2026-10-15)

- **Sole start: 1880**, a deliberate choice, not a gap against the manual's 1890.
  The scenario is production, never "experimental". No 1890 or other start without
  a new accepted decision.
- **Horizon:** authored technology through 1939. 1960 and the 1970 end are out of
  scope; radar-centric, missile-era and postwar warfare await a separate expansion.
- **Roster:** ten manual-backed nations are playable for the deliberate 1880-only
  release: the manual's nine plus the USA (ADR-0214). Four others are AI-only until
  each passes the readiness gate.
- **Presentation:** units, currency, theme and accessibility are display
  preferences over canonical values; they never change simulation. Currency modes:
  Naval Credits (NC, default), National Historical (only with a validated national
  configuration, never silently substituted), Budget Points (BP); no custom currency. UI language is English (en-US fallback); formatting locale is separate.

## Where we are

- Combat engine is deep but mostly unreachable from a campaign.
- Ship building is the strongest vertical.
- The strategic layer is thin: no prestige, unrest, events, treaties, readiness states, trade war or invasions.
- AI is legal-random for budget and research.
- An Options screen exists but is a single stub; there is no preferences domain.

## Order

1. Selectively restore and re-baseline documentation (decision request 0001). The
   gate has a finite exit; artifacts that never existed are registered as unavailable
   and replaced, not waited for.
2. Record 1880 as sole start; strip language implying 1890.
3. Validate and complete the 1880 scenario for the nine playable nations.
4. Define canonical units and money representation.
5. Preferences architecture, then the Options screen.
6. Manual-backed strategic systems (a game you can lose).
7. Player-fought battles integrated into campaign progression.
8. Goal-directed AI replacing random decisions.
9. Validate nine nations; promote the other five one at a time.
10. Release validation across themes, units, currencies, accessibility, packaged
    builds.

## Rules that stay

- A capability counts only when a deterministic test drives it from a compiled
  campaign month and observes authoritative state.
- Determinism, boundary decoding and the runtime-free renderer are not traded away.
- Values the manual lacks are researched or escalated, never invented.
