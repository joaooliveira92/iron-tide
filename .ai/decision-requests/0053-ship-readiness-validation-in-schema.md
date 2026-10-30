# Decision Request: Move ship-readiness validation into the fleet-ship schema

## Status

Blocked pending owner decision.

## Trigger

`FleetShipSchema` in `packages/content-schema/src/campaign.ts` leaves `readiness` as `Schema.String` and `crewQuality` as `Schema.Finite`. A second validator in `packages/campaign/src/readiness.ts` (an `ALLOWED_SHIP_INPUT_KEYS` set, `if` ladders and its own failure codes) owns the real constraints. Moving them into the schema changes which ship records are accepted and where the diagnostic text comes from (AGENTS.md stop condition: wire format and authoritative acceptance).

## Evidence

- `packages/content-schema/src/campaign.ts:34-35`.
- `packages/campaign/src/readiness.ts:120-204`, `:207-210`; caller `nationCompilation.ts:148`.
- Effect audit #371, ranked item 9: "Decision".
- Compiler diagnostics are golden-pinned.

## Why agent judgment is insufficient

The schema would reject a record before `readiness.ts` can report its own code, so existing diagnostic codes and messages (which tests and goldens pin) may change, and records the second validator currently repairs or tolerates could start failing at the schema layer. Which layer owns the message is a product and compatibility choice.

## Options

### Option A: Schema owns the constraints, annotated messages keep the codes

- Behavior: `Schema.Literals(SHIP_READINESS_STATES)` and a bounded integer for `crewQuality`; `.annotate({ message })` reproduces today's text; delete the ladders.
- Advantages: one validator; deletes the duplicate failure codes.
- Risks: annotation must reproduce every code exactly or diagnostic goldens move.
- Compatibility impact: none if the text is reproduced.
- Migration impact: diagnostic goldens re-checked, not re-pinned.
- Scope and effort: medium.

### Option B: Schema owns the constraints, diagnostics change

- Behavior: as A, accept the schema's default messages.
- Advantages: smallest code.
- Risks: diagnostic goldens move; remediation text is lost.
- Compatibility impact: diagnostic output changes.
- Migration impact: re-pin diagnostic goldens.
- Scope and effort: medium.

### Option C: Keep both validators

- Behavior: unchanged.
- Advantages: no behaviour change.
- Risks: two validators, one shape, drift.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

## Recommendation

Option A. Do not implement before approval.

## Work safely completed while blocked

None needed. No readiness code changed.
