# Map: S-2 Prestige and career

**Label:** wayfinder:map · **Status:** charted, all route decisions resolved;
one value decision escalated.

## Destination

A spec and a ticket set for sprint S-2 (`.ai/SPRINT-PLAN.md`): a nation's prestige
exists in authoritative campaign state, moves by proportional loss and sourced
gains, can end the player's career by sacking, and yields a final score. The
way to implementation must be unambiguous; no implementation happens in this
effort.

## Notes

- Authority order per ADR-0210; manual pp.12-13, 58, 61-62 govern mechanics.
  Simulation matches Rule the Waves 3; only UI/UX may deviate.
- Resolved by the orchestrator without a live human (user directive: run
  autonomously). Each decision below is derived from a higher authority, not a
  gameplay preference; values the manual lacks are escalated, not invented.
- Skills: `to-spec`, `to-tickets`, `tdd` for implementation later.

## Decisions so far

- [D1 Scope boundary](decisions/D1-scope-boundary.md): S-2 owns the prestige
  mechanism and the sources that already exist (unpaid funds, war and battle
  outcomes); every other source is a named seam for its own sprint.
- [D2 Representation and seeding](decisions/D2-representation-and-seeding.md):
  required integer field on every nation, authored per nation in content,
  introduced under a compatibility-version bump.
- [D3 Loss and gain rule](decisions/D3-loss-and-gain-rule.md): one ledgered delta
  seam; loss proportional in basis points of current prestige with checked
  integer rounding; gains are fixed magnitudes per source.
- [D4 Sacking](decisions/D4-sacking.md): player nation only, at or below 16, a
  domain-separated seeded draw each month in a dedicated phase; terminal career
  state, not a crash.
- [D5 Final score and Hall of Fame](decisions/D5-final-score-and-hall-of-fame.md):
  S-2 produces the career result; Hall of Fame storage waits for the
  preferences/profile persistence of U-2.
- [D6 Production values](decisions/D6-production-values.md): escalated as
  decision request 0003; structural tickets use fixture-class values.

## Not yet specified

- How prestige interacts with events' "spend prestige" answers (S-4) and
  national characteristics such as Cautious (not modelled yet).
- Whether AI nations ever lose office (A-1) and how that is shown.

## Out of scope

- Events, hawk/dove answers, spending prestige (S-4).
- Unrest and budget pressure (S-3); readiness (S-1); foreign stations (S-5).
- Battle offer, decline cost, trade protection, officer prestige costs (T-1, W-1,
  W-6): each registers a source through the D3 seam in its own sprint.
- Hall of Fame persistence and screen (U-2/F-4).
