# ADR-0338: Options, preferences and the campaign command registry

Consolidates: ADR-0203, ADR-0270

Applies to: desktop, persistence, commands

Rule: Preferences are a versioned domain object with strict validation and
deterministic migration; campaign commands are a single-source-of-truth
registry deriving names and types from a descriptor table.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0203
Supersedes: ADR-0270

## Context

Preferences and campaign commands both live at the boundary between the
Electron main process and the shared domain, but they solve different facets
of the same architectural problem — ensuring that state with a canonical
definition (user settings on one side, command contracts on the other) has
exactly one authoritative source and a typed, validated path into the rest of
the system. Preferences require versioning, migration, and recovery across
cross-version saves without touching simulation state. Campaign commands
require a single registry that prevents silent drift between command names,
payload schemas, return types, and handler implementations.

## Rules

### 1. Preferences domain and persistence

1. Preferences are a versioned schema with central defaults, strict validation,
   deterministic migration, and atomic main-process persistence. Corrupt or
   unknown settings recover silently without touching saves.

2. The typed settings are: `language`, `formattingLocale`, `theme`,
   `textScale`, `interfaceDensity`, `measurementPreset`, per-category
   custom measurement selections, `currencyDisplayMode`, `numberScale`,
   `reducedMotion`, and `tooltipDetail`.

3. Requested and effective currency-display modes are separate models.
   Fallback is runtime state and never rewrites the stored request
   (per ADR-0211).

4. Preferences scope is three-tier: app-wide, per-campaign, and per-session.

### 2. Campaign command registry

1. `campaignCommandShapes` in `shared/campaign-command-descriptors.ts` is
   the one command registry. A row holds the command name, payload schema,
   result type, and a `strict` flag that rejects excess keys.

2. `CampaignCommandMap`, `CampaignCommandName`, and
   `CAMPAIGN_COMMAND_NAMES` are derived from the table — never written
   by hand.

3. The main dispatcher decodes the payload from the row's schema. Handlers
   are typed `CommandHandler<Name>` and receive the decoded payload;
   handlers do not decode.

4. Handlers stay separate Effect programs, registered by name in
   `commandHandlers` in `main/campaignBridge.ts`. The record type fails
   to compile when a name is missing.

### 3. Shared boundaries

1. Both preferences and campaign commands cross the desktop-IPC boundary.
   Wire formats are versioned and decoded with strict schema validation;
   `JSON.parse(...) as T` is never used.

2. The compiler and engine never import preferences or command-handler
   code. Runtime-free domain packages import schema types only.

## Invariants

- Every preference key exists in exactly one defaults table.
- Every campaign command name is a key in exactly one table row.
- Adding a command requires exactly one table row plus one handler entry.
- Every schema change to a command type adds a parity test from existing
  fixtures.

## Alternatives rejected

- **Preferences as part of simulation state.** Couples UI settings to save-
  file integrity and complicates cross-version migration.
- **Preferences without a versioned schema.** Prevents deterministic
  migration and risks silent data corruption on version mismatch.
- **Hand-maintained command-name enums and shape lists.** Caused silent
  drift between payload schemas, handler types, and the command map across
  four separate locations.
- **Preferences or commands without strict decode.** Using `JSON.parse` with
  a runtime cast bypasses structural validation and defers errors to the
  first access.