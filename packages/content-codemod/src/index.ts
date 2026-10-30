export {
  migrationFailure,
  type MigrationFailure,
  type MigrationFailureCode,
  type MigrationResult,
} from "./failure.js";
export {
  MANIFEST_PATH,
  type GeneratedFile,
  type LegacySource,
  type ManifestDataQuality,
  type MigrationManifest,
  type MigrationPlan,
  type SourceFileRef,
  type StagedDesign,
  type StagedSource,
} from "./types.js";
export { fromStagedJson, sortKeysDeep, toStagedJson } from "./staged.js";
export { validateStagingDir, type StagingPathOptions } from "./paths.js";
export { publishMigration, type PublishOptions, type PublishResult } from "./publish.js";
export { planFromLegacy, planFromStaged } from "./plan.js";
export { loadLegacySource, readStagedSource, type LoadOptions } from "./load.js";
