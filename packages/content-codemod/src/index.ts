/**
 * `@bluewave/content-codemod` — the deterministic content codemod of ship-part-model ticket 11c.
 *
 * The planner (`planFromLegacy`, `planFromStaged`) is pure; the loader (`loadLegacySource`,
 * `readStagedSource`) and publisher (`publishMigration`) own the filesystem. The writer stages
 * parts-based content and never activates production or changes a save/compatibility version.
 */
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
export { fromYaml, sortKeysDeep, toYaml } from "./yaml.js";
export { validateStagingDir, type StagingPathOptions } from "./paths.js";
export { publishMigration, type PublishOptions, type PublishResult } from "./publish.js";
export { canonicalMountId, planFromLegacy, planFromStaged } from "./plan.js";
export { loadLegacySource, readStagedSource, type LoadOptions } from "./load.js";
