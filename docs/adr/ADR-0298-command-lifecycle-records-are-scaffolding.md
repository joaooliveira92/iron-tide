# ADR-0298: Hash-chained command-lifecycle records, settlement branches and the spec-rule helpers are scaffolding, not shipped

Applies to: commands, phase-engine

## Status

Superseded by: ADR-0355

Accepted (2026-10-25). Resolves [#204](https://github.com/joaooliveira92/iron-tide/issues/204) and carries out
[#205](https://github.com/joaooliveira92/iron-tide/issues/205). The owner delegated the choice.

## Context

The test-only `BudgetProjectLifecycle` was the only place that exercised hash-chained status transitions, settlement branches
(completion, pre-lock cancellation refund) and audit-chain heads against a snapshot. `CommandLifecycle.process` and dispatch
produce none of these, and no shipping path, save, replay or screen reads them.

## Decision

These records are scaffolding for an unscheduled feature. They do not ship in the month, so nothing needs to cover them.

- `@bluewave/commands` `specRules.ts` keeps only `createCommandRecord`, which `apps/desktop` uses. The seven helpers with no
  caller anywhere (`enforceLockImmutability`, `checkCancellationWindow`, `produceResult`, `handleImpossibility`,
  `assertNoDirectMutation`, `handleInternalFailure`, `verifyReplay`) are removed. `AuditChain` stays: `CommandLifecycle` uses it.
- `BUDGET_PROJECT_COMMAND_DEFINITION` drops its `settlementPolicy` block, which only the deleted lifecycle read. The field is
  optional in `CommandTypeDefinition`, so `assertValidDefinitionOrThrow` still passes. `settlementPolicyId` stays: it is a required
  definition field.
- If a settlement or refund feature is ever scheduled, it comes back with its own ADR and a test through the month pipeline, not
  as unreferenced helpers.

## Compatibility

No wire format, state, hash or replay changes: the definition's `contentHash` is derived from the type id and version only. All 11
golden hashes and 13 replays verify unchanged.
