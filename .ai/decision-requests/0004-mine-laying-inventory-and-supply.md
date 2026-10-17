# Decision Request: Operational mine-laying inventory and supply

## Status

Blocked pending owner decision. Blocks only mine-warfare ticket 03 (operational
mining phase); tickets 01, 02, 04, 05, 07 do not depend on it.

## Trigger

The engine's mine-laying contract requires every laying action to declare an
exact on-hand mine inventory or a scenario allocation, and consumes it. The
campaign has no inventory, stockpile or replenishment model for ships. The manual
says operational mining is "abstracted" and that mine-equipped ships "will be
assumed to carry out mining in the area they are deployed", and states no stock,
cost or replenishment rule.

## Evidence

- Manual p.74 ("Mine warfare"): mine value of an area comes from ships equipped to
  lay mines; sweeping value compared with enemy laying capability; no inventory
  mentioned. p.36 (coastal artillery) and p.130 (corvettes) add only qualitative
  effects.
- Engine: `packages/combat/src/mines/laying.ts` (`consumeMineInventory`) and
  `sources.ts` (`MineLayingInventory`: DECLARED or SCENARIO_ALLOCATION).
- The governing design note the code cites (DESIGN-35) is absent from this
  checkout (ADR-0210: unavailable, unverified); code comments mark some constants
  as "authored, not shipped".
- Campaign ship state carries no mine inventory field.

## Why agent judgment is insufficient

Unlimited per-month laying, a replenished per-ship allotment, and a depleting
stockpile give different mine pressure over a war and so different strike rates
and outcomes. The manual does not choose between them.

## Options

### Option A: Per-ship monthly allotment, no stockpile (recommended)

- Behavior: each equipped ship in an area is granted its design's laying capacity
  each month as a DECLARED inventory consumed that month; nothing carries over.
- Advantages: matches "abstracted"; needs no new content or state; deterministic.
- Risks: cannot model running out of mines.
- Compatibility impact: none beyond the new pressure state.
- Migration impact: none.
- Scope and effort: small; fits ticket 03 as written.

### Option B: Persistent stockpile per nation

- Behavior: a national mine stock is spent by laying and replenished by an
  appropriation line.
- Advantages: richer; supply pressure becomes a decision.
- Risks: invents a new budget line and numbers the manual lacks; UI scope grows.
- Compatibility impact: new nation state and budget interaction.
- Migration impact: re-pin goldens.
- Scope and effort: medium, plus research for values.

### Option C: Unlimited laying through SCENARIO_ALLOCATION

- Behavior: treat every equipped ship as a scenario allocation sized by capacity.
- Advantages: simplest.
- Risks: labels an authoritative allocation as scenario-generated; weak
  provenance.
- Compatibility impact: none. Scope and effort: smallest.

## Recommendation

Option A, recorded as an ADR, with Option B listed as a future expansion.
Do not implement before approval.

## Work safely completed while blocked

Compiled capability (01), area pressure state (02), sweeping (04), strike risk
(05), projection (06) and design/fleet surfaces (07) are specified independent of
this choice.
