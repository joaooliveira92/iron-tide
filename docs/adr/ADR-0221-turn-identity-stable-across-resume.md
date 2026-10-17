# ADR-0221: A turn's interruption identity is stable across suspend and resume

## Status

Accepted (2026-10-16). Implements the resume model of the turn-messages effort (`.scratch/turn-messages/spec.md`, D-12) and fixes a latent defect that made every resume fail.

## Context

The phase-engine interruption seam computes `interruptionId = H(turnId, phase, ordinal, subjectKey)` and requires one stable `turnId` for a turn's whole lifetime: a recorded answer carries the `interruptionId` it was created against, and re-execution must recompute the same value or the input is rejected as `invalid-input`.

The desktop turn transaction computed `turnId = H(campaignId, startingRevision, committedOrderHash, orderedInputsHash)` with `orderedInputsHash` taken over the **accumulated recorded inputs**. Resume re-executes the month with one more recorded input each time, so that hash — and therefore every interruption's `interruptionId` — changed on each resume. A recorded decision answer or battle result could never match the re-executed request, and a suspended turn was stuck at `invalid-input`. The defect was latent because no end-to-end decision or battle suspension existed to exercise the desktop resume path.

## Decision

A turn's identity is fixed before any interruption is answered and must not depend on the inputs accumulated while the turn is suspended. The `orderedInputsHash` term of `turnId` hashes the turn's pre-execution input set (empty for a fresh turn), never the accumulators. Validation of a stored pending turn recomputes the turn id from the same pre-execution inputs. Finishing a turn clears its non-authoritative `pending-turn.json` sidecar so an already-resolved month cannot prompt a resume.

## Consequences

- A decision or a battle can suspend, persist, reload, and resume exactly once; re-executing with all inputs supplied at once is byte-identical to the suspend/resume run.
- Interruption identities are stable for a turn's lifetime, as D-12 intends; recorded inputs hash-validate on every re-execution.
- The documented `turnId` formula and its `orderedInputsHash` term are unchanged — the term now binds the turn's starting inputs, which are empty in the current desktop flow. No authoritative snapshot or event wire format changes.
