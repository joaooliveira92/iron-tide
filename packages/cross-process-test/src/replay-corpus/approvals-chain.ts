import { Result } from "effect";

import { checkReplayApprovals, type ApprovalFailure, type CorpusState } from "./approvals.js";

export interface ChainStep {
  readonly label: string;
  readonly state: CorpusState;
}

export interface ChainFailure {
  readonly step: string;
  readonly _tag: ApprovalFailure["_tag"] | "EndpointBinding" | "ChainEndMismatch" | "HopRejected";
  readonly detail: string;
}

export interface ChainCheck {
  readonly ok: boolean;
  readonly failures: readonly ChainFailure[];
}

export interface ChainInput {
  readonly main: CorpusState;
  readonly steps: readonly ChainStep[];
  readonly head: CorpusState;
}

function firstDifference(a: CorpusState, b: CorpusState): string | undefined {
  if ((a.approvals ?? "") !== (b.approvals ?? "")) return "approvals differ";
  for (const [name, text] of a.replays) {
    const other = b.replays.get(name);
    if (other === undefined) return `replay ${name} is missing on the other side`;
    if (other !== text) return `replay ${name} differs`;
  }
  for (const name of b.replays.keys()) {
    if (!a.replays.has(name)) return `replay ${name} is missing on the other side`;
  }
  return undefined;
}

export function checkApprovalChain(input: ChainInput): ChainCheck {
  const [start, ...hops] = input.steps;
  if (start === undefined) {
    return {
      ok: false,
      failures: [{ step: "chain", _tag: "EndpointBinding", detail: "the chain has no start" }],
    };
  }
  const failures: ChainFailure[] = [];
  const binding = firstDifference(input.main, start.state);
  if (binding !== undefined) {
    failures.push({
      step: start.label,
      _tag: "EndpointBinding",
      detail: `main tip is not the chain start: ${binding}`,
    });
  }
  let previous = start;
  for (const step of hops) {
    if (firstDifference(previous.state, step.state) !== undefined) {
      const outcome = checkReplayApprovals(previous.state, step.state);
      if (Result.isFailure(outcome)) {
        failures.push({ step: step.label, _tag: "HopRejected", detail: outcome.failure.message });
      } else {
        for (const failure of outcome.success.failures) {
          failures.push({
            step: step.label,
            _tag: failure._tag,
            detail: `${failure.replayId} month ${String(failure.month)}: ${failure.detail}`,
          });
        }
      }
    }
    previous = step;
  }
  const end = firstDifference(previous.state, input.head);
  if (end !== undefined) {
    failures.push({
      step: previous.label,
      _tag: "ChainEndMismatch",
      detail: `chain end is not the PR head: ${end}`,
    });
  }
  return { ok: failures.length === 0, failures };
}

export function formatChainFailures(failures: readonly ChainFailure[]): string {
  return failures.map((f) => `${f.step} ${f._tag} ${f.detail}\n`).join("");
}
