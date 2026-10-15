/**
 * The production derivation barrier (ship-part-model I-10, ticket 11a).
 *
 * `compileDesign` is the derivation itself: stages that turn a resolved design into its
 * metrics. This wrapper decides whether that derivation may run at all. The fit stage runs
 * first and `deriveAfterFit` is the only path to `derive`, so a rejected or non-evaluable
 * loadout yields fit findings and no derived metric of any kind.
 */
import { compileDesign } from "./compile.js";
import type { CompiledDesign, DesignDraft, ShipContext } from "./compileShared.js";
import type { Finding } from "./findings.js";
import { deriveAfterFit } from "./partFit.js";
import type { FitResult } from "./partFitTypes.js";

export type FitCheckedCompile =
  | { readonly status: "ACCEPTED"; readonly fit: FitResult; readonly compiled: CompiledDesign }
  | {
      readonly status: "REJECTED" | "NOT_EVALUABLE";
      readonly fit: FitResult;
      /** Blocking findings projected from the fit result; no derived value exists. */
      readonly findings: readonly Finding[];
    };

function fitFindings(fit: FitResult): Finding[] {
  const blocking = (id: string, what: string, parameters: Record<string, string>): Finding => ({
    id,
    severity: "BLOCKING",
    what,
    why: what,
    consequence: "The design cannot be built until the loadout fits.",
    remedies: [],
    evidence: { formulaId: id, inputs: {}, threshold: 0, value: 0 },
    parameters,
  });
  return [
    ...fit.findings.map((f) =>
      blocking(f.code, f.message, {
        path: f.path,
        slot: f.slot,
        ...(f.part ? { part: f.part } : {}),
      }),
    ),
    ...fit.dataIssues.map((d) => blocking(d.code, d.message, { path: d.path })),
  ];
}

/**
 * Run the fit check, then derive only when it is `ACCEPTED`. `check` and `derive` are
 * injected so the caller owns how a draft becomes a loadout; `derive` defaults to
 * `compileDesign`.
 */
export function compileDesignThroughFit(
  draft: DesignDraft,
  ctx: ShipContext,
  check: (draft: DesignDraft) => FitResult,
  derive: (draft: DesignDraft, ctx: ShipContext) => CompiledDesign = compileDesign,
): FitCheckedCompile {
  const outcome = deriveAfterFit(check(draft), () => derive(draft, ctx));
  if (outcome.derived) {
    return { status: "ACCEPTED", fit: outcome.fit, compiled: outcome.value };
  }
  return {
    status: outcome.fit.status === "NOT_EVALUABLE" ? "NOT_EVALUABLE" : "REJECTED",
    fit: outcome.fit,
    findings: fitFindings(outcome.fit),
  };
}
