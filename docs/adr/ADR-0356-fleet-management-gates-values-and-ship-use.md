# ADR-0356: Fleet Management — Gates, Values and Ship Use

Consolidates: ADR-0286, ADR-0287, ADR-0293, ADR-0314

Applies to: campaign, content, content-compiler, content-schema, desktop, phase-engine

Rule: Ship use is decided by one pure gate evaluator; fleet-management values live in a dormant ruleset section until authored; repair entry from battle damage is deferred.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0286
Supersedes: ADR-0287
Supersedes: ADR-0293
Supersedes: ADR-0314
Consistent with: ADR-0355
Consistent with: ADR-0362
Consistent with: ADR-0363

## Context

Fleet management needed a single point that decides whether a ship may sail, fight, hold station or take a mission, and a set of authored values for the mechanisms decisions #195–#203 fixed.

ADR-0286 introduced `evaluateShipGates` in `@bluewave/campaign`, a pure evaluator that returns the ordered list of failed gates for a ship and a use (`SAIL`, `ENTER_BATTLE`, `HOLD_STATION`, `TAKE_MISSION`). Each reason is a `{ _tag }` from a closed set (`GATE_REASON_TAGS`). There is no weight or threshold — the explanation is the list. `ASSIGNMENT_ALLOWED_USES` declares which uses an assignment kind allows; `FOREIGN_STATION` allows `ENTER_BATTLE` only. A ship holds at most one assignment; a second is refused with `ALREADY_ASSIGNED`. The optional `fleetManagement` ruleset section decoded strictly with excess keys rejected carries all values (cohesion, experience, training, exercises, penalties) and is dormant when absent, with no code default.

ADR-0287 added `BattleInstance.absences`, an optional list of `{ shipId, reasons }` in ship-id code-point order, listing only failed `ENTER_BATTLE` gate reasons. Candidates are ships of the player nation not under construction, in the battle's area, and not participants. Evaluated at battle-generation time on the pre-reservation snapshot; crew quality is not an absence reason. Recording runs only when the `fleetManagement` engine option is present and the player nation is a battle side.

ADR-0314 resolved the value gates of spec #265 by the owner's standing delegation. Every magnitude is `kind: balance_adjustment` with `sourceStatus: BALANCE_TARGET` except rows marked sourced from the manual (p.53): monthly cohesion growth 2 points (recovers an `addShip` penalty in five months), cap 90 (leaves headroom above any seeded 30), experience per battle 3 points (below the exercise gain), per annual exercise 5 points (offsets one `addShip` penalty exactly), role-change penalty cohesion -10, formation-change penalty cohesion -5, exercise timing any month once per calendar year, exercise maintenance 2× active (sourced, p.53), training proficiency 12 funded months (sourced, p.53), at most 2 subjects (sourced, p.53), training adders 3000 bp gunnery and 2000 bp night fighting/torpedo tactics/damage control (sourced, p.53), proficiency effect +1000 bp on accuracy or response. REPAIR entry for battle damage was deferred to a future battle-aftermath effort (T-2/T-3). Japan's training discount and the exercise tension consequence were left unmodelled as recorded owner observations.

ADR-0293 authored the `fleetManagement` section in the 1880 core ruleset, made every month-executing path pass it (desktop turn transaction, replay executor, desktop continuity replay), and re-recorded all replays with `EXPECTED_GAMEPLAY_CHANGE` approval entries (ADR-0279). A new fourteen-month scenario exercises training, doctrine, exercise and growth. Dormancy tests stay for each rule so retuning or withdrawing the section is safe.

## Rules

1. **Gate evaluator.** `evaluateShipGates` in `@bluewave/campaign` returns the ordered list of failed gates for a ship and a use (`SAIL`, `ENTER_BATTLE`, `HOLD_STATION`, `TAKE_MISSION`). Each reason is `{ _tag }` from a closed set (`GATE_REASON_TAGS`). There is no weight or threshold; the explanation is the list. Callers (fleet movement, foreign-station assignment) read their reasons from the evaluator and keep their existing problem codes.

2. **Assignment slot.** `ASSIGNMENT_ALLOWED_USES` declares which uses an assignment kind still allows. `FOREIGN_STATION` allows `ENTER_BATTLE` only. A new assignment kind (e.g., trade protection, raider) is added in three places: the `StationAssignment` union, its entry in `ASSIGNMENT_ALLOWED_USES`, and its replay-body and command wiring. A ship holds at most one assignment; a second is refused with the typed `ALREADY_ASSIGNED` station reason. The gates report `Assigned` for `HOLD_STATION` and `TAKE_MISSION`.

3. **Fleet management ruleset section.** An optional ruleset field `fleetManagement`, decoded strictly by `decodeFleetManagementRules` (`@bluewave/content-schema`) with excess keys rejected, carries: division cohesion growth and cap, division experience per battle and exercise, role and formation change penalties, training proficiency months, subject limit and per-subject adders and effects, exercise maintenance multiple and yearly limit, and `provenance`. Invalid sections fail validation with `FLEET_MANAGEMENT_RULES_INVALID`; two carriers with `FLEET_MANAGEMENT_RULES_AMBIGUOUS`. Absent means dormant and no default exists in code. `fleetManagementFromRulesets` is the consumer seam.

4. **Values are balance targets.** Every magnitude is `kind: balance_adjustment` with `sourceStatus: BALANCE_TARGET` except where marked sourced. Values are tunable data in the ruleset section, never code constants.
   - Monthly cohesion growth: 2 points (recovers an `addShip` penalty (10) in five months; a canonical-type change (20) in ten).
   - Cohesion growth cap: 90 (leaves headroom above any seeded value (30); 100 unreachable by time alone).
   - Experience per battle fought: 3 points (below the exercise gain; fighting teaches but drills are the planned route).
   - Experience per annual exercise: 5 points (offsets one `addShip` experience penalty (5) exactly).
   - Role-change penalty: cohesion -10, experience 0 (equal to a flagship change).
   - Formation-change penalty: cohesion -5, experience 0 (half a role change; a formation is a preference).
   - Exercise timing: any month, once per calendar year (sourced, manual sets only "once a year").
   - Exercise maintenance: 2 × active, for the month (sourced, p.53).
   - Training proficiency: 12 funded months (sourced, p.53).
   - Training subjects: at most 2 (sourced, p.53).
   - Training maintenance adders: gunnery 3000 bp; night fighting, torpedo tactics, damage control 2000 bp each (sourced, p.53).
   - Proficiency effect: +1000 bp on the subject's accuracy or response (gunnery and night fighting sourced +10% p.53; torpedo tactics and damage control targeted equal).

5. **REPAIR entry.** No production path enters REPAIR except seeds. Entering REPAIR from battle damage is deferred to a future battle-aftermath effort (T-2/T-3). This effort adds no REPAIR entry; the readiness command never targets REPAIR. The two mechanisms (readiness state `REPAIR` and the design yard's `UNAVAILABLE` path) stay separate.

6. **Battle absence record.** `BattleInstance.absences` is an optional list of `{ shipId, reasons }` in ship-id code-point order, listing `GateReasonTag` values in evaluator order. Only failed candidates are listed. A candidate is a ship of the player nation not under construction, in the battle's area, and not a participant. Absences are evaluated at battle-generation time on the pre-reservation snapshot and persisted on the record, so later repairs or readiness changes never rewrite them. Crew quality is not a reason (only `ENTER_BATTLE` gates produce reasons; a poor crew yields a present ship, not an absence). The field is omitted when there are no absences.

7. **Not modelled (deferred).** Japan's training discount (manual p.53, no figure) is not modelled; ADR-0230 forbids nation-name branches and no per-nation training modifier field existed at the time. The tension consequence of a large exercise is an extension point for S-3/S-4. Combat consumption of proficiency is a separate follow-up.

8. **Go-live.** The 1880 core ruleset carries `fleetManagement` with the ADR-0314 values and a `balance_adjustment` provenance that names the manual pages for sourced values. Every path that executes a month passes the section: desktop turn transaction, replay corpus executor (`advance`), and desktop continuity replay. A path that omits the option diverges as soon as a division gains cohesion. Replays are re-recorded and approved with `EXPECTED_GAMEPLAY_CHANGE` entries, not re-pinned. A new fourteen-month scenario exercises training, doctrine, the exercise and growth. Dormancy tests stay for each rule, so retuning or withdrawing the section is safe.

## Compatibility

Additive and dormant by default. Training progress, exercise history, battle `absences` and the generalised assignment slot are optional, additive state. By the ADR-0264 reasoning, `CURRENT_COMPATIBILITY_VERSION` is unchanged while every field stays optional. An existing save loads with the section live. `golden/hashes.json` does not move because its proof compiles a synthetic fixture, not the production pack.