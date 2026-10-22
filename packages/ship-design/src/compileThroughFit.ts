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

export function compileThroughFit(
  check: () => FitResult,
  derive: () => CompiledDesign,
): FitCheckedCompile {
  const outcome = deriveAfterFit(check(), derive);
  if (outcome.derived) {
    return { status: "ACCEPTED", fit: outcome.fit, compiled: outcome.value };
  }
  return {
    status: outcome.fit.status === "NOT_EVALUABLE" ? "NOT_EVALUABLE" : "REJECTED",
    fit: outcome.fit,
    findings: fitFindings(outcome.fit),
  };
}

export function compileDesignThroughFit(
  draft: DesignDraft,
  ctx: ShipContext,
  check: (draft: DesignDraft) => FitResult,
  derive: (draft: DesignDraft, ctx: ShipContext) => CompiledDesign = compileDesign,
): FitCheckedCompile {
  return compileThroughFit(
    () => check(draft),
    () => derive(draft, ctx),
  );
}
