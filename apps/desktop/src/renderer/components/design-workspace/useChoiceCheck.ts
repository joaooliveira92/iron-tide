import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardFinding } from "./validation/boardFindings.js";

const SERIOUS = new Set(["BLOCKING", "CRITICAL"]);

export interface ChoiceProblem {
  readonly field: string;
  readonly choice: string;
  readonly findings: readonly BoardFinding[];
}

interface Pending {
  readonly field: string;
  readonly choice: string;
  readonly base: readonly BoardFinding[];
}

export function introducedProblems(
  before: readonly BoardFinding[],
  after: readonly BoardFinding[],
): BoardFinding[] {
  const known = new Set(before.map((f) => f.key));
  return after.filter((f) => SERIOUS.has(f.severity) && !known.has(f.key));
}

export function useChoiceCheck(findings: readonly BoardFinding[]) {
  const pending = useRef<Pending | null>(null);
  const latest = useRef(findings);
  const [problem, setProblem] = useState<ChoiceProblem | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    latest.current = findings;
    const p = pending.current;
    if (p === null || findings === p.base) return;
    pending.current = null;
    const added = introducedProblems(p.base, findings);
    if (added.length === 0) return;
    setProblem({ field: p.field, choice: p.choice, findings: added });
    setOpen(true);
  }, [findings]);

  const guard = useCallback((field: string, choice: string, apply: () => void) => {
    pending.current = { field, choice, base: latest.current };
    apply();
  }, []);

  const stillBroken =
    problem === null ? [] : problem.findings.filter((f) => findings.some((g) => g.key === f.key));
  const errorFor = (field: string): string | undefined =>
    problem?.field === field && stillBroken.length > 0 ? stillBroken[0]?.title : undefined;

  return {
    guard,
    errorFor,
    problem:
      stillBroken.length > 0 && problem !== null ? { ...problem, findings: stillBroken } : null,
    open,
    setOpen,
  };
}
