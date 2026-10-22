import { isAbsolute, resolve, sep } from "node:path";
import { migrationFailure } from "./failure.js";
import type { MigrationResult } from "./failure.js";

export interface StagingPathOptions {
  readonly stagingDir: string;
  readonly protectedRoots?: readonly string[];
}

const segmentsOf = (path: string): readonly string[] => path.split(/[\\/]/u);

const isWithin = (child: string, parent: string): boolean =>
  child === parent || child.startsWith(`${parent}${sep}`);

export function validateStagingDir(options: StagingPathOptions): MigrationResult<string> {
  const raw = options.stagingDir;
  if (raw.trim() === "") {
    return {
      ok: false,
      failures: [
        migrationFailure(
          "CODEMOD_UNSAFE_OUTPUT",
          raw,
          "an explicit staging directory is required.",
        ),
      ],
    };
  }
  if (!isAbsolute(raw)) {
    return {
      ok: false,
      failures: [
        migrationFailure("CODEMOD_UNSAFE_OUTPUT", raw, "the staging directory must be absolute."),
      ],
    };
  }
  if (segmentsOf(raw).includes("..")) {
    return {
      ok: false,
      failures: [
        migrationFailure(
          "CODEMOD_UNSAFE_OUTPUT",
          raw,
          "the staging directory may not contain '..'.",
        ),
      ],
    };
  }
  const resolved = resolve(raw);
  if (resolved === resolve(sep)) {
    return {
      ok: false,
      failures: [
        migrationFailure(
          "CODEMOD_UNSAFE_OUTPUT",
          raw,
          "the filesystem root is not a staging directory.",
        ),
      ],
    };
  }
  for (const protectedRoot of options.protectedRoots ?? []) {
    const root = resolve(protectedRoot);
    if (isWithin(resolved, root) || isWithin(root, resolved)) {
      return {
        ok: false,
        failures: [
          migrationFailure(
            "CODEMOD_UNSAFE_OUTPUT",
            raw,
            `the staging directory overlaps the protected root '${protectedRoot}'.`,
          ),
        ],
      };
    }
  }
  return { ok: true, value: resolved };
}
