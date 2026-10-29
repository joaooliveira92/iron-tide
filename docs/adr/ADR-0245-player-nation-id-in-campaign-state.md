# ADR-0245: The player nation is stored in authoritative campaign state

Applies to: campaign, ai, test-support

## Status

Superseded by: ADR-0354

Accepted (2026-10-20). Resolves
[decision request 0025](../../.ai/decision-requests/0025-s-2-player-nation-identity-in-the-month-executor.md)
(Option A) for S-2 ([#89](https://github.com/joaooliveira92/iron-tide/issues/89), spec
[#74](https://github.com/joaooliveira92/iron-tide/issues/74) R4, R5, R7 to R9). Complements
[ADR-0239](ADR-0239-s2-prestige-values-balance-targets.md), which it does not amend.

## Context

Prestige applies to the player's nation only. The month executor never knew which nation that is:
`CampaignSnapshot` has only the roster flags `isPlayable` and `isAI` (ten playable nations), and the
player id exists only as an argument to projection builders. A month must replay from a save and
content alone (AGENTS.md determinism), so the identity cannot come from projection or UI context.

## Decision

1. `CampaignSnapshot` gains a required `playerNationId: string`, set when the campaign is created and
   never changed afterwards. It is hashed with the rest of authoritative state and saved, loaded,
   cloned (`snapshotClone`) and replayed with it. It has no default and is never optional or derived.
2. **Invariant.** `playerNationId` equals the id of exactly one nation in `snapshot.nations`, and that
   nation has `isPlayable: true`. The compile/new-campaign boundary and the save decoder reject a
   snapshot that violates it (missing, unknown id, AI-only nation) with a typed `_tag` error. Nothing
   repairs, defaults or guesses it.
3. Phases read the player from the snapshot. A prestige source, the sacking draw (keyed by nation and
   month) and the career result use `playerNationId`; AI-only and other playable nations are never
   changed by S-2.
4. **Compatibility.** The field is a state-shape change, so the compatibility version is bumped and
   every save from another version is refused before decode (ADR-0113, ADR-0154 section 11). It ships
   in the same unreleased S-2 re-pin as the prestige field where possible, so goldens move once with
   two understood causes, recorded in the re-pin report.
5. **Legacy saves.** No migration step is registered. A saved snapshot lists nations only as
   `playable` or `ai` slots, and the 1880 pack has ten playable slots, so no earlier save identifies
   its player unambiguously, and the player is never inferred (not from slot order, treasury or id).
   `SAVE_MIGRATIONS` stays empty for this bump. If a future save format records an explicit player
   marker, a step may be added that carries it over only when exactly one candidate exists and
   otherwise refuses with a typed error.
6. Test fixtures that build snapshots (`test-support`) set `playerNationId` explicitly.

## Consequences

- #89 and later S-2 tickets can target the player deterministically with no caller input.
- One more compatibility bump and golden re-pin; pre-bump saves cannot be loaded.
- The new-campaign flow must pass the chosen nation into compilation. That is a prerequisite ticket
  for #89, not part of this ADR.
