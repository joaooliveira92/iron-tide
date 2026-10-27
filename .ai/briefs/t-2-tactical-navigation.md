# Milestone T-2N: Tactical navigation (plan)

Plan for the manoeuvring half of SPRINT-PLAN T-2 ("Sandbox promoted: OOB, formations, roles, speed, targeting, force
orders, three realism modes"). Nothing here is implemented, and no screen is in scope for this plan; slice 6 only
names the screen contract. Reference: Rule the Waves 3 manual pp. 78-88 and 98-101 (battle map, manoeuvring,
formations, roles, speed, turns, realism, force orders). Evidence read from `feat/e1-air-missiles`.

## What navigation means in RTW3

The player is an admiral: orders go to **divisions**, never ships (unless a division holds one). Per division: speed,
course (typed, or picked on the map), "go to point and pause on arrival", formation, role, lead division, AI/manual
control, "turn together". Per force: flotilla attack, rally, disengage, change lead division, battle turn away. The
game runs in one-minute turns. Realism (Admiral / Rear Admiral / Captain) limits who can be ordered. Speed has costs
(grates fouled -1 kn, stokers exhausted -2 kn, breakdowns, gunnery vibration above 25 kn). Non-line-ahead formations
lose ships in poor visibility and at night; heavy ships in line abreast disorder over time.

## Starting state (verified)

- `packages/combat/src/movement`: integer kinematics at one-second substeps (60 per minute): `advancePosition`,
  `resolvePropulsion` (flat accel/decel), `resolveTurning` (flat rate, shortest arc), direction table, station
  contract constants. Deterministic and tested.
- `computeDesiredStation` and `helmSteerToStation` (LINE_AHEAD, LINE_ABREAST, SEARCH_LINE, SCREEN) exist but only
  `test/movement/formation-station.test.ts` calls them. The engine never steers a ship to a station.
- `simulation/minuteStages.ts`: each unit gets one `UnitOrders { orderedHeading, orderedSpeedBp, attainableMaxBp }`.
  `resolveCollisionsGrounding` is a stub that returns an empty record. There is no land, depth, or map in battle.
- `tactical/division.ts`: formation legality and role eligibility (matches manual p.85, including the 1500 t
  destroyer scout rule), division effects (`formationCohesion`, `signaling`).
- Player battle: `battleResolution/playerSession.ts` turns a per-division `stance` (ENGAGE, HOLD, away) plus a speed
  percent into unit orders; `pursuit.ts` supplies headings. The UI (`PlayerBattleScreen.tsx`) exposes only stance and
  speed. There is no course, waypoint, formation, role, or force order.
- Campaign side is separate: F-1 strategic map covers one-hop fleet moves and is out of scope here.

## Gaps against the manual

| Manual feature                                      | State                                            |
| --------------------------------------------------- | ------------------------------------------------ |
| Division course and speed orders                    | Per-unit heading exists; no division-level order |
| Formation keeping (4 formations)                    | Station maths only, not wired                    |
| Roles and lead division behaviour (AI)              | Eligibility only; no behaviour                   |
| Turn together vs follow-the-leader turns            | Absent                                           |
| Go-to-point with pause on arrival                   | Absent                                           |
| AI vs manual division control and realism gating    | Absent                                           |
| Speed penalties (grates, stokers, breakdown, flood) | Absent (T-3 lists grates and stokers)            |
| Separation of ships in poor visibility or at night  | Absent                                           |
| Collision, grounding, land targets                  | Stub                                             |
| Force orders (flotilla attack, rally, disengage...) | Absent                                           |
| Pause-on-event, run N minutes                       | Not specified at engine level                    |

## Principles

1. Navigation stays inside the existing minute pipeline: orders in, `MovementState` out, ledger events recorded. No
   new clock, no wall time, integer maths only (ADR-0268 comment rule applies).
2. One order model. Division orders compile to the existing per-unit `UnitOrders`; the engine does not learn a
   second input path. AI divisions produce the same orders a player would.
3. Any random outcome (separation, breakdown) uses a domain-separated stream with a recorded reason code.
4. Every tunable (turn rate by ship class, accel, station tolerance, grate timers, separation odds) is content or
   ruleset data marked PROVISIONAL until sourced (ADR-0252). Today these are constants in `movement/constants.ts`.
5. Anything that changes outcomes moves goldens: re-pin deliberately (docs/agents/golden-repinning.md).

## Slices (each shippable, in dependency order)

**0. Spec and decisions.** Write the order-model spec and record ADRs. Decision requests needed before slice 2:
(a) is the battle map flat or does it need land/shoal data (affects slice 5 and scenario content); (b) which
realism modes ship in T-2 (the manual has three; the sprint plan says three); (c) whether turns follow the manual's
"each ship follows the leader's track" or a simpler station-chase.

**1. Division order model (engine, no UI).** `DivisionOrders { course | waypoint(point, pauseOnArrival), speed,
formation, role, leadDivisionId, control: PLAYER | AI, turnTogether }` as a strict Schema with a frozen wire
format and parity test from existing fixtures. A compiler maps division orders to per-unit `UnitOrders` each
minute. Replaces stance-only orders in `playerSession.ts` while keeping stance as a derived preset so existing
goldens stay valid.

**2. Formation keeping.** Wire `computeDesiredStation` and `helmSteerToStation` into the movement stage: flagship
leads, others steer to station, speed trimmed to the slowest ship, `offStation` recorded. Turn-together vs
follow-the-leader track. Per-class turn rate and accel from design data instead of the flat constants.

**3. Roles and AI divisions.** Behaviour for CORE, SUPPORT, SCOUT, SCREEN, PATROL, INDEPENDENT relative to the lead
division, using manual p.85 definitions. AI control toggles by realism rules. This produces orders only, so it is
testable as a pure function from battle state to `DivisionOrders`.

**4. Speed and machinery effects.** Grates fouled, stokers exhausted (coal and VTE sensitivity), breakdowns,
flooding speed cap (10 kn safe), vibration gunnery penalty above 25 kn. Overlaps T-3; take only the speed-limiting
part here and leave T-3 the rest.

**5. Collision, grounding, separation.** Replace the stub with real collision and, if decision (a) allows,
grounding. Separation of non-line-ahead formations in bad visibility/night using the existing weather visibility.

**6. Force orders and realism gating.** Flotilla attack, rally, disengage, change lead division (once per battle),
battle turn away (tech-gated). Realism modes restrict which divisions accept orders. Also the pause rules: run N
minutes, pause on arrival, pause on configurable events, as an engine-level request/response so the UI is thin.

**7. Screen contract (planning only).** Define the read model the later battle map consumes: positions, headings,
division flags (square = player, triangle = AI), planned course lines, ranges, track chart. The screen itself is a
separate milestone.

## Acceptance (per slice)

- A failing test first (red, green, refactor), exercising production composition.
- Determinism: same seed and orders give identical hashes across OSes; golden changes explained.
- Explainable: every player-visible speed or course limit traces to an explanation tree entry.
- `pnpm preflight`, `pnpm test:scripts`, `pnpm check` green on the final commit (heavy-wrapped, once per branch).

## Risks

- Moving to coordinated formation movement shifts every battle hash, so auto-resolution goldens and the fuzz corpus
  will need re-pinning. Land slice 1 behind the stance-derived preset to prove zero drift first.
- AI role behaviour (slice 3) is the largest unknown and the main source of "dumb division" bugs; budget for a
  scenario-based test bed rather than unit tests only.
- Doc budget: add this brief to `scripts/doc-budgets.manifest.json` if briefs are budgeted.

## Out of scope

Strategic one-hop movement (F-1), air and carrier operations, submarine navigation, the battle map screen,
mid-battle save format changes.
