import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Result, Schema } from "effect";
import { atomicWrite } from "./runtime/atomicWrite.js";

/**
 * Package directories the user has picked through the native dialog. The main
 * process owns this list so "Recent Campaigns" can reopen a package without
 * the renderer ever being trusted to name an arbitrary path: a path is only
 * loadable if the user previously approved it here.
 */
export const APPROVED_PACKAGES_FILENAME = "approved-packages.json";
const MAX_APPROVED = 50;

const ApprovedPackagesSchema = Schema.Struct({
  version: Schema.Literal(1),
  paths: Schema.Array(Schema.String),
});

export function loadApprovedPackages(userDataDir: string): readonly string[] {
  const file = join(userDataDir, APPROVED_PACKAGES_FILENAME);
  if (!existsSync(file)) return [];
  try {
    const decoded = Schema.decodeUnknownResult(ApprovedPackagesSchema)(
      JSON.parse(readFileSync(file, "utf8")),
    );
    return Result.isFailure(decoded) ? [] : decoded.success.paths;
  } catch {
    return [];
  }
}

export function approvePackage(userDataDir: string, packagePath: string): void {
  const paths = [
    packagePath,
    ...loadApprovedPackages(userDataDir).filter((p) => p !== packagePath),
  ];
  atomicWrite(
    join(userDataDir, APPROVED_PACKAGES_FILENAME),
    JSON.stringify({ version: 1, paths: paths.slice(0, MAX_APPROVED) }),
  );
}
