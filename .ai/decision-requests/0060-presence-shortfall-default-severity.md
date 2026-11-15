# Decision Request: Presence shortfall severity at the 1880 start (#576)

## Status

Blocked pending owner decision. The #576 code is complete and left as written; PR #827 stays draft.

## Trigger

With the prestige penalty on, every nation starts the 1880 campaign short on station presence and cannot cure it with the starting fleet. The loss is therefore a flat monthly tax, not a consequence of player choice. Which behaviour is intended changes gameplay.

## Evidence

Measured on the production 1880 pack (`measurePresence` on the compiled start snapshot, month 1, shortfall in tons):

- `uk`: 15 station areas, 13 uncovered, 4 ships (3 ACTIVE, 1 WORKING_UP, which does not count). Only `eng_home_coast` and `med_malta` are covered. Required tons per area run 300 to 1500; one 8500 to 12000 t ship covers any single area, but a ship is in one area, so 4 ships cover at most 4 of 15.
- Every nation is short at the start: `austria_hungary` 1 of 2 areas, `brazil` 1 of 2, `france` 8 of 9, `germany` 1 of 2, `italy` 1 of 2, `japan` 2 of 3, `netherlands` 1 of 3, `ottoman_empire` 3 of 4, `portugal` 4 of 5, `qing` 4 of 4, `russia` 2 of 3, `spain` 4 of 5, `usa` 3 of 3.
- Stationing the starting fleet cannot clear it: 4 ships cover at most 4 of the 15 `uk` areas, so at least 11 stay short, and the loss stays at the 500 bp cap.
- Loss arithmetic, prestige 20: `ceil(20 * bp / 10000)` is 1 for every bp from 1 to 500. At the shipped values 13 short areas sum to 2600 bp and clamp to the 500 bp cap, so the loss is 1 a month. Lowering `lossBpPerWholeShortfall` or `maxLossBp` changes nothing at the default start; only removing the block does. The rounding is the shared `ceilDivBasisPoints` in `packages/campaign/src/prestige.ts`, also used by `UNPAID_FUNDS` and `BATTLE_LOST`, so it is not a presence-only retune.
- Consequence for the player: prestige 20 falls to 16 in 4 months (`sackingThreshold` 16, sacking probability 1000 bp a month, `content/production/1880/rulesets.ts`). The 1880 event catalogue run (`docs/research/p7-event-catalogue.md`) records 0 of 4 passive runs sacked in 240 months; that run does not exercise presence, so it no longer describes a passive player once the penalty is live.
- Authority: manual p.46 says prestige "may suffer" and a shortfall "might even lead to revolts"; p.62 says loss is "in most cases proportional". Research #450 rows 17 to 19 give structure only; no magnitude is sourced.

## Why agent judgment is insufficient

A flat unavoidable tax, a pressure to build station ships, and a dormant penalty are three different games. Every instructed lever (the two ruleset values) is a no-op at the default start, and each real fix adds a gameplay rule nobody approved.

## Options

### Option A: Accept as build-a-station-fleet pressure

- Behavior: ship as is. The player loses 1 prestige a month until the fleet grows.
- Advantages: matches the manual's intent that presence is a standing obligation; no further work.
- Risks: a passive player is sack-eligible from month 4; the drain has no counterplay in the first year; no signal separates a careful player from a passive one.
- Compatibility impact: none. Migration impact: none. Scope: none.

### Option B: Charge only areas with some presence, or only a worsening shortfall

- Behavior: an area with zero ships present costs nothing (or only a month-over-month rise counts).
- Advantages: stationing a ship becomes a real choice; the start is not punished.
- Risks: leaving an area empty is free, which inverts the manual.
- Compatibility impact: a new rule field in the presence section, content lock re-pin; a worsening rule needs per-nation state (compat bump).
- Migration impact: none for the first form. Scope: small to medium.

### Option C: Seed starter station ships in content

- Behavior: add station ships to the 1880 starts so the opening can meet the requirement.
- Advantages: the rule bites only on neglect.
- Risks: content and balance work for 14 nations; touches the starter fleets in #823 and #825; replays move.
- Compatibility impact: content lock and replay re-pin. Migration impact: none. Scope: large.

### Option D: Presence-specific rounding

- Behavior: apply the loss with a fractional or probabilistic result instead of `ceil`.
- Advantages: loss scales with how short the nation is.
- Risks: needs fractional prestige or a deterministic roll; a new mechanic.
- Compatibility impact: new rule kind or prestige precision. Migration impact: none. Scope: medium.

### Option E: Disable in 1880 until #826

- Behavior: delete `presence.shortfallPrestige` from the 1880 ruleset; keep the engine step for other packs.
- Advantages: removes the unavoidable drain until revolt and grace (#826) are decided together.
- Risks: the playtest complaint in #576 (no effect from leaving stations uncovered) stays unfixed in the shipped pack.
- Compatibility impact: content lock re-pin. Migration impact: none. Scope: trivial.

A start-of-campaign grace (the #576 recommendation, deferred to #826 because it needs per-nation state) only delays a permanent shortfall. It is not a fix on its own.

## Recommendation

Option E for 1880 now, with Option B (zero-presence areas free, scaled by the cap) or Option C chosen together with the #826 grace decision. Option A is acceptable only if the owner wants presence to be a standing cost from month 1. Do not implement the disputed behaviour before approval.

## Work safely completed while blocked

- Engine step, reason `PRESENCE_SHORTFALL`, ruleset data gate, tests, status-strip card, e2e, ledger rows, content lock and replay re-pin.
- Probe of the start shortfall above (probe file not committed).
