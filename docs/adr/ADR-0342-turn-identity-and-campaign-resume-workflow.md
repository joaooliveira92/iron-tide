# ADR-0342: Turn identity and campaign resume workflow

Consolidates: ADR-0222, ADR-0235

Applies to: campaign, desktop, persistence, phase-engine

Rule: Turn identity is fixed from pre-execution inputs before any interruption is answered; campaign reopen is gated by a main-process-owned allow-list with canonical-path approval.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0222
Supersedes: ADR-0235

## Context

Two separate concerns govern what "resume" means in Bluewave and how the user
reaches a resumed session. At the engine layer, the phase-engine interruption
seam computes `interruptionId = H(turnId, phase, ordinal, subjectKey)` and
requires one stable `turnId` for a turn's whole lifetime: a recorded answer
carries the `interruptionId` it was created against, and re-execution must
recompute the same value or reject the input as `invalid-input`. The desktop
turn transaction originally computed `turnId = H(campaignId, startingRevision,
committedOrderHash, orderedInputsHash)` with `orderedInputsHash` taken over the
accumulated recorded inputs. Resume re-executed the month with one more recorded
input each time, so that hash — and therefore every interruption's
`interruptionId` — changed on each resume.

At the desktop-UI layer, clicking an entry in Recent Campaigns re-opened the
native file dialog because the main process must never open a directory just
because the renderer names it. The renderer kept its own recents in
`localStorage`, which the main process could not vouch for and which could drift
from what was really on disk.

The two concerns connect at the user-facing `resume` moment: a campaign is
reopened through the approved-path allow-list, and a suspended turn inside it
resumes through the stable-turn-identity mechanism. This record consolidates
both decisions.

## Rules

### 1. Turn identity and interruption stability

1. A turn's identity is fixed before any interruption is answered and must not
   depend on the inputs accumulated while the turn is suspended. The
   `orderedInputsHash` term of `turnId` hashes the turn's pre-execution input
   set (empty for a fresh turn), never the accumulators.

2. Validation of a stored pending turn recomputes the turn id from the same
   pre-execution inputs. Finishing a turn clears its non-authoritative
   `pending-turn.json` sidecar so an already-resolved month cannot prompt a
   resume.

3. A decision or a battle can suspend, persist, reload, and resume exactly
   once; re-executing with all inputs supplied at once is byte-identical to the
   suspend/resume run.

4. The documented `turnId` formula and its `orderedInputsHash` term are
   unchanged — the term now binds the turn's starting inputs, which are empty
   in the current desktop flow. No authoritative snapshot or event wire format
   changes.

### 2. Campaign reopen workflow

1. The main process owns the recents list (`recent-packages.json` in the
   user-data directory, written atomically). It is the single source of truth;
   the renderer holds no copy.

2. A package enters the list only after a successful `loadCampaign` through the
   native dialog. Paths are stored canonical (`realpath`) so symlinks and
   trailing separators cannot duplicate or bypass entries.

3. `loadRecentCampaign({ packagePath })` opens a package only if its canonical
   path is in the list (`PACKAGE_NOT_APPROVED` otherwise;
   `PACKAGE_MISSING` when a listed directory is gone). `listRecentCampaigns`
   returns entries with an `available` flag; `removeRecentCampaign` forgets one.
   Payloads are strict-decoded.

4. The renderer falls back to the dialog on `PACKAGE_NOT_APPROVED`, shows
   missing packages as unavailable, and keeps load errors visible until
   dismissed.

5. Recording a recent is best-effort: failing to write the list never blocks
   opening. The list is app-shell bookkeeping, never authoritative; the clock
   comes from the injected `Clock` service.

6. The old renderer `localStorage` recents are abandoned (they cannot be
   trusted), so users re-open each package once through the dialog. The list
   holds at most ten entries; the oldest drop off.

7. Verify, Replay and Recover still prompt for a package each time; scoping
   them to a recent package is a separate product decision.

## Compatibility

Additive. No wire format, authoritative hash or save-layout changes. ADR-0222
changed the `orderedInputsHash` semantics but kept the documented formula, so
no snapshot or event wire format moves. ADR-0235 abandoned the renderer's
`localStorage` recents; users re-open each package once.

## Alternatives rejected

- **Turn identity from accumulated inputs.** Made every resume fail because
  each re-execution added one more input, changing the turn id and therefore
  every interruption's `interruptionId`.
- **Renderer-owned recents.** Could not be vouched for by the main process and
  could drift from what was on disk.
- **Reopen from the native dialog for every entry.** Defeated the purpose of
  Recent Campaigns.