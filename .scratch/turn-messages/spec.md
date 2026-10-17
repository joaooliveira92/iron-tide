# Spec: Turn-resolution messages

**Status:** ready-for-agent · **Map:** `map.md` · **Decisions:** `decisions/` ·
**Authority:** ADR-0209 (UI language/locale), ADR-0216/0217/0218 (money, rounding,
locale boundary), ADR-0036 (phase guard), ADR-0007 (golden repinning), ADR-0220
(worktree per effort) · **Gating:** existing `MonthExecutor` goldens must stay
byte-identical (decisions D-05, D-17; research R-20, R-21).

## Problem Statement

Pressing **Turn** advances the campaign calendar, but what the player gets back is
not a report — it is a flat list of ad-hoc English strings. There is no structure,
grouping, severity, filtering, or entity link; warnings and material outcomes sit
at the same weight as routine arithmetic; and the text is built inline at the
desktop boundary rather than keyed and localized. From the player's side this means
a turn that resolves construction, research, diplomacy, intelligence, and finances
cannot be scanned, cannot be searched, cannot be revisited, and cannot be trusted
to surface the one thing that mattered.

Three capabilities the genre demands are entirely absent. There is **no
notification model**: the nearest thing, `StrategicPriority`, is derived from the
current snapshot, unkeyed, and unrelated to a turn's outcome. There is **no
mandatory-decision mechanism**: the game cannot ask the player to respond to a
crisis, appropriate funds, or answer a government demand mid-resolution. There is
**no battle offer**: battles auto-resolve inline, so the player can never accept or
decline one. And because `MonthExecutor.execute` is a single synchronous function
that must run to completion, a turn cannot be paused, persisted, reloaded, and
resumed: closing the app during resolution loses the month.

From the team's side the substrate is missing in the same places. `@bluewave/events`
records authoritative domain events but has no player-facing projection; the
desktop flattens envelopes into unkeyed strings; the renderer owns nothing
authoritative and has no validated DTOs to render a summary from; and the two
sprints that need this most — S-4 "Events and crises" and T-1 "Battle offer flow"
— have no ports to plug into.

## Solution

A **deterministic, non-authoritative turn-message system** that explains a month
without ever owning authoritative state:

- A new runtime-free `@bluewave/messages` package owns the message schema, the
  interruption protocols, a pure versioned notification policy, provenance,
  deterministic aggregation, and deduplication.
- The phase engine gains a **minimal additive seam**: a suspended outcome and an
  input channel. No engine object is serialized. Resume **re-executes** the month
  from the authoritative pre-turn snapshot with the recorded external inputs.
- The application persists two **non-authoritative sidecars** at the save root:
  `pending-turn.json` (the suspended turn) and `turn-summaries.json` (the message
  history). Missing sidecars are valid; stale ones are never trusted.
- The renderer receives validated DTOs over the existing single IPC surface and
  shows a grouped, filterable turn summary plus blocking decision and battle
  dialogs.
- Ships as a **thin end-to-end vertical slice** across the economy, construction,
  research, and diplomacy phases, with one representative decision and one
  representative battle interruption, then widens incrementally.

S-4 and T-1 keep their content and gameplay; this system provides only the ports.

## User Stories

1. As a player, I want pressing Turn to produce a structured, grouped summary of
   what happened, so that I can understand the month at a glance.
2. As a player, I want routine outcomes (keel laid, ship progressed, routine
   repairs) aggregated into a category section rather than one line each, so that
   the important items are not buried.
3. As a player, I want capital-ship completions, first-of-class vessels, and
   breakthroughs highlighted above routine completions, so that I notice what
   matters.
4. As a player, I want each message to carry a severity, so that I can tell a
   critical event from routine arithmetic.
5. As a player, I want warnings (negative projected balance, construction delay,
   insufficient range, colonial-tonnage shortfall, overdue maintenance, low trade
   protection, increasing unrest, war-level tension, inadequate dock capacity) to
   persist and be actionable, so that I can address them.
6. As a player, I want every actionable message to link to the relevant ship,
   class, nation, region, technology, project, formation, or battle, so that I can
   inspect or fix it.
7. As a player, I want a required decision to appear as a modal that blocks
   advancing until I answer, so that I cannot skip a consequential choice.
8. As a player, I want each decision option to show qualitative consequence hints
   (direction and rough magnitude), so that I can choose without seeing hidden
   calculations.
9. As a player, I want the Continue control disabled while a blocking decision is
   unresolved, so that I cannot advance past it.
10. As a player, I want after choosing an option to see a result message describing
    what changed, so that my choice feels consequential.
11. As a player, I want a battle request to interrupt resolution and let me accept,
    decline, or delegate (as T-1's policy permits), so that I participate in
    battles when I want to.
12. As a player, I want a battle's result to be applied to ships, losses, victory
    points, and prestige exactly once, so that reloading cannot double-count it.
13. As a player, I want to close the app during a decision or battle and resume the
    same turn on reload, so that I do not lose the month.
14. As a player, I want a turn with multiple interruptions (a decision then a
    battle) to resolve and resume in order, so that complex months work.
15. As a player, I want a load with a pending turn to prompt me to resume, so that
    I know a month is outstanding.
16. As a player, I want an "abandon pending turn" path that starts the month fresh
    without corrupting my save, so that I can recover from a bad state.
17. As a player, I want a save with no sidecars (an older save) to load normally,
    so that upgrading never breaks my campaign.
18. As a player, I want a stale or incompatible pending turn to be reported as
    unavailable rather than silently misapplied, so that my campaign stays correct.
19. As a player, I want summaries for previous turns to be inspectable, so that I
    can review history.
20. As a player, I want a permanent campaign log, so that earlier outcomes are never
    lost.
21. As a player, I want to filter the summary by category and severity, so that I
    can focus.
22. As a player, I want a "show only actionable" mode, so that I can see what needs
    me.
23. As a player, I want to search the summary, so that I can find a specific ship
    or nation.
24. As a player, I want to pin and mark messages read without deleting them, so that
    my campaign history stays intact.
25. As a player, I want links to sunk, scrapped, or otherwise unavailable entities
    to open a read-only historical record instead of failing, so that old messages
    remain meaningful.
26. As a player, I want messages to explain the gameplay effect of a research
    breakthrough or capability unlock, so that I know what changed.
27. As a player, I want movement and construction failures to never be silent, so
    that I understand why something did not happen.
28. As a player, I want war declaration and peace transitions applied exactly once,
    so that reloading cannot re-declare a war or re-apply a treaty.
29. As a player, I want the summary text in my UI language with an English fallback,
    so that I never see raw keys or untranslated placeholders.
30. As a player, I want number and date formatting to respect my formatting locale
    independently of UI language, so that currency and dates read naturally.
31. As a player, I want a war-start interruption that tells me the enemy, date,
    allies, affected regions, trade-protection changes, and new wartime controls,
    so that I know what to do next.
32. As a player, I want a peace transition to summarize participants, date,
    territorial changes, reparations, prestige, war score, interned/transferred/lost
    ships, and treaty restrictions, so that I understand the settlement.
33. As a player, I want a wartime-operations summary (commerce warfare, trade
    protection, raiders, submarines, mines) rather than unstructured strings, so
    that operations read consistently.
34. As a player, I want a financial summary section (appropriation, maintenance,
    construction, research, closing balance) with material changes called out, so
    that I understand my position.
35. As a player, I want a deficit to raise a warning and an unaffordable committed
    project to raise a high-severity warning or decision, so that I am not surprised.
36. As a player, I want intelligence reports to distinguish confirmed from probable,
    estimated, obsolete, or unverified information, so that I do not treat guesses
    as facts.
37. As a developer, I want every visible message to originate from a structured
    domain event, so that text is a projection, not a source of truth.
38. As a developer, I want messages keyed and localized rather than hard-coded, so
    that localization can be added without touching engine logic.
39. As a developer, I want the same pre-turn snapshot, committed orders, ruleset,
    content, and recorded inputs to produce identical results, so that replay and
    resume are trustworthy.
40. As a developer, I want projection and aggregation to be pure, total, and
    versioned, so that they are testable and reproducible.
41. As a developer, I want the phase engine to change only additively, so that
    existing golden hashes and the cross-process determinism proof stay green.
42. As a developer, I want `@bluewave/events` and its wire format untouched, so that
    the domain-event contract stays frozen.
43. As a developer, I want the message schema, projection, policy, and interruption
    protocols to live in a runtime-free, presentation-independent package, so that
    domain logic never depends on React, Electron, IPC, or the renderer.
44. As a developer, I want decisions and battle results validated at the IPC
    boundary and only DTOs to reach the renderer, so that the renderer never owns
    authoritative state.
45. As a developer, I want S-4 (crises) and T-1 (battle offers) to plug into the
    same generic ports, so that gameplay content is not hard-coded into the message
    system.
46. As a developer, I want the migration staged so each stage independently passes
    the repository gates, so that no flag-day rewrite is required.

## Implementation Decisions

### Package and ownership

- Build a new runtime-free `@bluewave/messages` package that owns the `TurnMessage`
  schema, `EntityReference`/`EffectReference`, the interruption contracts, the pure
  notification policy, provenance, aggregation, deduplication, and error types.
  It imports only the runtime-free Effect subset (`Schema`, `SchemaIssue`, `Data`,
  `Equal`, `Hash`, `Option`, `Predicate`, `Result`) and depends on `@bluewave/campaign`,
  `@bluewave/events`, `@bluewave/contracts`, `@bluewave/deterministic`, and
  `@bluewave/content-schema`. It never depends on `phase-engine` or desktop packages.
- Projection runs as a **post-turn pure function** invoked by the application
  layer, **not** as an authoritative month phase.
- `@bluewave/events` and its frozen wire format are **unchanged**; no new event kind.

### Message record (from the implementation brief)

```ts
type TurnMessage = {
  id: string; turnId: string; occurredAt: CampaignDate; phase: TurnPhase;
  category: MessageCategory; severity: "CRITICAL" | "HIGH" | "NORMAL" | "LOW" | "TRACE";
  titleKey: string; bodyKey: string;
  interpolation: Record<string, string | number | boolean>;
  subjectRefs: EntityReference[]; effectRefs: EffectReference[];
  blocking: boolean; requiresAcknowledgement: boolean;
  decisionId?: string; battleId?: string;
  deduplicationKey?: string; aggregateKey?: string;
  playerVisible: boolean; debugMetadata?: DebugMetadata;
};

type EntityReference =
  | { type: "ship"; id: string } | { type: "shipClass"; id: string }
  | { type: "nation"; id: string } | { type: "region"; id: string }
  | { type: "technology"; id: string } | { type: "constructionProject"; id: string }
  | { type: "battle"; id: string } | { type: "formation"; id: string };

type EffectReference = {
  target: EntityReference; attribute: string;
  previousValue?: string | number | boolean;
  newValue?: string | number | boolean; delta?: number;
  visibility: "exact" | "qualitative" | "hidden";
};
```

`TRACE` messages are developer-only and never appear in the player interface.
Messages are derived and excluded from the campaign state hash.

### Interruption protocols (ports owned by this effort)

- `DecisionRequest` / `DecisionAnswer` and `BattleRequest` / `BattleResult`, plus
  the pause, persist, validate, replay, and resume behaviour around them.
- `turnId = H(campaignId, startingRevision, committedOrderHash, orderedInputsHash)`;
  `interruptionId = H(turnId, phase, ordinal, subjectKey)`, `ordinal` assigned in
  deterministic emission order.
- Recorded inputs are consumed **strictly by ordinal**: present and hash-valid →
  apply and continue; absent → emit the request and suspend. Extra, missing, or
  hash-mismatched inputs are a suspension error, never a guess.
- **S-4 retains** crisis content, eligibility, authored choices, effects, AI
  weights, narrative catalogues, and localization keys/text.
- **T-1 retains** battle-offer policy, accept/decline rules, costs, force
  composition, support forces, missions, and briefing presentation.
- This effort applies only the effects S-4/T-1 supply; it never authors content.

### Resume model

- A suspended turn resumes by **deterministic re-execution of the month from the
  authoritative pre-turn snapshot** with the accumulated recorded inputs.
- No live `MonthContext`, continuation, closure, partial snapshot, `EventLedger`,
  `PhaseGuard`, or command-lifecycle object is ever serialized.
- "Must not rerun completed phases" is an **exactly-once authoritative-effects
  guarantee**, not a ban on recomputation. Phase-boundary memoization is a later,
  optional optimization.

### Phase-engine seam (minimal, additive)

- `MonthResult` gains a new optional outcome field and an interruption/input
  channel; **`success` is never repurposed** (R-21).
- The channel is **not** a `PhaseResource`, so `PhaseFootprints`/registry are
  untouched; it draws no randomness.
- Battle resolution consults a recorded external `BattleResult` instead of
  re-rolling; the strategic resolver never re-rolls a player-resolved battle.
- Default behaviour (no interruptions in a golden scenario) stays byte-identical.

### Persistence (non-authoritative sidecars)

- `pending-turn.json` at the save root: `{ schemaVersion, projectionVersion, turnId,
  campaignId, playerNationId, startingRevision, rulesetVersion, compatibilityVersion,
  contentHashes, committedOrderHash, recordedInputs[], nextInterruptionOrdinal,
  createdAt }`, where `recordedInputs[] = { ordinal, kind: "decision"|"battle",
  interruptionId, payload, inputHash }`.
- `turn-summaries.json`: entries keyed by `turnId`, carrying `projectionVersion`,
  source domain-event ids, entity/effect refs, and ruleset/content versions.
- Both: **tolerant read** (missing/corrupt → valid empty), **strict decode**
  (`onExcessProperty: "error"`), **atomic write** (tmp + rename).
- Validation on load against the **already-verified** save: `startingRevision`
  equals the authoritative revision; `campaignId`, versions, and content hashes
  match; `turnId` recomputed. On mismatch: reconstruct deterministically from the
  pre-turn snapshot or report resumption-unavailable — **never** mutate
  authoritative state.
- No change to snapshot, hashed event-envelope, signature, or compatibility version.
  Existing saves without sidecars load normally. Missing summaries are rebuildable
  by replay.

### IPC boundary

- Five commands on the single allowlisted `campaign:execute` surface, all
  schema-validated: `resolveTurn` (start/resume → `completed` summary or
  `suspended` + interruption request), `answerDecision`, `submitBattleResult`,
  `readTurnSummaries`, `abandonPendingTurn` (clears only the non-authoritative
  pending state).
- No new IPC channel; the renderer receives validated DTOs, never engine objects.
- `commitMonth` is retained and delegates to `resolveTurn`'s no-interruption fast
  path.
- A suspended turn is returned as a **success DTO with a discriminated status**,
  not a new bridge outcome.

### Localization (ADR-0209 / ADR-0218)

- Messages carry `titleKey`/`bodyKey`/`interpolation`; the **en-US catalogue is
  authored, compiled content**, resolved in the renderer, so the projection package
  never embeds prose.
- Fallback: missing translation → en-US; missing key → development warning + safe
  generic fallback, never a raw key in production.
- Formatting locale is independent of UI language; conversion happens only at the
  presentation boundary (renderer side).

### Renderer surfaces

- Grouped summary panel with category/severity filters (All, Critical, Decisions,
  Diplomacy, War, Battles, Ships, Construction, Research, Intelligence, Finance,
  Warnings), expandable detail, entity links, and pin/read state in `ui-state.json`.
- Blocking decision modal with qualitative hints; battle-request modal; campaign-log
  history; recovery prompt for a pending turn.
- Renderer holds no authoritative state.

### Migration (additive, no flag-day)

1. Additive interruption/input channel + outcome on `MonthResult` (byte-identical
   with no interruptions).
2. First seam at `battle_resolution`, default auto-resolve preserved.
3. One deterministic decision seam backed by a test decision.
4. `resolveTurn` added; `commitMonth` delegates.
5. Projection + summary sidecar as a post-turn step.
6. Renderer surfaces.

### Layout

- `@bluewave/messages` package; a phase-engine interruption seam module; desktop
  application commands, sidecar helpers/stores, shared DTOs, and renderer components;
  and a compiled en-US catalogue under the content pack.

## Testing Decisions

**What makes a good test here.** Test external behaviour at the highest seam: the
observable projection (`TurnMessage[]` by stable identity), the `resolveTurn`
response DTO, sidecar round-trips, save/load, and deterministic hashes — never
internal phase mechanics or private projection helpers. Use the domain glossary;
assert by `_tag` for failures; never sleep or depend on wall-clock time.

**Proposed seams (please confirm).** Existing seams are preferred; the fewest
possible are proposed:

1. **`resolveTurn` application command boundary** — the single highest seam,
   driving execute → interruption/resume → projection → sidecar → response DTO
   end-to-end. Everything the player sees crosses here. Primary E2E seam.
2. **The pure projection function** (`domainEvents + snapshot + inputs →
   TurnMessage[]`) — the single unit seam for policy, aggregation, dedup,
   severity, provenance, and ordering. No engine required.
3. **The `MonthResult` interruption channel** — the additive phase-engine seam,
   exercised for pause, recorded-input consumption, ordinal ordering, and
   deterministic re-execution parity.

No new seam is proposed in the renderer (it is DTO-driven) or in `@bluewave/events`
(untouched).

**Modules tested.** `@bluewave/messages` (schema strictness, projection totality,
aggregation/dedup, identity/ordering, version); the phase-engine interruption seam
(suspend, consume, re-execute parity); desktop commands and sidecars
(`resolveTurn`, `answerDecision`, `submitBattleResult`, `readTurnSummaries`,
`abandonPendingTurn`; tolerant read/strict decode/atomic write; stale-record
handling).

**Prior art.** `commands/commitMonth.test.ts`, `commitMonth/responseMappers.test.ts`,
`campaignBridge.test.ts` (command-surface parity), `monthlyReports.ts` sidecar
tolerant-read tests, `packages/cross-process-test` (determinism proof),
`packages/phase-engine/src/replay.ts` (re-execution parity), and the deterministic
sort tests around `priorities.ts`.

**Specific decisions.** Unit tests for strict schema rejection and projection
totality; schema/DTO parity fixtures; determinism tests proving a re-executed paused
turn is byte-identical and a resumed turn's final hash equals the uninterrupted
single-run hash; save/load tests for legacy saves, resume-after-reload, stale
rejection, and summary rebuild-by-replay; interruption tests for pause→persist→
reload→resume exactly-once, multiple interruptions per turn, and rejected
missing/extra/mismatched inputs; a rollback test proving a domain-validation failure
aborts pre-commit and restores state; and one E2E advancing several turns across
economy/construction/research/diplomacy with a decision and a battle. Gate:
`pnpm preflight`, `pnpm test:scripts`, `pnpm check`.

## Out of Scope

- Any authored crisis/event content, encounter selection, eligibility, effects, or
  AI weights — **S-4**.
- Battle-offer gameplay policy (accept/decline, VP/prestige cost, force composition,
  support forces, mission selection) — **T-1**.
- Full 17-phase interruption coverage in the first increment (widened afterward).
- Tactical battle combat-engine changes.
- A localization runtime/translation pipeline beyond keyed catalogue + en-US
  fallback (ADR-0209 governs; no placeholder languages).
- Phase-boundary memoization (later optimization).
- The pre-existing `localeCompare` cross-host determinism risk in `@bluewave/combat`
  (flagged in the map; recommend a separate remediation ticket).

## Further Notes

- The full decision record is `decisions/` (D-01…D-19); the chart and cross-effort
  seam/dependency tables are `map.md`. S-4 is blocked downstream of delivery stage
  **M2** (and M3/M4 for full flows); T-1 likewise.
- Two research flags carry into implementation: the battle port must represent a
  **tie/null** winner (`BattleResult` port allows null; the frozen `BattleResolved`
  body does not, and stays unemitted), and the DTO file location may follow the
  existing `campaign-command-contract` convention rather than a new module.
- Acceptance is the brief's §13 criteria, expressed as the user stories and tests
  above; deterministic re-execution is the core invariant.
