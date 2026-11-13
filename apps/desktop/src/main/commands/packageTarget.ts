import { Effect } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import { isApprovedPackage, isPackageDirectory, listRecentPackages } from "../recentPackages.js";
import type { CommandBodyEffect } from "../runtime/commandProgram.js";
import { AppPaths, NativeDialog } from "../runtime/platform.js";

export interface PackageTargetPayload {
  readonly packagePath: string;
}

type Refusal = Extract<BridgeResult<never>, { readonly outcome: "rejected" | "error" }>;

export const packageSelectionCancelled = (): Refusal => ({
  outcome: "rejected",
  reason: "PACKAGE_SELECTION_CANCELLED",
  diagnostics: [],
});

export const resolveApprovedPackage = (packagePath: string) =>
  Effect.gen(function* () {
    const paths = yield* AppPaths;
    const userDataDir = yield* paths.userDataDir();
    const approved = isApprovedPackage(userDataDir, packagePath);
    if (approved !== null) return approved;
    const listed = listRecentPackages(userDataDir).some(
      (entry) => entry.packagePath === packagePath,
    );
    const refusal: Refusal =
      listed && !isPackageDirectory(packagePath)
        ? {
            outcome: "error",
            reason: "PACKAGE_MISSING",
            diagnostics: [`${packagePath} no longer exists. It may have been moved or deleted.`],
          }
        : {
            outcome: "error",
            reason: "PACKAGE_NOT_APPROVED",
            diagnostics: ["This package was not opened through the file dialog; choose it again."],
          };
    return refusal;
  });

export const resolvePackageTarget = (payload: PackageTargetPayload | undefined) =>
  Effect.gen(function* () {
    if (payload !== undefined) return yield* resolveApprovedPackage(payload.packagePath);
    const dialogs = yield* NativeDialog;
    const chosen = yield* dialogs.choosePackageDirectory();
    return chosen === null ? packageSelectionCancelled() : chosen;
  });

export const withPackageTarget =
  (
    run: (saveDir: string) => CommandBodyEffect,
  ): ((payload: PackageTargetPayload | undefined) => CommandBodyEffect) =>
  (payload) =>
    Effect.flatMap(resolvePackageTarget(payload), (target) =>
      typeof target === "string" ? run(target) : Effect.succeed(target),
    );
