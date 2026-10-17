# D6: Repair and wartime maintenance

**Type:** grilling · **Status:** resolved

## Question

How are the repair premium and wartime maintenance represented?

## Answer

Repair is represented as a readiness state (`REPAIR`) with a remaining-months
counter, charged at about **2× active** maintenance (p.51, grounded). Mothballing
halts repair and drops the premium (grounded, p.51). Wartime maintenance is a single
ruleset multiplier applied to active-status maintenance while the nation is at war,
read from existing war/diplomacy state (`resolve_diplomacy` / `wars`); the
magnitude is a value the manual omits ("rises sharply", p.52) → decision request
0007.

Transition time and any one-off cost between readiness states are **not** modelled:
the manual states only that reserve and mothballed ships take time to regain
effectiveness (p.51) and gives no durations or costs. Only the recurring rate
changes, through D3's single charging path.

## Why

Repair ×2 and "wartime maintenance rises sharply" are the manual's only
maintenance-by-status figures beyond mothballed. Modelling repair as a readiness
state reuses the one charging path instead of a parallel repair-cost system, and the
wartime rise is a single tunable constant rather than a second formula.
