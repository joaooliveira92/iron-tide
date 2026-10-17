# ADR-0224: 1880 command structure — per-nation officer rosters and seeded divisions

## Status

Accepted (2026-10-17). Resolves decision request
[0005](../../.ai/decision-requests/0005-officer-rosters-and-divisions-golden-repin.md)
(Option A). Complements ADR-0213. Sprints: N-1.

## Context

N-1 ticket 07 seeds the 1880 opening command structure. Today
`packages/campaign/src/officers.ts` returns the same shape for every nation (six
officers: three `CAPTAIN`, two `COMMODORE`, one `REAR_ADMIRAL`), and
`packages/campaign/src/nationCompilation.ts` hard-codes `divisions: []`. Both
fields live on `NationState` (`packages/campaign/src/state.ts`) and are inside
the hashed cross-process reference run
(`packages/cross-process-test/src/run-child.ts`), so authoring them is a
behavioural change to the reference hashes. ADR-0213 already decided that ticket
07 authors initial divisions and nation-appropriate, distinct officer rosters,
and that their magnitudes are admitted balance choices.

The earlier blocker — no golden baseline — is resolved: `golden/hashes.json`
exists (commit `0117adc`, `Golden-Repin: baseline-created`), so a same-commit
re-pin is possible. Decision request 0005 asked the owner to approve the
behavioural change itself.

## Decision

- **Implement per-nation officer rosters and seeded 1880 divisions** as N-1
  ticket 07 specifies.
- **Roster and division magnitudes are authored as explicit ADR-0213
  `balance_adjustment` values** with provenance; directions follow citable
  history, magnitudes are admitted balance choices, never sourced facts.
- **Move and re-pin the affected authoritative golden hashes in the same
  behavioural commit**, recording the old hash, the new hash, and the exact cause
  through the established golden-repin mechanism
  (`docs/agents/golden-repinning.md`). The `not-needed` trailer must not be used:
  the change does move the reference output.
- **Assess the `NationState` compatibility-version impact explicitly** and either
  implement a deterministic migration or deliberately refuse incompatible prior
  saves, per the repository's existing compatibility policy.
- **Do not alter unrelated gameplay values** in the same change.

## Consequences

- Nations gain distinct officer rosters and initial divisions; the command and
  division-assignment surface has content.
- The cross-process golden reference hashes move with an understood, attributable
  cause and are re-pinned in the same commit; `NationState` gains populated
  `officers`/`divisions`, which may require a compatibility bump and a migration
  or refusal decision for prior saves.
- N-1 completes, and its dependent lanes (N-2, N-3) become reachable.
- This change is a separate golden movement from S-1's readiness/crew movement;
  the two are processed sequentially so each re-pin has one attributable cause.
