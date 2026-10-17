# D-14: IPC commands, queries, schemas, and capability boundary

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

What commands does the renderer get, and what is the capability boundary?

## Answer

Add to the **single allowlisted surface** (schema-validated,
`onExcessProperty:"error"`, overloads kept in sync):

- `resolveTurn` (start/resume; returns `completed` summary **or** `suspended` +
  interruption request)
- `answerDecision`
- `submitBattleResult`
- `readTurnSummaries` (query)
- `abandonPendingTurn` (clears non-authoritative pending state only)

**No new IPC channel**; the renderer receives plain DTOs, never engine objects;
decisions/battle results are validated at the command boundary. `commitMonth` is
retained and delegates to the no-interruption fast path of `resolveTurn`.

(Locked round 3.)

## Consequence

Grounded by R-22. Consumed by D-15, D-19.
