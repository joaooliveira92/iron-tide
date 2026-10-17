# R-22: IPC command-surface mechanics

**Type:** research
**Status:** resolved
**Blocked by:** None

## Question

What are the exact steps and schemas to add commands (`resolveTurn`,
`answerDecision`, `submitBattleResult`, `readTurnSummaries`, `abandonPendingTurn`)
to the single allowlisted `campaign:execute` boundary **without** breaking parity
tests?

Specifically:

- `apps/desktop/src/shared/campaign-command-contract.ts` (`CAMPAIGN_COMMAND_NAMES`,
  `CampaignCommandClient` overloads) and the sync test
  `campaignBridge.test.ts`.
- `apps/desktop/src/main/campaignBridge.ts` registry and
  `runtime/commandProgram.ts` `withSchema`; how payload/result schemas are
  registered and decoded with `onExcessProperty:"error"`.
- `campaignCommandSchemas.ts` conventions and how existing commands
  (`generateBattle`, `resolveTacticalBattle`) return suspending-like payloads.
- The preload allowlist (`preload/index.ts`) — confirm no new channel is needed.

## Answer

**Resolved — one channel, no preload change; a fixed 10-step checklist per command.**
`campaign:execute` is registered once (`main/index.ts:161-163`) and exposed once
(`preload/index.ts:61-66`); the dispatcher decodes the name against
`Schema.Literals(CAMPAIGN_COMMAND_NAMES)` and looks up a program
(`campaignBridge.ts:95,105-166`). **No new IPC channel or preload edit is needed.**

Checklist to add one command:
1. `campaign-command-contract.ts` — add name to `CAMPAIGN_COMMAND_NAMES` (`:399-460`).
2. same — add payload/result DTOs (battle template `:99-138`).
3. same — add the `CampaignCommandClient.execute` overload (`:469-688`; battle `:507-522`).
4. `campaignCommandSchemas.ts` — add the payload `Schema.Struct` (envelope
   `:73-77`; battle `:530-558`); use `withStrictSchema` semantics for
   excess-key-rejected bodies (`commandProgram.ts:39-51`).
5. `commands/<command>.ts` (new) — implement with `withSchema`/`withStrictSchema`
   (`commandProgram.ts:24-51`; template `battleSandboxCommands.ts`).
6. `campaignBridge.ts` — register in `commandPrograms` (`:105-166`, battle rows `:161-165`).
7. `campaignBridge.test.ts` — add to `IMPLEMENTED_COMMANDS` (**required**, else the
   `NOT_IMPLEMENTED` test at `:94-102` fails).
8. `campaignCommandSchemas.test.ts` — accept/reject characterization cases (`:496-534`).
9. (optional) per-command dispatch tests.
10. preload/main index — **no change**.

**Key mechanics:** registration map keys ⊆ `CAMPAIGN_COMMAND_NAMES` is enforced at
**compile time**; `IMPLEMENTED_COMMANDS` at **test time**; the overload list is
**hand-maintained** (silent gap if omitted — `campaign-command-contract.ts:391-398`).

**Suspended is a success DTO, not a new `BridgeResult` outcome:**
`resolveTurn` returns `{ status: "completed" | "suspended", ... }`. Follow the
`commitMonth` envelope pattern (`commitMonth.ts:52-72`); `readTurnSummaries`
follows the `SessionIdPayloadSchema` query pattern.

**Note:** D-16 proposed `apps/desktop/src/shared/turn-contract.ts`; the repo
convention is to keep DTOs in `campaign-command-contract.ts`. Either works — a
spec-level detail (recorded in the map), not a decision reversal.
