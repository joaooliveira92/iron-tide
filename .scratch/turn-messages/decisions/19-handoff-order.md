# D-19: Handoff order to spec-creator → to-spec → to-tickets

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

How does this charter hand off, and in what dependency order does delivery proceed?

## Answer

Handoff: the map closes its remaining decisions → `spec-creator` writes
`.scratch/turn-messages/spec.md` (to-spec) → `to-tickets` slices tracer-bullet
tickets with blocking edges → `implementator` works the frontier.

Dependency order: messages schema → pure projection/policy → phase-engine
interruption seam → application commands + sidecars → renderer → E2E; S-4/T-1
blocked downstream of the seam tickets (delivery stage `M2`).

(Locked round 3.)

## Consequence

Consumed by D-01, D-08, D-02. `spec-creator` may start when all research tickets
(R-20…R-25) resolve.
