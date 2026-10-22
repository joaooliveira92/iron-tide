export type MigrationFailureCode =
  | "CODEMOD_UNSAFE_OUTPUT"
  | "CODEMOD_DESTINATION_COLLISION"
  | "CODEMOD_CATALOGUE_FAILURE"
  | "CODEMOD_UNTRANSLATED_PLACEMENT"
  | "CODEMOD_MISSING_PART"
  | "CODEMOD_MISSING_SLOT"
  | "CODEMOD_GENERATED_INVALID"
  | "CODEMOD_INVALID_SOURCE"
  | "CODEMOD_EXISTING_OUTPUT"
  | "CODEMOD_IO_FAILURE";

export interface MigrationFailure {
  readonly code: MigrationFailureCode;
  readonly path: string;
  readonly message: string;
}

export type MigrationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failures: readonly MigrationFailure[] };

export const migrationFailure = (
  code: MigrationFailureCode,
  path: string,
  message: string,
): MigrationFailure => ({ code, path, message });
