# R-21: Additive interruption-seam feasibility & golden/parity inventory

**Type:** research
**Status:** resolved
**Blocked by:** None

## Question

Can `MonthResult` and `MonthContext` gain an additive interruption/input channel
and a `suspended` outcome **without** changing existing golden hashes, the
cross-process determinism harness, or the frozen `@bluewave/events` wire format?
Enumerate the exact golden artifacts, parity tests, and snapshots that the
additive stages (D-17) must keep green, and the golden-repinning policy.

Specifically:

- Inventory goldens/parity: `snapshotToHashable` parity, cross-process child
  checks, phase-engine tests, `commitMonth` byte-identity assertions, event-body
  validation fixtures.
- Where a `suspended` result would sit relative to `MonthResult.success` and the
  `finish()` path.
- Whether the battle phases can raise a request without emitting the currently
  unemitted `BattleInitiated`/`BattleResolved` events (which would change the
  frozen event surface).
- The phase-registry/`PhaseGuard` footprint implications of a new input channel.

## Answer

**Resolved — yes, an additive seam is achievable with zero golden repinning**,
if and only if: (a) the input channel is absent in every golden/cross-process
fixture; (b) `MonthResult` gains a **new optional field** (e.g.
`outcome?: "completed" | "suspended"`) and never repurposes `success`; (c) the
channel is **not** a `PhaseResource`; (d) no new `@bluewave/events` kind/schema
change.

- **The only absolute golden** is `golden/hashes.json` (10 hashes + `success`),
  compared in `cross-process-test/test/cross-process.test.ts:55-72`. It hashes
  `finalSnapshot` + ledger hashes + replay/battle derivations
  (`run-child.ts:281-285,311-321,200-255`) — **never `MonthResult`**. `hashSnapshot`
  covers only the snapshot subset (`replay.ts:44-89`). So additive `MonthResult`/
  `MonthContext` fields are invisible to it. No other test in these packages pins
  an absolute 64-hex constant.
- **`success` consumers that must not break:** `commitMonth.ts:137`,
  `run-child.ts:338`, `cross-process.test.ts:40-41`,
  `monthAdvance.perf.test.ts:47`. A suspended month must keep `success:true` (or the
  golden scenario never suspends) and carry the new optional field.
- **PhaseGuard/registry:** `PhaseResource` is a closed snapshot-domain enum
  (`phase-guard.ts:8-19`); `MonthContext` keys are outside the footprint model
  (`phase-guard.ts:175-200`; `month.ts:230-240`). Adding a context field needs **no**
  `PHASE_FOOTPRINTS`/registry change as long as it is not modeled as a resource.
- **Events:** `BattleInitiated`/`BattleResolved` are defined but never emitted
  (`envelope.ts:79-92`; `battleOutcomes.ts:18-24`). Emitting them would change
  `eventLedgerHash` and require a wire-parity fixture (`validation.test.ts:32-43`).
  The interruption must stay a phase-engine-level signal, not a `DomainEventBody`.
- **Repinning policy:** `docs/agents/golden-repinning.md`; default-off seam ⇒ no
  repin. Enabling interruption later is a new input ⇒ deliberate repin with cause.

Confirms D-17 stage 1 is additive and safe.
