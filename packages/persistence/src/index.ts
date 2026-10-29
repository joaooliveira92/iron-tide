export { systemClock, type PersistenceClock } from "./clock.js";
export {
  CompatibilityChecker,
  CompatibilityError,
  CURRENT_COMPATIBILITY_VERSION,
  PART_MODEL_COMPATIBILITY_VERSION,
} from "./compatibility.js";
export {
  CANCELLED_CODE,
  COMPATIBILITY_MISMATCH_CODE,
  CORRUPT_SAVE_CODE,
  IO_CODE,
  MISSING_SAVE_CODE,
  PersistenceCancelledError,
  PersistenceCompatibilityMismatchError,
  PersistenceCorruptSaveError,
  PersistenceInvalidOptionError,
  PersistenceIoError,
  PersistenceMissingSaveError,
  PersistenceLegacySaveError,
  LEGACY_SAVE_CODE,
} from "./errors.js";
export type { PersistenceError, PersistenceErrorFields } from "./errors.js";
export { cleanup, RecoveryManager, sweepStaleTemp } from "./recovery.js";
export {
  detectSaveVersion,
  migrateSaveDirectory,
  restampState,
  SAVE_MIGRATIONS,
  type MigrateSaveDirectoryResult,
  type SaveMigrationKind,
  type SaveMigrationStep,
} from "./saveMigration.js";
export {
  buildSaveManifest,
  LEGACY_SIG_FILE,
  SAVE_FORMAT_VERSION,
  SAVE_HASH_VERSION,
  SAVE_MANIFEST_FILE,
  verifySaveManifest,
  writeSaveManifest,
  type SaveManifestCheck,
} from "./manifest.js";
export { decodeStorableCampaignState, StorableCampaignStateSchema } from "./schemas.js";
export { fromStorableSnapshot } from "./snapshotSerialization.js";
export type { StorableCampaignSnapshot } from "./snapshotSerialization.js";
export type {
  LoadedSave,
  LoadFailure,
  MonthInputLoad,
  SaveExtras,
  SaveMetadata,
  SaveResult,
} from "./store.js";
export { SaveStore, type SaveStoreOptions } from "./store.js";
