# Campaign economy glossary

The economy context of Bluewave: one term, one meaning. The model is
[ADR-0230](../../docs/adr/ADR-0230-campaign-economy-model.md); the shared root
vocabulary is [CONTEXT.md](../../CONTEXT.md).

- **Treasury unit (TU)** — the unit of every economy figure: £10,000 (ADR-0216).
- **Treasury** — the stock of money a nation holds. Never negative.
- **Monthly gross naval appropriation** — authored `income`: the money credited to the
  treasury each month at the 2000 bp start rate. After the start state it is derived, not read.
- **Economic base** — `baseResources`: the derived annual stock the appropriation is taken
  from, `ceil(income × 120000 / startRate)`. Set once at compile.
- **Appropriation rate** — `navalAppropriationRateBp`: the player-set share of the base, 500–5000 bp.
- **Revenue** — the monthly flow `floor(base × rate / 120000)`.
- **Fixed obligations** — authored `expenses`: the monthly cost a nation always owes.
- **Maintenance** — the monthly cost of keeping ships, by readiness; higher at war.
- **Research allocation** — the authored annual figure. **Standing research spend** — the
  monthly runtime figure, `floor(annual / 12)`. **Research cap** — 12% of monthly revenue.
- **Construction capacity** — how fast a project can be worked: yard throughput per line,
  plus the tonnage concurrency cap of 3 × the national dock. Never derived from the base.
- **Construction draw** — the treasury units a month's construction takes; an upper bound in
  a projection, an exact figure in the ledger.
- **Shortfall** — the unpaid part of an outflow in a month the treasury cannot cover. Recorded
  as `requested`, `paid` and `shortfall`; not carried. **Structural deficit** — a net before
  construction below zero at the start.
- **Runway** — whole months the treasury lasts at a negative net.
- **Ledger entry** — one posting with `requested`, `paid` and `shortfall`; the month closes on `paid`.
- **Projection** — a read-only view of the month ahead from the same calculators the engine
  uses (`economyOutlook`): exact lines (revenue, obligations, maintenance, research) and
  bound lines (construction).

Retired: bare **"budget"**. Say appropriation, allocation or spend.
