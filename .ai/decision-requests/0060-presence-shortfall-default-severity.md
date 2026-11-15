# Decision Request: Presence shortfall severity at the 1880 start (#576)

## Status

Resolved provisionally by PR #843 (#838): a surplus-ship rule plus a 3 month opening grace replaces the Option E interim, and `rules.presence.shortfallPrestige` is back in the 1880 ruleset (`lossBpPerWholeShortfall` 200, `maxLossBp` 500, `openingGraceMonths` 3, `surplusShipsOnly` true). A nation is charged only for short areas an idle surplus ship could cover (ACTIVE, unposted, ACTIVE at month start, not needed to hold its area, tons at least the shortfall); AI-slot nations are exempt because the AI never posts ships. The grace is counted from the turn number, so no per-nation state and no compat bump. Option C is rejected (fabrication at scale), and Option B stays rejected. All values are PROVISIONAL and owner-revisable. Measured over 60 passive months: only `uk` is charged from month 4 (prestige 20 to 0 by month 24 unless it posts its idle ship), `austria_hungary` once at month 28, AI nations never. Reversal: delete `openingGraceMonths` and `surplusShipsOnly` (or the whole `shortfallPrestige` block) and re-pin the content lock. Superseded history: Option E (PR #837, #833) switched the charge off as the interim.

The #576 code is complete and merged (PR #827, #834). #833 measured that no data-only lever clears the opening; see [Calibration finding (#833)](#calibration-finding-833).

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

## Calibration finding (#833)

Measured with `measurePresence` on the compiled production start (no commands, month 1). Source rows: manual p.46 and p.62 and Research #450 rows 1, 2, 17 to 19 supply structure only, so no sourced magnitude exists for required tons or the loss.

Why required tons cannot be calibrated away:

- `shortfallLossBp` charges `floor(shortfallTons * 10000 / requiredTons)` per area, a fraction. An empty area is 10000 bp at any tonnage, so lowering `requiredTonsPerPossessionWeight` (300 to 1500 t per area already) changes nothing; only 0 (Option E) does.
- `ceilDivBasisPoints` makes any loss from 1 to 500 bp equal to 1 prestige at prestige 20. One uncovered area costs the same as thirteen, so `lossBpPerWholeShortfall` and `maxLossBp` are also inert at low prestige.
- The only other data lever is `noPortValueWeight: 0`, which zeroes the requirement in areas where the nation has no port. Of 48 uncovered station areas at the start only 6 have no port (`france` senegal, reunion, tahiti; `netherlands` suriname; `spain` puertorico; `uk` mauritius). It clears 6 and leaves about 42 charged, and it would hand #573 rows with `requiredTons` 0.

Why seeding starter ships (Option C) is large: 48 areas are uncovered, so about 42 small station ships plus ACTIVE cover for `qing` and `usa` (both start with no ACTIVE ship, only a WORKING_UP one that does not count). The 1880 catalogue has no sloop, gunboat or cruiser hull types, `fleets.ts` leaves stations empty on purpose (`fleet_gbr_cape` note), and inventing 14 nations of historical station ships is fabrication at scale. It does not conflict with #831 (starters touch loadouts and reference designs, not `fleets.ts` or `designs.ts`).

Per-nation start (uncovered of total station areas, ACTIVE ships): `austria_hungary` 1 of 2 (1), `brazil` 1 of 2 (1), `france` 8 of 9 (1), `germany` 1 of 2 (1), `italy` 1 of 2 (1), `japan` 2 of 3 (1), `netherlands` 1 of 3 (2), `ottoman_empire` 3 of 4 (1), `portugal` 4 of 5 (1), `qing` 4 of 4 (0), `russia` 2 of 3 (1), `spain` 4 of 5 (1), `uk` 13 of 15 (3), `usa` 3 of 3 (0).

Not measured: how many months `qing` and `usa` take to turn WORKING_UP into ACTIVE, and whether AI nations ever station ships. If they do not, any rule that bites on neglect drains AI prestige too.

Rejected for #833 without owner approval: data-only retune (no-op), `noPortValueWeight: 0` (clears 6 of 48), Option B first form (empty areas free, inverts manual p.46), Option C (fabrication at scale), a calendar grace (only delays, belongs to #826), and a surplus-ship rule that charges only areas a nation could cover by moving an idle ship (new gameplay rule, still charges `uk` at the start, AI never moves ships).

Recommendation (unchanged, now evidenced): apply Option E to the 1880 ruleset as the interim, and decide Option C versus a new rule together with #826. Test to write once chosen: a no-command production run shows no `PRESENCE_SHORTFALL` for months 1 to N for every nation, paired with a run where a covering ship leaves a charged area and the next month fires. Reversal of E: restore `presence.shortfallPrestige` (`lossBpPerWholeShortfall` 200, `maxLossBp` 500) and re-pin the content lock.

## Work safely completed while blocked

- Engine step, reason `PRESENCE_SHORTFALL`, ruleset data gate, tests, status-strip card, e2e, ledger rows, content lock and replay re-pin.
- Probe of the start shortfall above (probe file not committed).
