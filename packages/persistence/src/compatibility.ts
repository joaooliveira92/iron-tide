import type { DiagnosticCode, DiagnosticCollector } from "@bluewave/diagnostics";
import { COMPATIBILITY_MISMATCH_CODE, PersistenceCompatibilityMismatchError } from "./errors.js";

export { COMPATIBILITY_MISMATCH_CODE } from "./errors.js";

// B-6/ADR-0025: bumped 1.0.0 -> 1.1.0 because the campaign snapshot schema
// gains authoritative startYear/startMonth + the per-area strategicWeather
// collection.
// SB-3/INC-2 (ADR-0129): bumped 1.1.0 -> 1.2.0 because the dockyard-project
// status vocabulary widens to the DESIGN-23 section 2 set (HALTED, DELAYED,
// ACCELERATED, AWAITING_CAPACITY, IMPOUNDED). Pre-change saves are REJECTED
// with PERSISTENCE_COMPATIBILITY_MISMATCH (no released save exists, so no
// migration engine ships; ADR-0113 section 5 documented rejection).
// ship-part-model P2 (tickets 10/11d, SPM-R21): bumped 1.2.0 -> 2.0.0 in the
// same change that rewrites ship-building content to the parts pipeline and
// switches production compilation. The design data model changes shape, so
// older saves are refused before decoding. An offline developer tool
// (`saveMigration.ts`) migrates development fixtures only; no runtime
// translation path ships (ADR-0113, ADR-0154 section 11).
// S-1 (readiness and maintenance, map D2): bumped 2.0.0 -> 3.0.0 because every
// compiled ship gains required readiness and crew-quality state. As with the
// part-model bump, pre-change saves are refused before decoding (no released
// save exists for the reject-only release; ADR-0113 section 5).
// Economy #138 (1880 campaign economy model): bumped 3.0.0 -> 3.1.0 because authoritative
// outcomes move by design (the compiled start state carries a derived economic base and a
// seeded standing research budget, the snapshot gains the optional research catalogue
// `world.technologies`, seeded construction projects carry packages and `capacityUnits`,
// and outflow ledger entries record requested/shortfall). Every new field is optional, so a
// 3.0.0 snapshot still decodes, but pre-change saves are REFUSED at the compatibility gate
// (ADR-0113 section 5): no released save exists, and replaying a save under a different
// economy would silently change its outcomes.
// S-2 (prestige and career, ADR-0239): bumped 3.1.0 -> 4.0.0 because every compiled nation gains a
// required prestige and the snapshot gains the required prestige value set. Neither has a default, so
// an older save cannot be read without inventing a gameplay value: pre-change saves are REFUSED at the
// compatibility gate before decoding (ADR-0113 section 5) and no migration ships.
export const CURRENT_COMPATIBILITY_VERSION = "4.0.0";

// The named version at which the ship part model landed; it stays 2.0.0 as a
// historical declaration while the current release constant moves on. Kept so
// callers that name the part-model version explicitly keep compiling.
export const PART_MODEL_COMPATIBILITY_VERSION = "2.0.0";

export class CompatibilityChecker {
  static check(
    saveVersion: string,
    diagnostics: DiagnosticCollector,
    currentVersion: string = CURRENT_COMPATIBILITY_VERSION,
  ): boolean {
    if (saveVersion !== currentVersion) {
      // The tagged error is the typed vocabulary; `toDiagnostic()` projects it
      // onto the identical `Diagnostic` the collector already accepted, so the
      // collector-based public surface and its output are unchanged.
      diagnostics.add(
        new PersistenceCompatibilityMismatchError({
          message: `Save compatibility version "${saveVersion}" does not match current engine version "${currentVersion}"`,
          stage: "persistence.load",
          remediation: "Use a compatible save file or migrate the save data.",
        }).toDiagnostic(),
      );
      return false;
    }
    return true;
  }
}

export class CompatibilityError extends Error {
  /** Stable discriminator (RULES.md "Errors"): recover by `_tag`, not `instanceof`. */
  readonly _tag = "CompatibilityError";
  readonly code: DiagnosticCode = COMPATIBILITY_MISMATCH_CODE;
  readonly severity = "error" as const;
  readonly stage = "persistence.load";
  constructor(
    message: string,
    public readonly saveVersion: string,
    public readonly currentVersion: string,
  ) {
    super(message);
    this.name = "CompatibilityError";
  }
}
