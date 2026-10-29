# ADR-0314: Fleet-management v2 values are balance targets, and REPAIR entry stays out of scope

Applies to: content, campaign

## Status

Superseded by: ADR-0356

Accepted (2026-10-23). Resolves the value gates of spec
[#265](https://github.com/joaooliveira92/iron-tide/issues/265) (map
[#193](https://github.com/joaooliveira92/iron-tide/issues/193)) by the owner's standing delegation on
that map, which is the explicit owner authorization ADR-0213 requires for a `balance_adjustment`.
Same pattern as [ADR-0254](ADR-0254-t1-battle-offer-values-balance-targets.md) and
[ADR-0266](ADR-0266-s5-presence-values-and-open-requests-resolved-by-delegation.md).
Research: `docs/research/fleet-management-values.md`. Ticket: #267.

## Context

The fleet-management decisions (#195-#203) fix mechanisms and leave their magnitudes gated. The manual
states training and exercise exist and gives maintenance percentages and a twelve-month proficiency, but
no cohesion or experience rates. A repository search found no production path that sets a ship to REPAIR
other than seeded data.

## Decision: values

Every row is `kind: balance_adjustment`, `sourceStatus: BALANCE_TARGET`, except the rows marked sourced.

| Item | Value | Basis |
| --- | --- | --- |
| Monthly cohesion growth | 2 points | Recovers an `addShip` penalty (10) in five months and a canonical-type change (20) in ten, so reorganising is felt but not permanent. |
| Cohesion growth cap | 90 | Leaves headroom above any seeded value (30) and keeps 100 unreachable by time alone. |
| Experience per battle fought | 3 points | Below the exercise gain: fighting teaches, but drills are the planned route. |
| Experience per annual exercise | 5 points | Offsets one `addShip` experience penalty (5) exactly. |
| Role-change penalty | cohesion -10, experience 0 | Equal to a flagship change. |
| Formation-change penalty | cohesion -5, experience 0 | Half a role change; a formation is a preference. |
| Exercise timing | any month, once per calendar year | The manual sets only "once a year". |
| Exercise maintenance | 2 x active, for the month (sourced, p.53) | Manual. |
| Training proficiency | 12 funded months (sourced, p.53) | Manual. |
| Training subjects | at most 2 (sourced, p.53) | Manual. |
| Training maintenance adders | gunnery 3000 bp; night fighting, torpedo tactics, damage control 2000 bp each (sourced, p.53) | Manual. |
| Proficiency effect | +1000 bp on the subject's accuracy or response; gunnery and night fighting sourced (+10%, p.53), torpedo tactics and damage control targeted equal | Manual gives numbers for two subjects; the other two follow them. |

## Decision: not modelled

- **Japan's training discount** (p.53, no figure) is not modelled. ADR-0230 forbids nation-name branches and
  no per-nation training modifier field exists. Recorded as a non-blocking owner observation.
- **The tension consequence of a large exercise** is an extension point for S-3/S-4, with no value.
- **Combat consumption of proficiency** is a separate follow-up; this effort stores and projects proficiency.

## Decision: REPAIR entry

No production path enters REPAIR except seeds, and the ship-design REPAIR project type belongs to the yard
(`UNAVAILABLE`) path. Entering REPAIR from battle damage belongs to a future battle-aftermath effort (T-2 /
T-3). This effort adds no REPAIR entry; the readiness command never targets REPAIR, so nothing blocks it.
The two mechanisms stay separate (#202).

## Decision: compatibility

Training progress, exercise history, battle `absences` and the generalised assignment slot are optional,
additive state. By the ADR-0264 reasoning, `CURRENT_COMPATIBILITY_VERSION` is unchanged while every field
stays optional; making one required or reinterpreting one needs a bump under ADR-0113. Each state ticket
carries its own save-compatibility evidence.

## Consequences

The go-live ticket (#277) is no longer blocked on owner values; it authors this table. Values are tunable
data in the ruleset section, never code constants.
