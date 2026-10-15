/**
 * Typed, path-specific migration failures (ship-part-model ticket 11c, SPM-R20/R21).
 *
 * The codemod is staged-only: it plans a whole output tree in memory and refuses to publish
 * unless every record is complete, strictly decodable and collision-free. Nothing here ever
 * throws for content reasons — a refusal is a coded, addressable failure, so a caller can
 * report exactly which source record or destination path stopped the migration.
 */

export type MigrationFailureCode =
  /** The requested staging path is unsafe, ambiguous or points at a protected root. */
  | "CODEMOD_UNSAFE_OUTPUT"
  /** Two generated records or two generated files want the same destination path. */
  | "CODEMOD_DESTINATION_COLLISION"
  /** The whole-catalogue builder rejected a source record (see the `PARTCAT_*` code). */
  | "CODEMOD_CATALOGUE_FAILURE"

  /** A placement could not be translated to a loadout entry. */
  | "CODEMOD_UNTRANSLATED_PLACEMENT"
  /** A loadout entry names a part the generated catalogue does not contain. */
  | "CODEMOD_MISSING_PART"
  /** A loadout entry names a slot the design's platform does not offer. */
  | "CODEMOD_MISSING_SLOT"
  /** A generated record does not strictly decode against its content-schema. */
  | "CODEMOD_GENERATED_INVALID"
  /** A staged input (a part, platform or design file) is malformed or incomplete. */
  | "CODEMOD_INVALID_SOURCE"
  /** The destination already holds a tree the writer will not overwrite. */
  | "CODEMOD_EXISTING_OUTPUT"
  /** A filesystem operation failed. */
  | "CODEMOD_IO_FAILURE";

export interface MigrationFailure {
  readonly code: MigrationFailureCode;
  /** `<record kind>.<id>[.<field>]` or a destination path, e.g. `gunMounts.gun_x.TURRET`. */
  readonly path: string;
  readonly message: string;
}

/** Either a value or the typed reasons it could not be produced. */
export type MigrationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failures: readonly MigrationFailure[] };

export const migrationFailure = (
  code: MigrationFailureCode,
  path: string,
  message: string,
): MigrationFailure => ({ code, path, message });
