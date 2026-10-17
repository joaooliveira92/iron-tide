# D4: Crew quality and ramp

**Type:** grilling · **Status:** resolved

## Question

How does crew quality behave, and how does it connect to the engine?

## Answer

A per-ship crew-quality integer `0..100` that, in the maintenance phase, moves each
month toward its readiness state's ceiling by a ruleset ramp rate — deterministic,
no RNG. Active ships seed at the active ceiling; reserve, mothballed and reactivated
ships seed lower and climb. Working-up ends when crew quality reaches the "decent"
threshold, at which point the player may change the state (never back to
working-up, p.51). The value is supplied to combat's existing inputs: the
`crewQualityBp` band (`0..10_000`, today the neutral `7_000`) and the readiness
value combat already consumes (`resolveReadiness`, today the constant `80`).

The ceilings, the ramp rate and the "decent" threshold are values the manual omits
(decision request 0007); fixture-class constants until then. Named crew grades are
presentation (ADR-0202) and out of scope.

## Why

The manual describes crew quality only comparatively ("best trained" active,
reservists and poorly-trained crews taking "time"/"substantial time", p.51) and gives
no grades and no schedule. The engine already models crew quality as a `[0,10_000]`
band the combat modules accept, so the campaign supplies that value instead of
inventing a second model, and the ramp is tied to the status the manual ties it to
rather than to an unstated sea-time counter.
