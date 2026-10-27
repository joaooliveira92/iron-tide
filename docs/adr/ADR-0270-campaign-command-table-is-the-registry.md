# ADR-0270: The campaign command descriptor table is the command registry

Applies to: commands, desktop

Rule: `campaignCommandShapes` is the one command registry; command names and map types derive from it, never by hand.

## Status

Accepted (2026-10-22).

## Context

A campaign command used to live in four hand-kept lists: the `CampaignCommandMap`
interface, the `campaignCommandShapes` table, the payload schema referenced from
each handler, and the `commandPrograms` record in the bridge. Names and types were
tied only by `satisfies`, so a handler decoding a different schema than the table
declared drifted silently until runtime.

## Decision

1. `campaignCommandShapes` in `shared/campaign-command-descriptors.ts` is the one
   registry. A row holds the command name, payload schema, result type, and a
   `strict` flag for rows that reject excess keys.
2. `CampaignCommandMap`, `CampaignCommandName`, and `CAMPAIGN_COMMAND_NAMES` are
   derived from the table. They are not written by hand.
3. The main dispatcher decodes the payload from the row's schema. Handlers are
   typed `CommandHandler<Name>` and receive the decoded payload. Handlers do not
   decode.
4. Handlers stay separate Effect programs, registered by name in `commandHandlers`
   in `main/campaignBridge.ts`. The record type fails to compile when a name is
   missing.

## Consequences

- Adding a command is one table row plus one handler entry.
- Tests that exercise a handler with a raw payload go through `programFor`, which
  resolves the handler to its registered name and runs the registry decode.
- `scripts/verify-reachability-ledger.mjs` reads command names from the table.
