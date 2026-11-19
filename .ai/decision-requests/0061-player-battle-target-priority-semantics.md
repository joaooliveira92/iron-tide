# Decision Request: player battle target-priority semantics (#230)

## Status

Resolved 2026-11-19: Option A, decided by the agent under the owner's grant of full autonomy ("decide how to proceed"). Implemented for #230.

## Resolution

- **Shape (Q1, Q2):** one optional contact per division, `targetHandle` (the fog-safe `contactHandle`, never a true asset id). Gunnery on every battery of that division takes the ordered contact when it is an enemy, in the contact set, and still `NORMAL`; otherwise the existing nearest-target choice applies.
- **Lost or hidden target (Q3):** stateless fallback to automatic fire. The order stays in the order set, so `to_end` runs never fail mid-run; the UI marks a contact no longer in view. A handle that names no enemy is refused when the step is submitted.
- **Ship-target orders (Q4):** not in this slice. This is the `DIVISION` target-order kind of ADR-0322, legal at Rear Admiral and Captain. The `SHIP` kind (Captain) stays deferred.
- **Replay (Q5):** the order rides inside each stored step as an optional `targetHandle` on the division order. Sidecar `schemaVersion` stays `1.0.0`: the key is additive and optional, and saves without it decode and replay unchanged.
- **Torpedoes and smoke (Q6):** gunnery only.
- **Rank gate:** enforced by `assertOrderPermitted(mode, "TARGET_ORDERS", ..., "DIVISION")` when the session has force orders enabled (`session.force`). No player path enables realism modes yet (the modes stay out of #230), so without a force session the order is allowed as pre-realism sandbox behaviour. Wiring a mode into the player path later makes Admiral refuse the order with no change here.
- **Hashes:** an absent `targetHandle` changes no hash, so the replay corpus needs no re-pin.

## Trigger

#230 asks for the first player targeting order. The rank gate is decided (ADR-0322, `realismPermissions` in `@bluewave/combat/orders`), but the meaning of a target order is not. Plausible readings change battle outcomes, so they change gameplay and golden hashes.

## Evidence

- #230 comment 2026-10-27 and status audit 2026-10-30: semantics "still unspecified"; `needs-info` stays.
- `packages/combat/src/orders/realism.ts`: matrix says who may order a target (`DIVISION` or `SHIP`), nothing about effect.
- `packages/combat/src/contact/targeting.ts`: `validateTargetOrder` only rejects unknown or zero-confidence contacts (fog of war).
- No `targetPriority` symbol or spec anywhere in the repo.
- Today fire and torpedoes are automatic; the player orders division stance and speed only.

## Why agent judgment is insufficient

Each open question below changes which ship is shot at, so it changes battle results and replay-corpus hashes.

## Questions

1. **Priority shape.** An ordered list of contacts per division, a class-based rule (e.g. capital ships first, nearest first), or one preferred contact with automatic fallback?
2. **Selection among visible contacts.** Does the priority only break ties among eligible targets (range, arc, ammunition), or does it override the automatic best-target choice?
3. **Lost or hidden target.** When the target sinks, is struck, or drops out of detection: fall back to automatic fire, hold fire, or keep a last-known-position order for N ticks?
4. **Ship-target orders (Captain).** Same semantics as division orders with a single contact, or an exclusive lock?
5. **Replay record.** One command per change, stored in the save sidecar as an ordered command log (needs a schema version bump), or a per-division state snapshot?
6. **Torpedoes and smoke.** Does a target order also steer torpedo eligibility, or stay gunnery only until Captain manual torpedoes land?

## Options

### Option A: preferred contact with automatic fallback

- Each division holds one optional preferred contact. Gunnery picks it when eligible, else the existing automatic choice. A lost or hidden target clears the order and logs an event.
- Advantages: smallest engine change, no stuck divisions, easy to explain in the UI.
- Risks: less control than a priority list.
- Compatibility: orders absent means current behaviour, so existing hashes hold. Only battles with the new command change.
- Migration: additive optional sidecar field and command, with a version bump.
- Effort: one command, one resolver hook, one UI control.

### Option B: ordered priority list per division

- Each division holds an ordered list of contacts or classes. Gunnery takes the first eligible entry, then falls back to automatic.
- Advantages: matches the "priority" wording in #230 and gives richer play.
- Risks: bigger UI and persistence surface, with more cases for lost or hidden entries.
- Compatibility: same as A.
- Migration: same as A with a list-valued field.
- Effort: roughly twice A.

## Recommendation

Option A first. It meets the #230 acceptance (set a priority in the UI, replayed on save/resume) and leaves the list as a later extension. Cover questions 3, 5 and 6 with: lost or hidden clears the order; the order is stored as a command in the save sidecar; gunnery only. Do not implement before approval.

## Work safely completed while blocked

None. Rank gating (ADR-0322) and the division order input (ADR-0321) are already merged.
