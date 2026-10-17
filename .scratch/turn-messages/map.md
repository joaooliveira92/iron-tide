# Turn-resolution messages — decision map

**Type:** wayfinder:map
**Status:** resolved
**Handoff:** ready for `spec-creator` → `to-spec` → `to-tickets`
**Effort:** `turn-messages`

## Destination

A **decision-complete architecture charter** for the strategic turn-resolution
message system — the presentation-independent message/interruption substrate, the
deterministic re-execution resume model, the non-authoritative persistence
sidecars, the IPC/renderer boundary, localization under ADR-0209, and the staged
additive migration of `MonthExecutor.execute()` — ready to hand to `spec-creator`
→ `to-spec` → `to-tickets`. **This effort produces decisions, not implementation.**

## Notes

- Local tracker (`.scratch/<effort>/`): one file per ticket in `decisions/`, numbered
  from `01`, with `**Type:**`, `**Status:**`, `**Blocked by:**` lines
  (`docs/agents/issue-tracker.md`).
- Read first: `README.md`, `.ai/ENGINEERING-CONTRACT.md`, `RULES.md`, `CONTEXT.md`,
  and ADRs [0209](../docs/adr/ADR-0209-ui-language-and-formatting-locale.md),
  0216, 0217, 0218.
- Consult `domain-modeling` each session; record new terms in `CONTEXT.md`.
- Skills: `grilling`, `domain-modeling`, `research`.
- Implementation is **out of scope** here; it is sliced by `to-tickets` and built by
  `implementator`.

## Controlling constraints (charter invariants)

1. Decision-complete charter, not implementation.
2. Thin end-to-end vertical slice first, not a full pipeline rewrite.
3. Domain events and campaign snapshots remain authoritative.
4. Messages, summaries, and pending-turn records remain non-authoritative sidecars.
5. Turn resumption = deterministic re-execution from the authoritative pre-turn
   snapshot with recorded external inputs.
6. Exactly-once applies to authoritative **effects**; completed phases may be
   recomputed.
7. No live `MonthContext`, continuation, closure, partial snapshot, `EventLedger`,
   `PhaseGuard`, or command-lifecycle object is ever serialized.
8. `@bluewave/events` and its frozen wire format remain unchanged.
9. `@bluewave/messages` owns the presentation-independent schemas, projection,
   policy, provenance, aggregation, and interruption contracts.
10. Projection and aggregation are pure, total, deterministic, versioned,
    canonically ordered, and free of ambient state.
11. The phase engine receives only the minimum additive interruption/input seam.
12. S-4 owns authored crisis and decision content.
13. T-1 owns battle-offer policy and gameplay rules.
14. This effort owns the generic decision and battle request/result protocols plus
    pause, persistence, validation, reload, replay, and resume behavior.
15. Existing authoritative save formats and compatibility versions are unchanged.
16. Missing sidecars are valid.
17. Stale or incompatible pending-turn records are never trusted or speculatively
    migrated.
18. The single allowlisted `campaign:execute` IPC surface is the only campaign
    command boundary.
19. Renderer code receives validated DTOs and never engine objects.
20. Localization uses stable keys, compiled content catalogues, en-US fallback,
    locale-independent formatting, and no raw production keys.
21. Every migration stage independently passes repository gates.
22. S-4 and T-1 are blocked downstream of the interruption-seam tickets, not
    absorbed into this effort.

## Locked decisions

<!-- Decisions locked in charting rounds 1–3. A decision lives in exactly one
place — its ticket; these are gists + links. -->

**Round 1 — root and scope**

- [D-01 Destination: decision-complete architecture charter](decisions/01-destination-charter.md): decisions only; hand to `spec-creator` → `to-spec` → `to-tickets`.
- [D-02 Scope boundary vs S-4 / T-1](decisions/02-scope-boundary.md): substrate + minimum interruption mechanism; S-4/T-1 keep their content and gameplay.
- [D-03 First increment: thin end-to-end vertical slice](decisions/03-first-increment.md): economy/construction/research/diplomacy + persisted messages, one decision and one battle interruption; widen later.
- [D-04 Messages are derived, non-authoritative](decisions/04-derived-nonauthoritative.md): domain events authoritative; messages are rebuildable projections with provenance, excluded from the state hash.

**Round 2 — substrate and transaction roots**

- [D-05 Resumable turn model: deterministic re-execution](decisions/05-resume-model.md): resume re-executes the month from the pre-turn snapshot with recorded inputs; no engine state serialized; exactly-once effects.
- [D-06 Message substrate: new `@bluewave/messages` package](decisions/06-messages-package.md): schemas, projection, policy, provenance, aggregation, interruption contracts; runtime-free; projection is a post-turn function, not a phase.
- [D-07 Pure, versioned notification policy](decisions/07-notification-policy.md): total deterministic function, canonical ordering, stable grouping/dedup, declared `projectionVersion`, no ambient state.
- [D-08 Generic S-4 / T-1 ports only](decisions/08-s4-t1-ports.md): own interruption protocols + provenance plumbing; S-4/T-1 own content and gameplay.
- [D-09 Sidecar-only compatibility stance](decisions/09-sidecar-compat.md): no snapshot/hash/signature/compatibility change; missing sidecars valid; stale pending-turn never migrated.

**Round 3 — ledger, persistence, surfaces, migration**

- [D-10 Persistence file shapes & validation invariants](decisions/10-persistence-shapes.md): `pending-turn.json` + `turn-summaries.json`, strict decode, authoritative-revision/version/hash checks, reconstruct-or-report.
- [D-11 Separate turn-summary sidecar](decisions/11-summary-sidecar.md): `turn-summaries.json`; `monthly-reports.json` stays presentation history.
- [D-12 Interruption identity, ordering, input consumption](decisions/12-interruption-identity.md): `turnId`/`interruptionId` hashing; strict ordinal consumption; no guessing.
- [D-13 Localization catalogue & fallback](decisions/13-localization.md): keys/interpolation engine-side; en-US as compiled content; renderer fallback; ADR-0209/0218.
- [D-14 IPC commands, queries, schemas, capability boundary](decisions/14-ipc-boundary.md): `resolveTurn`, `answerDecision`, `submitBattleResult`, `readTurnSummaries`, `abandonPendingTurn` on the one channel; validated DTOs only.
- [D-15 Renderer surfaces](decisions/15-renderer-surfaces.md): summary panel, decision modal, battle-request modal, history, recovery.
- [D-16 `@bluewave/messages` package & repository layout](decisions/16-package-layout.md): package files + app-level hosts; acyclic graph.
- [D-17 Staged migration of `MonthExecutor.execute()`](decisions/17-staged-migration.md): six additive stages; no flag-day; each gate-green.
- [D-18 Test requirements](decisions/18-tests.md): unit/parity/determinism/save-load/interruption/rollback/E2E.
- [D-19 Handoff order](decisions/19-handoff-order.md): spec-creator → to-tickets → implementator; seam → commands → renderer → E2E.

**Research resolved (validates the decisions above)**

- [R-20 Determinism & re-execution parity](decisions/20-research-determinism-parity.md): same-host re-execution is bit-identical (keyed streams rebuilt per `execute`); external battle result needs the M2 seam; localeCompare flagged cross-host.
- [R-21 Additive interruption-seam feasibility](decisions/21-research-additive-seam.md): additive `MonthResult` field (never repurpose `success`), channel not a `PhaseResource`, no new event kind ⇒ zero golden repinning.
- [R-22 IPC command-surface mechanics](decisions/22-research-ipc-mechanics.md): 10-step checklist; one channel, no preload change; registration/`IMPLEMENTED_COMMANDS` parity enforced; suspended = success DTO.
- [R-23 UI-string content catalogue path](decisions/23-research-catalogue-path.md): no catalogue exists; copy the `presentation.yaml` compiler pipeline; renderer-side resolver + ADR-0209 fallback.
- [R-24 Sidecar & save/recover mechanics](decisions/24-research-sidecar-mechanics.md): sidecars at `saveDir` root; tolerant read/strict decode/atomic write; validate against authoritative revision; abandon touches no `SaveStore` state.
- [R-25 S-4 / T-1 seam ground-truth](decisions/25-research-s4-t1-seam.md): ports greenfield; combat opportunity/acceptance types ground them; block S-4/T-1 on M2 (M3/M4 for full flows); battle tie/null flag.

## Seam contracts with S-4 and T-1

This effort defines **only** the protocols and plumbing; the ports below are the
whole interface. Both seamed through D-12 identity, D-10 persistence, D-05 resume.

### Decision seam (owner: S-4)

- **This effort provides:** `DecisionRequest` (`interruptionId`, `turnId`, title/
  body keys + interpolation, involved nations, 2–4 `DecisionOption`s with
  qualitative outcome hints, expiry, `interruptionOrdinal`) and `DecisionAnswer`
  (`interruptionId`, chosen `optionId`, hash). The decision-interruption hook
  (pause, persist, validate, resume) and provenance/`EffectReference` plumbing.
- **S-4 retains:** crisis catalogue and authored content, eligibility conditions,
  deterministic base effects, randomised effects, follow-up event ids, AI-selection
  weights, historical-period tags, localization keys/text.
- **Seam invariant:** the engine applies only what S-4 supplies as effects; the
  protocol never authors content.

### Battle seam (owner: T-1)

- **This effort provides:** `BattleRequest` (`interruptionId`, `turnId`, battle id,
  participating nations/regions, eligible forces, mission placeholder) and
  `BattleResult` (`battleId`, validated outcome, per-ship damage/losses, VP/
  prestige deltas). The battle-interruption hook and one-time battle-result import.
- **T-1 retains:** offer/accept/decline policy, VP and prestige costs, force
  composition, support-force rules, mission selection, briefing presentation.
- **Seam invariant:** the strategic resolver applies a recorded `BattleResult`
  exactly once as an external input; it never re-rolls a player-resolved battle.

## Downstream dependency (cross-effort)

Delivery stages (D-17) that S-4 and T-1 are blocked downstream of:

| Stage | Content | Blocks |
| --- | --- | --- |
| **M1** | `@bluewave/messages` schema + pure projection/policy | *(S-4 can design against the schema)* |
| **M2** | phase-engine additive interruption/input seam | **S-4**, **T-1** |
| **M3** | application commands + sidecars (`resolveTurn`, `answerDecision`, `submitBattleResult`, pending-turn, summaries) | S-4, T-1 end-to-end |
| **M4** | renderer surfaces | S-4, T-1 UX |
| **M5** | E2E + gates | — |

S-4 and T-1 are **separate efforts**; they are not ticketed here. When their maps
are charted, their tickets must declare `Blocked by:` the M2 (and, for full flows,
M3/M4) delivery tickets once those exist.

## Flagged risks (not locked-decision contradictions)

Research surfaced two issues that do **not** invalidate any locked decision:

1. **`localeCompare` in `@bluewave/combat` orderings** (R-20) — a pre-existing
   cross-host/ICU determinism risk (`generation/opportunity.ts:114-117`,
   `eligibility.ts:83-92`, `damage/ordering.ts:26-30`, `submarines/submarineRecords.ts:37-77`,
   …), contrary to `deterministic/src/index.ts:12-20`. It does not break same-host
   resume. **Recommendation:** a separate, out-of-effort remediation ticket to use
   `compareCodePoints`; not part of this charter.
2. **Battle tie/null representation** (R-25) — campaign `BattleResult` permits
   `winnerId/loserId = null` (`campaign/src/state.ts:198-199`, ADR-0026 §7) while
   the frozen `BattleResolved` body requires non-empty strings
   (`events/src/validation.ts:105-110`). The `BattleResult` **port** carries nullable
   winners; the event stays unemitted. No charter change.
3. **DTO file location** (R-22) — D-16 proposes `apps/desktop/src/shared/turn-contract.ts`;
   the existing convention keeps DTOs in `campaign-command-contract.ts`. Either is
   acceptable; a spec-level detail.

## Not yet specified

<!-- In-scope fog; graduates once the frontier clears. -->

- Exact DTO **field sets** for `TurnMessage`, `DecisionRequest/Answer`,
  `BattleRequest/Result`, `EntityReference`, `EffectReference` — spec-level
  implementation decisions (graduate to `spec-creator`; R-24/R-25 resolved).
- Renderer **information architecture** detail for the summary feed, filters, and
  history (candidate for a `prototype` ticket if UX uncertainty remains).
- Whether a summarised-event **drill-down** interaction is required for aggregation
  groups (UI only).
- Retention window for `turn-summaries.json` (mirror `monthly-reports.json`'s
  limit or unbounded-with-a-cap; decide during spec).

## Out of scope

- Any **implementation** code (this effort is charter-only).
- Authored crisis/event **content** and encounter selection → **S-4**.
- Battle-offer **gameplay policy** (accept/decline, costs, forces, missions) → **T-1**.
- Full 17-phase interruption coverage in the first increment (wide phase coverage
  is incremental, post-slice).
- Tactical battle **combat engine** changes.
- Localization **runtime**/translation pipeline beyond keyed catalogue + en-US
  fallback (ADR-0209 governs; no placeholder languages).
- Phase-boundary **memoization** (a later performance optimization, not a prerequisite).
