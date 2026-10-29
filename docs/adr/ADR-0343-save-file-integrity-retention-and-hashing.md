# ADR-0343: Save file integrity, retention and hashing

Consolidates: ADR-0278, ADR-0285, ADR-0305, ADR-0330, ADR-0331

Applies to: campaign, compiler-cli, cross-process-test, desktop, persistence, phase-engine

Rule: Save files decode with strict schema validation and are integrity-sealed by a complete-file manifest; the snapshot has a single unified hash covering all fields including maps; save retention is opt-in with active and previous saves always protected.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0278
Supersedes: ADR-0285
Supersedes: ADR-0305
Supersedes: ADR-0330
Supersedes: ADR-0331

## Context

Five separate concerns govern how Bluewave saves, loads, verifies and retains
persistent state. Each was originally captured in its own ADR as the save
system evolved, and this record consolidates them into one coherent model.

**Strict decoding** (`kampf`): Every file the persistence layer reads must
decode with `onExcessProperty: "error"` so unmodeled keys are rejected as
corrupt, not silently dropped. The save-header probe alone stays lenient so an
incompatible-version save is refused early.

**Snapshot hashing** (`kampf`): The campaign snapshot hash — which seals save
integrity and drives replay verification — must cover every field including
Map-backed structures (nations, designs, design families, research active
candidates). Three incompatible hash implementations coexisted: the replay
projection omitted designs, families, prestige rules and the player nation, and
serialised Map-backed `activeCandidates` as `{}`, so a replay that differed
only in those fields verified successfully. A single unified, versioned,
domain-separated hash replaces all of them.

**Save retention** (`kampf`): The save store must not delete saves unless a
caller opts in, and when it does prune it must always protect the active and
previous saves so `revert` is never left without a target. Persistence methods
that return `Effect` must be distinguished from their synchronous counterparts
by an `Effect` suffix.

**Save manifest integrity** (`kampf`): `campaign.sig.json` held only SHA-256
hashes, so it detected accidental corruption but proved nothing about who wrote
the file. Calling it a signature overstated the protection and left
`metadata.json` and `month-input.json` outside one integrity artefact. A
`manifest.json` that lists every file in the save directory with its hash,
format version and hash version replaces it.

## Rules

### 1. Strict save file decoding

1. Pointer, signature and metadata files decode through one reader built on
   `Schema.fromJsonString` with `onExcessProperty: "error"`. `campaign.json`
   decodes with `decodeStorableCampaignState`, which applies the same option.
   The compiler CLI's `campaign:save` uses the same option.

2. The save-header probe stays lenient: it reads only
   `snapshot.compatibilityVersion` so a save from another compatibility version
   is refused before decode (BW-PER-001).

3. A field typed `Schema.Unknown` or `Schema.Record(String, Unknown)` still
   accepts any keys; strictness does not reach into it.

4. Adding a field to a save format needs the schema change and a parity fixture
   in the same commit; an older build refuses a newer file's extra keys instead
   of silently dropping them.

### 2. Unified campaign snapshot hash

1. `packages/campaign/src/snapshotHash.ts` owns the one unified hash.
   `unifiedSnapshotHash(snapshot)` hashes a recursive plain projection in which
   Maps become code-point-sorted records and Sets become code-point-sorted
   arrays, under the domain and version string
   `bluewave/campaign/snapshot/v1`.

2. `SNAPSHOT_HASH_FIELDS` is an exhaustive `Record<keyof CampaignSnapshot,
   true>` and `snapshotHashSubject` names every field explicitly. Adding a
   field to `CampaignSnapshot` fails typecheck until the subject is updated,
   and `missingSnapshotHashFields` lets a named test report the missing field.

3. The replay verifier, the cross-process golden child, the acceptance children
   and the replay corpus use `unifiedSnapshotHash` and nothing else. Version
   and domain live in the context string; a future subject change must select a
   new version rather than silently changing the old one.

4. `canonicalSerialize` is unchanged. `@bluewave/campaign` projects
   `CampaignSnapshot` through `hashableCampaignSnapshot`, which turns `nations`,
   `designs`, `designFamilies` and each nation's `research.activeCandidates`
   into records ordered by code point, before hashing.

5. `hashCampaignSnapshot`, `createCampaignSnapshotEnvelope` and
   `verifyCampaignSnapshotEnvelope` are the only way to hash, stamp or verify a
   campaign snapshot. The compiler, the save store, save migration and the
   desktop turn and project stores use them.

6. Verification also accepts an envelope stamped over the unprojected snapshot
   (`verifyLegacyMapBlindEnvelope`), so no save written before the map-field
   coverage change becomes unloadable. A save stamped that way is re-stamped
   with the new envelope the next time it is written or migrated.

7. The save envelope keeps its pre-unification projection. The unified hash
   enters save metadata when the save manifest carries it, so the unification
   does not change the envelope's compatibility contract.

### 3. Save retention policy

1. **Retention is opt-in.** `SaveStoreOptions.retainSaves` is unset by default,
   so `SaveStore` never deletes a save unless a caller asks. A set value must
   be a safe integer of at least 2, otherwise the constructor throws
   `PersistenceInvalidOptionError`.

2. **The head is protected.** After a successful save, `prune` keeps the active
   save and the previous save unconditionally, then fills the remaining budget
   with the newest others in `list` order. Directories whose name is not a
   valid save id are never deleted. The floor of 2 exists so the active/previous
   pair that `revert` needs always fits.

3. **Desktop sets the count.** The desktop app passes
   `PROVISIONAL_RETAINED_SAVES = 50` (`saveRetention.ts`). The number is a
   PROVISIONAL product choice (ADR-0252) and is tuned there, not in the
   package.

4. **Time and identity enter through a port.** `PersistenceClock` (`nowMillis`,
   `nowIso`, `uuid`) defaults to `systemClock`, the only place the package
   reads wall-clock time or random UUIDs. Tests inject a fixed clock.

5. **Stale temp files are swept on save.** `sweepStaleTemp` runs before each
   save and removes abandoned temp save directories and the pointer temp file,
   so a crashed write cannot accumulate.

6. **Retention is for save directories only.** There is no retention policy for
   replays or month-input files; only save directories are pruned.

### 4. Effect-suffixed persistence APIs

1. A method that returns an `Effect` and wraps an existing synchronous method
   takes that method's name plus an `Effect` suffix (`saveEffect`, `listEffect`,
   `isCurrentEffect`, `activeSaveIdEffect`, `previousSaveIdEffect`). The
   synchronous methods stay, so existing callers are unaffected. `load` and
   `loadMonthInput` already return `Effect` and keep their names.

2. Failures are typed: `PersistenceIoError` for filesystem failure and
   `PersistenceCancelledError` when the abort signal fired.

3. `apps/desktop/src/main` and `apps/compiler-cli` call the `*Effect` methods
   and no longer wrap the synchronous ones in `Effect.try` themselves.

4. The synchronous getters (`getActiveSaveId`, `getPreviousSaveId`, `isCurrent`,
   `revert(): boolean`) stay best-effort on purpose. The Effect channel is typed
   instead: pointer reads separate missing from unreadable from corrupt, a save
   over an unreadable pointer skips pruning and reports it in
   `SaveResult.warnings`, `isCurrentEffect` fails rather than guessing, and
   `revertEffect` carries the filesystem cause.

### 5. Save manifest integrity

1. A current save directory contains `campaign.json`, `metadata.json`, an
   optional `month-input.json` and `manifest.json`.

2. `manifest.json` is `{ formatVersion, hashVersion, files: [{ name, hash }] }`.
   It lists every file in the save directory except itself, each with the
   SHA-256 of its exact bytes. `hashVersion` names the hash algorithm and
   encoding.

3. Loading reads the manifest first and verifies each listed file before
   decoding. A byte flipped in the campaign payload, the metadata or the month
   input fails with a distinct, player-safe corruption message. A missing or
   unlisted file also fails closed.

4. A save written in the previous format has no manifest. It still loads through
   the legacy signature check and carries one warning that it predates the
   manifest; the next write or migration seals it. The word "signature" is gone
   from new artefacts, diagnostics and player-facing copy.

5. Save, recovery and migration write the manifest atomically inside the save
   directory. A failed migration leaves the original directory recoverable and
   does not publish a partial manifest.

6. `metadata.monthInputHash` remains as a descriptive field, but the manifest
   is the authoritative integrity record.

## Compatibility

Additive across all five sub-topics with one caveat. The unified snapshot hash
changes `golden/hashes.json` for `initialSnapshotHash`, `closingSnapshotHash`
and `replayVerificationHash`; every replay-corpus monthly checkpoint moves
once. The commit records the old value, the new value, the cause and a
migration assessment, with a `Golden-Repin` trailer. Legacy saves without a
manifest still load through the legacy signature check and carry a warning.
No other wire format or save-layout changes.

## Alternatives rejected

- **Lenient decode (default `onExcessProperty`).** Silently dropped unmodeled
  keys, hiding format drift until a field was actually accessed.
- **Three separate snapshot hashes.** A replay could diverge in designs,
  families, prestige rules, player nation or research candidates yet verify
  successfully.
- **No retention (unlimited saves).** Allowed unbounded disk growth with no
  opt-in policy.
- **Signature instead of manifest.** Overstated the protection (no
  authenticity) and left `metadata.json` and `month-input.json` outside the
  integrity artefact.
- **Mixed synchronous/Effect naming without suffix.** Made it impossible to
  tell at call site whether a method returns `Effect`.